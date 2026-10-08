import { directoryFunctionUrl } from "../api";

const REQUEST_TIMEOUT_MS = 15_000;
const HEX_64 = /^[0-9a-f]{64}$/;
const DOMAIN_PATTERN = /^[a-z0-9.-]+$/;
const OVERVIEW_LIMIT = 50;
const ACTIVITY_LIMIT = 30;
const EVENT_LIMIT = 50;
const PROFILE_LIMIT = 50;
const MAX_TEXT = 4_000;

export const OVERVIEW_SORTS = [
  "sats",
  "zaps",
  "reactions",
  "dislikes",
  "emoji",
  "lastactive",
] as const;
export const URL_SORTS = ["sats", "zaps", "reactions", "lastactive"] as const;
export const ACTIVITY_DAYS = [1, 7, 30] as const;

export type OverviewSort = (typeof OVERVIEW_SORTS)[number];
export type UrlSort = (typeof URL_SORTS)[number];
export type ActivityDays = (typeof ACTIVITY_DAYS)[number];

export interface PulseCounts {
  readonly likeCount: number;
  readonly dislikeCount: number;
  readonly emojiCount: number;
  readonly reactionCount: number;
  readonly zapCount: number;
  readonly zapMsats: number;
}

export interface PulseDomainRow extends PulseCounts {
  readonly domain: string;
  readonly urlCount: number;
  readonly lastActivityAt: number | null;
}

export interface PulseOverview {
  readonly totals: PulseCounts & { readonly domainCount: number };
  readonly domains: readonly PulseDomainRow[];
}

export interface PulseUrlRow extends PulseCounts {
  readonly url: string;
  readonly urlKey: string;
  readonly lastActivityAt: number | null;
}

export interface PulseDomainPage {
  readonly domain: string;
  readonly totals: PulseCounts & {
    readonly urlCount: number;
    readonly lastActivityAt: number | null;
  };
  readonly urls: readonly PulseUrlRow[];
}

export interface PulseZap {
  readonly id: string;
  readonly sats: number;
  readonly createdAt: number | null;
  readonly senderPubkey: string | null;
  readonly comment: string;
  readonly url: string;
}

export interface PulseReaction {
  readonly pubkey: string;
  readonly reaction: "like" | "dislike" | "emoji";
  readonly content: string;
  readonly createdAt: number | null;
  readonly url: string;
  readonly urlKey: string | null;
}

export interface PulseActivity {
  readonly zaps: readonly PulseZap[];
  readonly reactions: readonly PulseReaction[];
}

export interface UrlEvents {
  readonly zaps: readonly PulseZap[];
  readonly reactions: readonly PulseReaction[];
}

export interface DisplayProfile {
  readonly pubkey: string;
  readonly name: string;
  readonly picture: string;
}

export class PulseNotFoundError extends Error {
  constructor() {
    super("This domain is not in the index.");
    this.name = "PulseNotFoundError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new Error("Web Pulse returned an invalid response.");
}

function nonNegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) invalid();
  if (value > Number.MAX_SAFE_INTEGER) invalid();
  return value;
}

function timestamp(value: unknown): number | null {
  if (value === null) return null;
  return nonNegative(value);
}

function boundedText(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_TEXT) invalid();
  return value;
}

function hex(value: unknown): string {
  if (typeof value !== "string" || !HEX_64.test(value)) invalid();
  return value;
}

function optionalHex(value: unknown): string | null {
  if (value === null) return null;
  return hex(value);
}

function countsOf(value: unknown): PulseCounts {
  if (!record(value)) invalid();
  return {
    likeCount: nonNegative(value.likeCount),
    dislikeCount: nonNegative(value.dislikeCount),
    emojiCount: nonNegative(value.emojiCount),
    reactionCount: nonNegative(value.reactionCount),
    zapCount: nonNegative(value.zapCount),
    zapMsats: nonNegative(value.zapMsats),
  };
}

function domainName(value: unknown): string {
  if (typeof value !== "string") invalid();
  if (
    value.length === 0 ||
    value.length > 253 ||
    !DOMAIN_PATTERN.test(value) ||
    value.startsWith(".") ||
    value.endsWith(".") ||
    value.includes("..")
  ) {
    invalid();
  }
  return value;
}

function list<T>(value: unknown, limit: number, map: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > limit) invalid();
  return value.map(map);
}

function reactionOf(value: unknown, urlRequired: boolean): PulseReaction {
  if (!record(value)) invalid();
  const reaction = value.reaction;
  if (reaction !== "like" && reaction !== "dislike" && reaction !== "emoji") invalid();
  return {
    pubkey: hex(value.pubkey),
    reaction,
    content: boundedText(value.content),
    createdAt: timestamp(value.createdAt),
    url: urlRequired ? boundedText(value.url) : "",
    urlKey: value.urlKey === undefined ? null : optionalHex(value.urlKey),
  };
}

function zapOf(value: unknown, urlRequired: boolean): PulseZap {
  if (!record(value)) invalid();
  return {
    id: hex(value.id),
    sats: nonNegative(value.sats),
    createdAt: timestamp(value.createdAt),
    senderPubkey: optionalHex(value.senderPubkey),
    comment: boundedText(value.comment),
    url: urlRequired ? boundedText(value.url) : "",
  };
}

export function parsePulseDomainName(value: string, required = false): string {
  const domain = value.trim().toLowerCase().replace(/^www\./, "");
  if (!domain) {
    if (required) throw new Error("That domain is not valid.");
    return "";
  }
  if (
    domain.length > 253 ||
    !DOMAIN_PATTERN.test(domain) ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    throw new Error("That domain is not valid.");
  }
  return domain;
}

export function parsePulseOverview(value: unknown): PulseOverview {
  if (!record(value) || !record(value.totals)) invalid();
  return {
    totals: {
      domainCount: nonNegative(value.totals.domainCount),
      ...countsOf(value.totals),
    },
    domains: list(value.domains, OVERVIEW_LIMIT, (item) => {
      if (!record(item)) invalid();
      return {
        domain: domainName(item.domain),
        urlCount: nonNegative(item.urlCount),
        lastActivityAt: timestamp(item.lastActivityAt),
        ...countsOf(item),
      };
    }),
  };
}

export function parsePulseDomain(value: unknown): PulseDomainPage {
  if (!record(value) || !record(value.totals)) invalid();
  return {
    domain: domainName(value.domain),
    totals: {
      urlCount: nonNegative(value.totals.urlCount),
      lastActivityAt: timestamp(value.totals.lastActivityAt),
      ...countsOf(value.totals),
    },
    urls: list(value.urls, OVERVIEW_LIMIT, (item) => {
      if (!record(item)) invalid();
      return {
        url: boundedText(item.url),
        urlKey: hex(item.urlKey),
        lastActivityAt: timestamp(item.lastActivityAt),
        ...countsOf(item),
      };
    }),
  };
}

export function parsePulseActivity(value: unknown): PulseActivity {
  if (!record(value)) invalid();
  return {
    zaps: list(value.zaps, ACTIVITY_LIMIT, (item) => zapOf(item, true)),
    reactions: list(value.reactions, ACTIVITY_LIMIT, (item) => reactionOf(item, true)),
  };
}

export function parseUrlEvents(value: unknown): UrlEvents {
  if (!record(value)) invalid();
  return {
    zaps: list(value.zaps, EVENT_LIMIT, (item) => zapOf(item, false)),
    reactions: list(value.reactions, EVENT_LIMIT, (item) => reactionOf(item, false)),
  };
}

export function parseDisplayProfiles(value: unknown): DisplayProfile[] {
  if (!record(value)) invalid();
  return list(value.profiles, PROFILE_LIMIT, (item) => {
    if (!record(item)) invalid();
    const name = item.name;
    const picture = item.picture;
    if (typeof name !== "string" || name.length > 100) invalid();
    if (typeof picture !== "string" || picture.length > 2_000) invalid();
    return { pubkey: hex(item.pubkey), name, picture };
  });
}

function pulseErrorMessage(code: string, status: number): string {
  if (code === "invalid_sort") return "That sort is not available.";
  if (code === "invalid_search" || code === "invalid_domain") {
    return "That domain is not valid.";
  }
  if (code === "invalid_days") return "That time range is not available.";
  if (code === "invalid_key") return "That page could not be opened.";
  if (status === 503 || code === "pulse_unavailable") return "Web Pulse is unavailable.";
  return "Web Pulse could not be loaded.";
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error("Web Pulse took too long to respond.");
    }
    throw new Error("Web Pulse could not be loaded.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.status === 404 && record(body) && body.error === "not_found") {
    throw new PulseNotFoundError();
  }
  if (!response.ok) {
    const code = record(body) && typeof body.error === "string" ? body.error : "";
    throw new Error(pulseErrorMessage(code, response.status));
  }
  return body;
}

function functionUrl(
  directoryApiUrl: string,
  functionName: string,
  params: Record<string, string>,
): string {
  const url = new URL(directoryFunctionUrl(directoryApiUrl, functionName));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function fetchPulseOverview(
  directoryApiUrl: string,
  query: { readonly sort: OverviewSort; readonly search: string },
): Promise<PulseOverview> {
  const body = await getJson(
    functionUrl(directoryApiUrl, "getPulseOverview", {
      sort: query.sort,
      search: query.search,
    }),
  );
  return parsePulseOverview(body);
}

export async function fetchPulseDomain(
  directoryApiUrl: string,
  query: { readonly domain: string; readonly sort: UrlSort },
): Promise<PulseDomainPage> {
  const body = await getJson(
    functionUrl(directoryApiUrl, "getPulseDomain", {
      domain: query.domain,
      sort: query.sort,
    }),
  );
  return parsePulseDomain(body);
}

export async function fetchPulseActivity(
  directoryApiUrl: string,
  query: { readonly days: ActivityDays; readonly domain: string },
): Promise<PulseActivity> {
  const body = await getJson(
    functionUrl(directoryApiUrl, "listPulseActivity", {
      days: String(query.days),
      domain: query.domain,
    }),
  );
  return parsePulseActivity(body);
}

export async function fetchUrlEvents(
  directoryApiUrl: string,
  urlKey: string,
): Promise<UrlEvents> {
  const body = await getJson(
    functionUrl(directoryApiUrl, "listUrlEvents", {
      key: urlKey,
      limit: String(EVENT_LIMIT),
    }),
  );
  return parseUrlEvents(body);
}

export async function fetchDisplayProfiles(
  directoryApiUrl: string,
  pubkeys: readonly string[],
): Promise<DisplayProfile[]> {
  if (pubkeys.length === 0 || pubkeys.length > PROFILE_LIMIT) {
    throw new Error("Web Pulse could not be loaded.");
  }
  const body = await getJson(
    functionUrl(directoryApiUrl, "lookupNostrProfiles", {
      pubkeys: pubkeys.join(","),
      view: "display",
    }),
  );
  return parseDisplayProfiles(body);
}
