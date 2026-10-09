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
  { label: "URL", sort: null },
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

export function statCards(
  cards: readonly { label: string; value: string; zap?: boolean }[],
): string {
  const columns = cards.length === 3 ? "pulse-stats-3" : "pulse-stats-4";
  return `<div class="pulse-stats ${columns}">${cards
    .map(
      (card) => `<article class="pulse-stat${card.zap ? " pulse-stat-zap" : ""}">
        <p>${escapeHtml(card.label)}</p>
        <strong>${escapeHtml(card.value)}</strong>
      </article>`,
    )
    .join("")}</div>`;
}

export function overviewStats(totals: PulseOverview["totals"]): string {
  return statCards([
    { label: "Total sats zapped", value: formatMsatsAsSats(totals.zapMsats), zap: true },
    { label: "Zaps", value: formatSats(totals.zapCount), zap: true },
    { label: "Reactions", value: formatSats(totals.reactionCount) },
    { label: "Domains tracked", value: formatSats(totals.domainCount) },
  ]);
}

export function domainStats(totals: PulseDomainPage["totals"]): string {
  return statCards([
    { label: "Total sats", value: formatMsatsAsSats(totals.zapMsats), zap: true },
    { label: "Zaps", value: formatSats(totals.zapCount), zap: true },
    { label: "Reactions", value: formatSats(totals.reactionCount) },
  ]);
}

export function reactionBadge(reaction: string, content: string): string {
  if (reaction === "like") {
    return `<span class="pulse-badge" title="Like">+</span>`;
  }
  if (reaction === "dislike") {
    return `<span class="pulse-badge" title="Dislike">−</span>`;
  }
  const grapheme = firstGrapheme(content);
  if (!grapheme) return `<span class="pulse-badge">•</span>`;
  return `<span class="pulse-badge pulse-badge-emoji">${escapeHtml(grapheme)}</span>`;
}

export function zapBadge(sats: number): string {
  return `<span class="pulse-badge pulse-badge-zap">${escapeHtml(formatSats(sats))} sats</span>`;
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
  return `<a class="pulse-actor" href="${escapeHtml(`https://njump.me/${npub}`)}" target="_blank" rel="noreferrer">${avatar}<span>${escapeHtml(name || truncateNpub(npub))}</span></a>`;
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
      <h2>Latest activity</h2>
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
    item.kind === "zap" ? zapBadge(item.sats ?? 0) : reactionBadge(item.reaction, item.content);
  const comment = item.comment
    ? `<p class="pulse-comment">${escapeHtml(item.comment)}</p>`
    : "";
  const when =
    item.createdAt === null
      ? "—"
      : `<time datetime="${escapeHtml(new Date(item.createdAt * 1000).toISOString())}">${escapeHtml(timeAgo(item.createdAt, nowSeconds))}</time>`;
  return `<li class="pulse-activity pulse-activity-${item.kind}">
      ${badge}
      <span class="pulse-activity-url">${pageLink(item.url, item.url || "—")}</span>
      ${actorHtml(item.pubkey, profiles)}
      <span class="pulse-when">${when}</span>
      ${comment}
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
              ${icon.chevronRight()}
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

function urlDetail(
  expansion: UrlExpansionView,
  profiles: ReadonlyMap<string, DisplayProfile>,
  nowSeconds: number,
): string {
  let body = `<p class="pulse-note">Loading this URL…</p>`;
  if (expansion.status === "error") body = `<p class="pulse-note">This URL could not be loaded.</p>`;
  else if (expansion.status === "ready" && expansion.items.length === 0) {
    body = `<p class="pulse-note">No reactions or zaps for this URL.</p>`;
  } else if (expansion.status === "ready") {
    body = `<ul class="pulse-activity-list">${expansion.items
      .map((item) => activityRow(item, profiles, nowSeconds))
      .join("")}</ul>`;
  }
  return `<tr class="pulse-url-detail"><td colspan="5">${body}</td></tr>`;
}

function sortHeader(label: string, sort: string | null, current: string): string {
  if (!sort) return `<th scope="col">${escapeHtml(label)}</th>`;
  const selected = sort === current;
  return `<th scope="col" aria-sort="${selected ? "descending" : "none"}">
      <button type="button" data-sort="${escapeHtml(sort)}"${selected ? ` aria-current="true"` : ""}>${escapeHtml(label)}</button>
    </th>`;
}

export function countPubkeys(items: readonly ActivityItem[]): string[] {
  return items.flatMap((item) => (item.pubkey ? [item.pubkey] : []));
}
