// SPDX-License-Identifier: MIT

const STATUS_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "m.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "m.twitter.com",
  "mobile.twitter.com",
]);
const STATUS_PATH = /^\/([^/]+)\/status\/(\d+)\/?$/;
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function stripMobileHost(hostname) {
  let host = hostname;
  let previous;
  do {
    previous = host;
    host = host.replace(/^(?:m|mobile)\./, "");
  } while (host !== previous);
  return host;
}

function canonicalStatus(url) {
  if (!STATUS_HOSTS.has(url.hostname)) return null;
  const match = url.pathname.match(STATUS_PATH);
  if (!match) return null;
  return `https://x.com/${match[1].toLowerCase()}/status/${match[2]}`;
}

function canonicalVideo(url) {
  let videoId = null;
  if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else if (
    YOUTUBE_HOSTS.has(url.hostname) &&
    url.pathname.startsWith("/shorts/")
  ) {
    videoId = url.pathname.split("/")[2] || null;
  } else if (url.hostname === "youtu.be") {
    videoId = url.pathname.split("/")[1] || null;
  }
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function canonicalGeneric(url) {
  const host = stripMobileHost(url.hostname);
  if (!host) return null;
  const port = url.port ? `:${url.port}` : "";
  const pathname = url.pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
  const params = new URLSearchParams(url.search);
  params.sort();
  const query = params.toString();
  return `https://${host}${port}${pathname}${query ? `?${query}` : ""}`;
}

/**
 * The one page identity shared by likes, zaps, and the URL key.
 * Returns null for anything other than an http(s) URL.
 * This file stays free of Node builtins so the component bundle can import it.
 */
export function canonicalUrl(raw) {
  if (typeof raw !== "string" || !raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return canonicalStatus(url) || canonicalVideo(url) || canonicalGeneric(url);
}
