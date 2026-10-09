import "../styles.css";
import "./pulse.css";
import { DEFAULT_ATLAS_API_URL } from "../api";
import { pulseDocumentSeo, pulseDomainDocumentSeo, siteOriginFrom } from "../seo";
import { applyDocumentSeo, configureSiteActions } from "../site";
import {
  ACTIVITY_DAYS,
  OVERVIEW_SORTS,
  URL_SORTS,
  PulseNotFoundError,
  fetchDisplayProfiles,
  fetchPulseActivity,
  fetchPulseDomain,
  fetchPulseOverview,
  fetchUrlEvents,
  parsePulseDomainName,
  type ActivityDays,
  type DisplayProfile,
  type OverviewSort,
  type PulseActivity,
  type PulseDomainPage,
  type PulseOverview,
  type UrlEvents,
  type UrlSort,
} from "./api";
import {
  activityHtml,
  countPubkeys,
  domainStats,
  domainTableHtml,
  mergeActivity,
  overviewStats,
  urlTableHtml,
  type ActivityItem,
  type UrlExpansionView,
} from "./render";

const directoryApiUrl =
  import.meta.env.VITE_ATLAS_API_URL?.trim() || DEFAULT_ATLAS_API_URL;
const siteOrigin = siteOriginFrom(import.meta.env.VITE_SITE_ORIGIN);
const PROFILE_CHUNK = 50;

type TableStatus = "loading" | "ready" | "error" | "missing";
type ActivityStatus = "loading" | "ready" | "error";

const profiles = new Map<string, DisplayProfile>();
const expansions = new Map<string, { status: UrlExpansionView["status"]; events: UrlEvents | null }>();
let overview: PulseOverview | null = null;
let domainPage: PulseDomainPage | null = null;
let activity: PulseActivity | null = null;
let domain = "";
let domainError = "";
let search = "";
let searchError = "";
let domainSort: OverviewSort = "reactions";
let urlSort: UrlSort = "sats";
let days: ActivityDays = 7;
let tableStatus: TableStatus = "loading";
let activityStatus: ActivityStatus = "loading";
let tableToken = 0;
let activityToken = 0;
const expansionTokens = new Map<string, number>();
let profileFlight: Promise<void> | null = null;

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

const overviewSection = required<HTMLElement>("#pulse-overview");
const domainSection = required<HTMLElement>("#pulse-domain");
const overviewStatsNode = required<HTMLElement>("#overview-stats");
const overviewActivityNode = required<HTMLElement>("#overview-activity");
const domainTableNode = required<HTMLElement>("#domain-table");
const domainHeading = required<HTMLElement>("#domain-heading");
const domainStatsNode = required<HTMLElement>("#domain-stats");
const urlTableNode = required<HTMLElement>("#url-table");
const domainActivityNode = required<HTMLElement>("#domain-activity");
const searchInput = required<HTMLInputElement>("#domain-search-input");

function showNote(element: HTMLElement, message: string): void {
  element.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = "pulse-note";
  paragraph.textContent = message;
  element.append(paragraph);
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

function visibleItems(): ActivityItem[] {
  const items = activity && activityStatus === "ready" ? mergeActivity(activity) : [];
  for (const expansion of expansions.values()) {
    if (expansion.status === "ready" && expansion.events) {
      items.push(...mergeActivity(expansion.events));
    }
  }
  return items;
}

function paint(): void {
  const onDomain = Boolean(domain);
  overviewSection.hidden = onDomain;
  domainSection.hidden = !onDomain;
  const currentProfiles = profiles;
  const seconds = nowSeconds();
  const activityItems = activity && activityStatus === "ready" ? mergeActivity(activity) : [];
  const activityMarkup = activityHtml(
    activityItems,
    days,
    currentProfiles,
    seconds,
    activityStatus,
  );
  if (onDomain) {
    domainHeading.textContent = domain;
    domainStatsNode.innerHTML =
      tableStatus === "ready" && domainPage ? domainStats(domainPage.totals) : "";
    const views = new Map<string, UrlExpansionView>();
    const urlByKey = new Map((domainPage?.urls ?? []).map((row) => [row.urlKey, row.url]));
    for (const [key, expansion] of expansions) {
      const pageUrl = urlByKey.get(key) ?? "";
      views.set(key, {
        status: expansion.status,
        items:
          expansion.status === "ready" && expansion.events
            ? mergeActivity(expansion.events).map((item) => ({ ...item, url: pageUrl }))
            : [],
      });
    }
    urlTableNode.innerHTML = urlTableHtml(
      domainPage,
      urlSort,
      views,
      currentProfiles,
      tableStatus,
      seconds,
    );
    domainActivityNode.innerHTML = activityMarkup;
  } else {
    overviewStatsNode.innerHTML =
      tableStatus === "ready" && overview ? overviewStats(overview.totals) : "";
    overviewActivityNode.innerHTML = activityMarkup;
    if (searchError) {
      showNote(domainTableNode, searchError);
    } else {
      domainTableNode.innerHTML = domainTableHtml(
        overview?.domains ?? [],
        domainSort,
        search,
        tableStatus === "missing" ? "error" : tableStatus,
        seconds,
      );
    }
  }
  void loadMissingProfiles();
}

async function loadMissingProfiles(): Promise<void> {
  const missing = [
    ...new Set(countPubkeys(visibleItems()).filter((pubkey) => !profiles.has(pubkey))),
  ];
  if (!missing.length || profileFlight) return;
  profileFlight = (async () => {
    const chunks: string[][] = [];
    for (let index = 0; index < missing.length; index += PROFILE_CHUNK) {
      chunks.push(missing.slice(index, index + PROFILE_CHUNK));
    }
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          return await fetchDisplayProfiles(directoryApiUrl, chunk);
        } catch {
          return chunk.map((pubkey) => ({ pubkey, name: "", picture: "" }));
        }
      }),
    );
    for (const list of results) {
      for (const profile of list) profiles.set(profile.pubkey, profile);
    }
    for (const pubkey of missing) {
      if (!profiles.has(pubkey)) profiles.set(pubkey, { pubkey, name: "", picture: "" });
    }
  })().finally(() => {
    profileFlight = null;
  });
  await profileFlight;
  paint();
}

async function reloadTable(): Promise<void> {
  const token = ++tableToken;
  tableStatus = "loading";
  paint();
  try {
    if (domain) {
      const page = await fetchPulseDomain(directoryApiUrl, { domain, sort: urlSort });
      if (token !== tableToken) return;
      domainPage = page;
    } else {
      const next = await fetchPulseOverview(directoryApiUrl, { sort: domainSort, search });
      if (token !== tableToken) return;
      overview = next;
    }
    tableStatus = "ready";
  } catch (error) {
    if (token !== tableToken) return;
    tableStatus = error instanceof PulseNotFoundError ? "missing" : "error";
  }
  paint();
}

async function reloadActivity(): Promise<void> {
  const token = ++activityToken;
  activityStatus = "loading";
  paint();
  try {
    const next = await fetchPulseActivity(directoryApiUrl, { days, domain });
    if (token !== activityToken) return;
    activity = next;
    activityStatus = "ready";
  } catch {
    if (token !== activityToken) return;
    activityStatus = "error";
  }
  paint();
}

function closeExpansions(): void {
  for (const [key, token] of expansionTokens) {
    expansionTokens.set(key, token + 1);
  }
  expansions.clear();
}

async function toggleUrl(urlKey: string): Promise<void> {
  if (expansions.has(urlKey)) {
    expansions.delete(urlKey);
    expansionTokens.set(urlKey, (expansionTokens.get(urlKey) ?? 0) + 1);
    paint();
    return;
  }
  const token = (expansionTokens.get(urlKey) ?? 0) + 1;
  expansionTokens.set(urlKey, token);
  expansions.set(urlKey, { status: "loading", events: null });
  paint();
  try {
    const events = await fetchUrlEvents(directoryApiUrl, urlKey);
    if (expansionTokens.get(urlKey) !== token) return;
    expansions.set(urlKey, { status: "ready", events });
  } catch {
    if (expansionTokens.get(urlKey) !== token) return;
    expansions.set(urlKey, { status: "error", events: null });
  }
  paint();
}

function readDomain(): void {
  const raw = new URLSearchParams(location.search).get("domain");
  if (!raw) return;
  try {
    domain = parsePulseDomainName(raw, true);
  } catch (error) {
    domainError = error instanceof Error ? error.message : "That domain is not valid.";
  }
}

function boot(): void {
  configureSiteActions(siteOrigin);
  readDomain();
  if (domain && !domainError) {
    applyDocumentSeo(pulseDomainDocumentSeo(siteOrigin, domain));
  } else {
    applyDocumentSeo(pulseDocumentSeo(siteOrigin));
  }
  document.addEventListener("click", onClick);
  required<HTMLFormElement>("#domain-search").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      search = parsePulseDomainName(searchInput.value);
      searchInput.value = search;
      searchError = "";
    } catch (error) {
      tableToken += 1;
      search = "";
      searchError = error instanceof Error ? error.message : "That domain is not valid.";
      paint();
      return;
    }
    void reloadTable();
  });
  if (domainError) {
    overviewSection.hidden = true;
    domainSection.hidden = false;
    domainHeading.textContent = "Web Pulse";
    showNote(urlTableNode, domainError);
    domainActivityNode.replaceChildren();
    return;
  }
  void reloadTable();
  void reloadActivity();
}

function onClick(event: Event): void {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const sortButton = target.closest<HTMLButtonElement>("[data-sort]");
  const sort = sortButton?.dataset.sort;
  if (sort) {
    if (domain && isUrlSort(sort) && sort !== urlSort) {
      urlSort = sort;
      closeExpansions();
      void reloadTable();
    } else if (!domain && isOverviewSort(sort) && sort !== domainSort) {
      domainSort = sort;
      void reloadTable();
    }
    return;
  }
  const dayButton = target.closest<HTMLButtonElement>("[data-days]");
  const dayValue = Number(dayButton?.dataset.days);
  if (dayButton && isDays(dayValue) && dayValue !== days) {
    days = dayValue;
    void reloadActivity();
    return;
  }
  const expand = target.closest<HTMLButtonElement>("[data-expand]");
  if (expand?.dataset.expand) {
    void toggleUrl(expand.dataset.expand);
    return;
  }
  const retry = target.closest<HTMLButtonElement>("[data-retry]");
  if (retry?.dataset.retry === "activity") void reloadActivity();
  else if (retry?.dataset.retry === "table") void reloadTable();
}

function isOverviewSort(value: string): value is OverviewSort {
  return (OVERVIEW_SORTS as readonly string[]).includes(value);
}

function isUrlSort(value: string): value is UrlSort {
  return (URL_SORTS as readonly string[]).includes(value);
}

function isDays(value: number): value is ActivityDays {
  return (ACTIVITY_DAYS as readonly number[]).includes(value);
}

boot();
