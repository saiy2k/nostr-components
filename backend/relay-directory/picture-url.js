// SPDX-License-Identifier: MIT

const PICTURE_MAX_LENGTH = 2000;
const TWITTER_AVATAR_HOST = "pbs.twimg.com";
const TWITTER_SMALL_SUFFIX = /_(?:normal|bigger|mini)(\.[a-z0-9]+)$/i;

export function httpsPictureUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > PICTURE_MAX_LENGTH) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;
  const serialized = url.toString();
  if (
    !serialized.startsWith("https://") ||
    serialized.length > PICTURE_MAX_LENGTH
  ) {
    return null;
  }
  return serialized;
}

export function upgradeTwitterAvatarUrl(value) {
  const picture = httpsPictureUrl(value);
  if (!picture) return null;
  const url = new URL(picture);
  if (url.hostname !== TWITTER_AVATAR_HOST) return picture;
  const nextPath = url.pathname.replace(TWITTER_SMALL_SUFFIX, "_200x200$1");
  if (nextPath === url.pathname) return picture;
  url.pathname = nextPath;
  return httpsPictureUrl(url.toString());
}

export async function fetchXAvatarUrl(handle, options = {}) {
  const normalized = String(handle || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) return null;
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || 5000;
  try {
    const response = await fetchImpl(
      `https://api.fxtwitter.com/2/profile/${encodeURIComponent(normalized)}`,
      {
        headers: { "User-Agent": "nostr-components-relay-directory/0.1" },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return null;
    const json = await response.json();
    if (Number(json?.code) !== 200) return null;
    const screenName = String(json?.user?.screen_name || "").toLowerCase();
    if (!json?.user?.id || screenName !== normalized) return null;
    return upgradeTwitterAvatarUrl(json.user.avatar_url);
  } catch (error) {
    options.onError?.(error, normalized);
    return null;
  }
}
