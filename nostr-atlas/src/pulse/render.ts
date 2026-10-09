import { nip19 } from "nostr-tools";
import { httpsPictureUrl, truncateNpub } from "../directory";
import { icon } from "../icons";
import { escapeHtml } from "../seo";
import type {
  DisplayProfile,
  OverviewSort,
  PulseActivity,
  PulseDomainPage,
  PulseDomainRow,
  PulseOverview,
  PulseReaction,
  PulseZap,
  UrlEvents,
  UrlSort,
} from "./api";

const GRAPHEME_CODE_POINT_CAP = 16;

export interface ActivityItem {
  readonly key: string;
  readonly kind: "zap" | "reaction";
  readonly createdAt: number | null;
  readonly url: string;
  readonly pubkey: string | null;
  readonly sats: number | null;
  readonly comment: string;
  readonly reaction: string;
  readonly content: string;
}

export interface UrlExpansionView {
  readonly status: "loading" | "ready" | "error";
  readonly items: readonly ActivityItem[];
}

const DOMAIN_COLUMNS: readonly { label: string; sort: OverviewSort | null }[] = [
  { label: "Domain", sort: null },
  { label: "Total sats", sort: "sats" },
  { label: "Zaps", sort: "zaps" },
  { label: "Reactions", sort: "reactions" },
  { label: "Dislikes", sort: "dislikes" },
  { label: "Emoji", sort: "emoji" },
  { label: "Last active", sort: "lastactive" },
];

const URL_COLUMNS: readonly { label: string; sort: UrlSort | null }[] = [
  { label: "URL Path", sort: null },
  { label: "Total sats", sort: "sats" },
  { label: "Zaps", sort: "zaps" },
  { label: "Reactions", sort: "reactions" },
  { label: "Last active", sort: "lastactive" },
];

export function formatSats(sats: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(sats);
}

export function formatMsatsAsSats(msats: number): string {
  return formatSats(Math.floor(msats / 1000));
}

type GraphemeSegmenter = {
  segment(input: string): Iterable<{ segment: string }>;
};

function graphemes(): GraphemeSegmenter {
  const intl = Intl as typeof Intl & {
    Segmenter: new (
      locales: undefined,
      options: { granularity: "grapheme" },
    ) => GraphemeSegmenter;
  };
  return new intl.Segmenter(undefined, { granularity: "grapheme" });
}

export function firstGrapheme(value: string): string {
  if (!value) return "";
  const segment = graphemes().segment(value)[Symbol.iterator]().next().value?.segment ?? "";
  if ([...segment].length > GRAPHEME_CODE_POINT_CAP) return "";
  return segment;
}

export function httpsPageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function urlPathAndQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return value;
  }
}

export function timeAgo(createdAt: number | null, nowSeconds: number): string {
  if (createdAt === null) return "—";
  const seconds = Math.max(0, Math.floor(nowSeconds - createdAt));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const BOLT_PATH = `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>`;
const HEART_PATH = `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`;
const GLOBE_PATH = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>`;
const THUMB_UP = `<path d="M17.73 13.77C18.65 12.86 19.19 11.57 19 10.22C18.73 8.39 17.16 7 15.31 7H11.9L12.6 3.34C12.67 2.97 12.56 2.59 12.31 2.31C11.83 1.77 11 1.74 10.49 2.23L4 8.59V18H14.4C15.71 18 16.84 17.12 17.12 15.84L17.73 13.77Z"/><path d="M2 18H4V8H2V18Z"/>`;
const THUMB_DOWN = `<path d="M6.27 10.23C5.35 11.14 4.81 12.43 5 13.78C5.27 15.61 6.84 17 8.69 17H12.1L11.4 20.66C11.33 21.03 11.44 21.41 11.69 21.69C12.17 22.23 13 22.26 13.51 21.77L20 15.41V6H9.6C8.29 6 7.16 6.88 6.88 8.16L6.27 10.23Z"/><path d="M22 6H20V16H22V6Z"/>`;

type StatIcon = "bolt" | "heart" | "globe";
type StatTone = "hero" | "zap" | "plain";

function filledIcon(path: string, size: "md" | "lg"): string {
  return `<svg class="pulse-stat-icon-${size}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

function statIcon(icon: StatIcon, size: "md" | "lg"): string {
  const path = icon === "bolt" ? BOLT_PATH : icon === "heart" ? HEART_PATH : GLOBE_PATH;
  return filledIcon(path, size);
}

export function statCards(
  cards: readonly {
    label: string;
    value: string;
    icon: StatIcon;
    iconSize?: "md" | "lg";
    tone: StatTone;
  }[],
): string {
  const columns = cards.length === 3 ? "pulse-stats-3" : "pulse-stats-4";
  return `<div class="pulse-stats ${columns}">${cards
    .map((card) => {
      const tone = card.tone === "plain" ? "" : ` pulse-stat-${card.tone}`;
      return `<article class="pulse-stat${tone}">
        <span class="pulse-stat-icon">${statIcon(card.icon, card.iconSize ?? "md")}</span>
        <div>
          <strong>${escapeHtml(card.value)}</strong>
          <p>${escapeHtml(card.label)}</p>
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

export function overviewStats(totals: PulseOverview["totals"]): string {
  return statCards([
    {
      label: "Total Sats Zapped",
      value: formatMsatsAsSats(totals.zapMsats),
      icon: "bolt",
      iconSize: "lg",
      tone: "hero",
    },
    { label: "Total Zaps", value: formatSats(totals.zapCount), icon: "bolt", tone: "zap" },
    { label: "Total Reactions", value: formatSats(totals.reactionCount), icon: "heart", tone: "plain" },
    { label: "Domains Tracked", value: formatSats(totals.domainCount), icon: "globe", tone: "plain" },
  ]);
}

export function domainStats(totals: PulseDomainPage["totals"]): string {
  return statCards([
    { label: "Total Sats", value: formatMsatsAsSats(totals.zapMsats), icon: "bolt", tone: "hero" },
    { label: "Zaps", value: formatSats(totals.zapCount), icon: "bolt", tone: "zap" },
    { label: "Reactions", value: formatSats(totals.reactionCount), icon: "heart", tone: "plain" },
  ]);
}

export function reactionBadge(reaction: string, content: string): string {
  if (reaction === "like") {
    return `<span class="pulse-react" title="Like"><svg viewBox="0 0 24 24" aria-hidden="true">${THUMB_UP}</svg></span>`;
  }
  if (reaction === "dislike") {
    return `<span class="pulse-react pulse-react-down" title="Dislike"><svg viewBox="0 0 24 24" aria-hidden="true">${THUMB_DOWN}</svg></span>`;
  }
  const grapheme = firstGrapheme(content);
  if (!grapheme) return `<span class="pulse-emoji">•</span>`;
  return `<span class="pulse-emoji">${escapeHtml(grapheme)}</span>`;
}

export function zapBadge(sats: number, size: "sm" | "lg" = "sm"): string {
  const sizeClass = size === "lg" ? "pulse-zap-lg" : "pulse-zap-sm";
  return `<span class="pulse-zap ${sizeClass}"><svg viewBox="0 0 24 24" aria-hidden="true">${BOLT_PATH}</svg>${escapeHtml(formatSats(sats))}<span>sats</span></span>`;
}

export function actorHtml(
  pubkey: string | null,
  profiles: ReadonlyMap<string, DisplayProfile>,
): string {
  if (!pubkey) return `<span class="pulse-actor">Anonymous</span>`;
  let npub = "";
  try {
    npub = nip19.npubEncode(pubkey);
  } catch {
    return `<span class="pulse-actor">Anonymous</span>`;
  }
  const profile = profiles.get(pubkey);
  const name = profile?.name.trim() ?? "";
  const picture = httpsPictureUrl(profile?.picture ?? "");
  const avatar = picture
    ? `<img class="pulse-avatar" src="${escapeHtml(picture)}" alt="" />`
    : `<span class="pulse-avatar" aria-hidden="true"></span>`;
  const labelClass = name ? "" : ` class="pulse-handle"`;
  return `<a class="pulse-actor" href="${escapeHtml(`https://njump.me/${npub}`)}" target="_blank" rel="noreferrer">${avatar}<span${labelClass}>${escapeHtml(name || truncateNpub(npub))}</span></a>`;
}

function pageLink(url: string, text: string): string {
  const safe = escapeHtml(text);
  const href = httpsPageUrl(url);
  if (!href) return `<span>${safe}</span>`;
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${safe}</a>`;
}

export function mergeActivity(activity: PulseActivity | UrlEvents): ActivityItem[] {
  const zaps = activity.zaps.map((zap) => zapItem(zap));
  const reactions = activity.reactions.map((reaction) => reactionItem(reaction));
  return [...zaps, ...reactions].sort((left, right) => {
    const delta = (right.createdAt ?? -1) - (left.createdAt ?? -1);
    if (delta) return delta;
    if (left.key < right.key) return -1;
    if (left.key > right.key) return 1;
    return 0;
  });
}

function zapItem(zap: PulseZap): ActivityItem {
  return {
    key: `zap:${zap.id}`,
    kind: "zap",
    createdAt: zap.createdAt,
    url: zap.url,
    pubkey: zap.senderPubkey,
    sats: zap.sats,
    comment: zap.comment,
    reaction: "",
    content: "",
  };
}

function reactionItem(reaction: PulseReaction): ActivityItem {
  return {
    key: `reaction:${reaction.pubkey}:${reaction.createdAt ?? "none"}:${reaction.url}`,
    kind: "reaction",
    createdAt: reaction.createdAt,
    url: reaction.url,
    pubkey: reaction.pubkey,
    sats: null,
    comment: "",
    reaction: reaction.reaction,
    content: reaction.content,
  };
}

export function activityHtml(
  items: readonly ActivityItem[],
  days: 1 | 7 | 30,
  profiles: ReadonlyMap<string, DisplayProfile>,
  nowSeconds: number,
  status: "loading" | "ready" | "error",
): string {
  const tabs = [1, 7, 30]
    .map(
      (value) =>
        `<button type="button" data-days="${value}" aria-pressed="${value === days ? "true" : "false"}">${value}D</button>`,
    )
    .join("");
  let body = "";
  if (status === "loading") body = `<p class="pulse-note">Loading activity…</p>`;
  else if (status === "error") {
    body = `<p class="pulse-note">Activity could not be loaded. <button type="button" class="text-button" data-retry="activity">Retry</button></p>`;
  } else if (items.length === 0) {
    body = `<p class="pulse-note">No activity in this period.</p>`;
  } else {
    body = `<ul class="pulse-activity-list">${items.map((item) => activityRow(item, profiles, nowSeconds)).join("")}</ul>`;
  }
  return `<div class="pulse-activity-head">
      <h2>Latest Activity</h2>
      <div class="pulse-days" role="group" aria-label="Activity window">${tabs}</div>
    </div>
    ${body}`;
}

function activityRow(
  item: ActivityItem,
  profiles: ReadonlyMap<string, DisplayProfile>,
  nowSeconds: number,
): string {
  const badge =
    item.kind === "zap"
      ? zapBadge(item.sats ?? 0, "lg")
      : reactionBadge(item.reaction, item.content);
  const when =
    item.createdAt === null
      ? "—"
      : `<time datetime="${escapeHtml(new Date(item.createdAt * 1000).toISOString())}">${escapeHtml(timeAgo(item.createdAt, nowSeconds))}</time>`;
  return `<li class="pulse-activity pulse-activity-${item.kind}">
      ${badge}
      <span class="pulse-activity-url">${pageLink(item.url, item.url || "—")}</span>
      ${actorHtml(item.pubkey, profiles)}
      <span class="pulse-when">${when}</span>
    </li>`;
}

export function domainTableHtml(
  domains: readonly PulseDomainRow[],
  sort: OverviewSort,
  search: string,
  status: "loading" | "ready" | "error",
  nowSeconds: number,
): string {
  if (status === "loading") return `<p class="pulse-note">Loading domains…</p>`;
  if (status === "error") {
    return `<p class="pulse-note">Domains could not be loaded. <button type="button" class="text-button" data-retry="table">Retry</button></p>`;
  }
  if (domains.length === 0) {
    return `<p class="pulse-note">${search ? "No domains match that search." : "No domains yet."}</p>`;
  }
  const head = DOMAIN_COLUMNS.map((column) => sortHeader(column.label, column.sort, sort)).join("");
  const rows = domains
    .map((domain) => {
      const href = `/pulse/?domain=${encodeURIComponent(domain.domain)}`;
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(domain.domain)}</a></td>
        <td class="pulse-sats">${escapeHtml(formatMsatsAsSats(domain.zapMsats))}</td>
        <td class="pulse-sats">${escapeHtml(formatSats(domain.zapCount))}</td>
        <td>${escapeHtml(formatSats(domain.reactionCount))}</td>
        <td>${escapeHtml(formatSats(domain.dislikeCount))}</td>
        <td>${escapeHtml(formatSats(domain.emojiCount))}</td>
        <td>${escapeHtml(timeAgo(domain.lastActivityAt, nowSeconds))}</td>
      </tr>`;
    })
    .join("");
  return `<div class="pulse-table-wrap"><table class="pulse-table">
      <caption class="sr-only">Domains</caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

export function urlTableHtml(
  page: PulseDomainPage | null,
  sort: UrlSort,
  expansions: ReadonlyMap<string, UrlExpansionView>,
  profiles: ReadonlyMap<string, DisplayProfile>,
  status: "loading" | "ready" | "error" | "missing",
  nowSeconds: number,
): string {
  if (status === "loading") return `<p class="pulse-note">Loading URLs…</p>`;
  if (status === "missing") return `<p class="pulse-note">This domain is not in the index.</p>`;
  if (status === "error" || !page) {
    return `<p class="pulse-note">This domain could not be loaded. <button type="button" class="text-button" data-retry="table">Retry</button></p>`;
  }
  if (page.urls.length === 0) return `<p class="pulse-note">No URLs tracked yet.</p>`;
  const head = URL_COLUMNS.map((column) => sortHeader(column.label, column.sort, sort)).join("");
  const rows = page.urls
    .map((url) => {
      const open = expansions.get(url.urlKey);
      const path = urlPathAndQuery(url.url);
      const href = httpsPageUrl(url.url);
      const opener = href
        ? `<a class="pulse-open" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" aria-label="Open page">${icon.external()}</a>`
        : "";
      const detail = open ? urlDetail(open, profiles, nowSeconds) : "";
      return `<tr>
          <td>
            <button type="button" class="pulse-expand" data-expand="${escapeHtml(url.urlKey)}" aria-expanded="${open ? "true" : "false"}">
              <svg class="pulse-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l8 7-8 7z"/></svg>
              <span>${escapeHtml(path || "/")}</span>
            </button>
            ${opener}
          </td>
          <td class="pulse-sats">${escapeHtml(formatMsatsAsSats(url.zapMsats))}</td>
          <td class="pulse-sats">${escapeHtml(formatSats(url.zapCount))}</td>
          <td>${escapeHtml(formatSats(url.reactionCount))}</td>
          <td>${escapeHtml(timeAgo(url.lastActivityAt, nowSeconds))}</td>
        </tr>
        ${detail}`;
    })
    .join("");
  return `<div class="pulse-table-wrap"><table class="pulse-table">
      <caption class="sr-only">URLs</caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function expansionRow(
  item: ActivityItem,
  profiles: ReadonlyMap<string, DisplayProfile>,
  nowSeconds: number,
): string {
  const badge =
    item.kind === "zap"
      ? zapBadge(item.sats ?? 0, "sm")
      : reactionBadge(item.reaction, item.content);
  const comment = item.comment
    ? `<p class="pulse-comment">${escapeHtml(item.comment)}</p>`
    : "";
  const when =
    item.createdAt === null
      ? "—"
      : `<time datetime="${escapeHtml(new Date(item.createdAt * 1000).toISOString())}">${escapeHtml(timeAgo(item.createdAt, nowSeconds))}</time>`;
  return `<li class="pulse-url-event">
      ${actorHtml(item.pubkey, profiles)}
      ${badge}
      ${comment}
      <span class="pulse-when">${when}</span>
    </li>`;
}

function urlDetail(
  expansion: UrlExpansionView,
  profiles: ReadonlyMap<string, DisplayProfile>,
  nowSeconds: number,
): string {
  let body = `<p class="pulse-note">Loading reactions...</p>`;
  if (expansion.status === "error") body = `<p class="pulse-note">This URL could not be loaded.</p>`;
  else if (expansion.status === "ready" && expansion.items.length === 0) {
    body = `<p class="pulse-note">No individual reactions found.</p>`;
  } else if (expansion.status === "ready") {
    body = `<ul class="pulse-url-events">${expansion.items
      .map((item) => expansionRow(item, profiles, nowSeconds))
      .join("")}</ul>`;
  }
  return `<tr class="pulse-url-detail"><td colspan="5">${body}</td></tr>`;
}

function sortHeader(label: string, sort: string | null, current: string): string {
  if (!sort) return `<th scope="col">${escapeHtml(label)}</th>`;
  const selected = sort === current;
  const zap = sort === "sats" || sort === "zaps" ? ` class="pulse-th-zap"` : "";
  return `<th scope="col"${zap} aria-sort="${selected ? "descending" : "none"}">
      <button type="button" data-sort="${escapeHtml(sort)}"${selected ? ` aria-current="true"` : ""}>${escapeHtml(label)}</button>
    </th>`;
}

export function countPubkeys(items: readonly ActivityItem[]): string[] {
  return items.flatMap((item) => (item.pubkey ? [item.pubkey] : []));
}
