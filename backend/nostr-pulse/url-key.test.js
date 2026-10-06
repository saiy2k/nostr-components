// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { bech32 } from "@scure/base";
import { describe, expect, it } from "vitest";
import { normalizeURL as legacyLikeUrl } from "nostr-tools/utils";
import { canonicalUrl, urlKey } from "./url-key.js";

function legacyZapUrl(raw) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^(m|mobile)\./, "");
  const port = url.port ? `:${url.port}` : "";
  const pathname = url.pathname.replace(/\/+/g, "/").replace(/\/*$/, "");
  return `https://${host}${port}${pathname}${url.search}`;
}

function expectSharedIdentity(raw, expected) {
  expect(canonicalUrl(raw)).toBe(expected);
  expect(canonicalUrl(expected)).toBe(expected);
  expect(canonicalUrl(legacyLikeUrl(raw))).toBe(expected);
  expect(canonicalUrl(legacyZapUrl(raw))).toBe(expected);
}

describe("canonicalUrl", () => {
  it("agrees with both older normalizers", () => {
    expectSharedIdentity("https://example.com/", "https://example.com");
    expectSharedIdentity("https://example.com", "https://example.com");
    expectSharedIdentity("http://m.example.com/a", "https://example.com/a");
    expectSharedIdentity("http://mobile.example.com/a/", "https://example.com/a");
    expectSharedIdentity(
      "http://m.mobile.example.com/a",
      "https://example.com/a",
    );
    expectSharedIdentity(
      "https://example.com/a?b=2&a=1",
      "https://example.com/a?a=1&b=2",
    );
    expectSharedIdentity(
      "https://example.com/a?x=1&x=2&b=1",
      "https://example.com/a?b=1&x=1&x=2",
    );
    expectSharedIdentity(
      "https://Example.COM/Foo?q=Ab#hash",
      "https://example.com/Foo?q=Ab",
    );
    expectSharedIdentity("https://example.com//a///b/", "https://example.com/a/b");
    expectSharedIdentity("http://example.com:80/a", "https://example.com/a");
    expectSharedIdentity("https://example.com:443/a", "https://example.com/a");
    expectSharedIdentity("https://example.com:80/a", "https://example.com:80/a");
    expectSharedIdentity(
      "https://user:pass@example.com/a",
      "https://example.com/a",
    );
    expectSharedIdentity("http://[::1]:8080/a", "https://[::1]:8080/a");
  });

  it("canonicalizes X and Twitter status URLs", () => {
    const expected = "https://x.com/jack/status/123";
    for (const host of [
      "x.com",
      "www.x.com",
      "m.x.com",
      "mobile.x.com",
      "twitter.com",
      "www.twitter.com",
      "m.twitter.com",
      "mobile.twitter.com",
    ]) {
      expectSharedIdentity(
        `https://${host}/Jack/status/123?s=20#photo`,
        expected,
      );
    }
  });

  it("canonicalizes YouTube watch, Shorts, and youtu.be URLs", () => {
    const expected = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expectSharedIdentity(
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=43",
      expected,
    );
    expectSharedIdentity(
      "https://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      expected,
    );
    expectSharedIdentity("https://youtu.be/dQw4w9WgXcQ", expected);
    expectSharedIdentity(
      "http://www.youtube.com/shorts/dQw4w9WgXcQ/",
      expected,
    );
  });

  it("leaves a YouTube URL with a short id on the generic path", () => {
    expect(canonicalUrl("https://www.youtube.com/watch?v=short")).toBe(
      "https://www.youtube.com/watch?v=short",
    );
  });

  it("returns null for non-http URLs, including NIP-73 identifiers", () => {
    expect(canonicalUrl("isbn:9780131103627")).toBeNull();
    expect(canonicalUrl("geo:37.78,-122.41")).toBeNull();
    expect(canonicalUrl("wss://relay.damus.io")).toBeNull();
    expect(canonicalUrl("not a url")).toBeNull();
    expect(canonicalUrl("")).toBeNull();
  });
});

describe("urlKey", () => {
  it("is the sha256 of the canonical URL", () => {
    expect(urlKey("https://twitter.com/Jack/status/123?s=1")).toBe(
      "ef553a8af8cf4ce81ec85ef59d668f1840cd5ac188a51562b154b779974c0723",
    );
    expect(urlKey("https://example.com/")).toBe(
      "100680ad546ce6a577f42f52df33b4cfdca756859e664b8d7de329b150d09ce9",
    );
    expect(urlKey("https://example.com/")).toBe(
      createHash("sha256").update("https://example.com").digest("hex"),
    );
  });

  it("returns null when there is no canonical URL", () => {
    expect(urlKey("geo:1,2")).toBeNull();
  });
});
