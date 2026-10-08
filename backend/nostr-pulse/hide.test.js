// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { URL_ACTIVITY_COLLECTION } from "./ingest.js";
import {
  parseHideArgs,
  parseHideTarget,
  rebuildDomain,
  rollupMarkerForRebuild,
  setTargetHidden,
} from "./hide.js";
import {
  DOMAIN_COLLECTION,
  PULSE_LEASE_DOC_ID,
  ROLLUP_DOC_ID,
  SWEEP_STATE_COLLECTION,
} from "./rollup.js";

const PAGE = parseHideTarget("https://example.com/a");
const KEY = PAGE.urlKey;

function memoryDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  function ref(path) {
    return {
      async get() {
        return {
          exists: docs.has(path),
          id: path.split("/").pop(),
          data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
        };
      },
      async set(data, options) {
        const prev = docs.get(path) || {};
        docs.set(path, options?.merge ? { ...prev, ...data } : { ...data });
      },
    };
  }
  return {
    docs,
    collection(name) {
      const prefix = `${name}/`;
      return {
        doc: (id) => ref(`${name}/${id}`),
        where(field, op, value) {
          return {
            async get() {
              const docsOut = [...docs.entries()]
                .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
                .filter(([, data]) => op === "==" && data[field] === value)
                .map(([path, data]) => ({
                  id: path.slice(prefix.length),
                  data: () => ({ ...data }),
                }));
              return { docs: docsOut };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (target) => target.get(),
        set: (target, data, options) => target.set(data, options),
      });
    },
  };
}

function seeded() {
  return memoryDb({
    [`${URL_ACTIVITY_COLLECTION}/${KEY}`]: {
      url: "https://example.com/a",
      domain: "example.com",
      likeCount: 4,
      reactionCount: 4,
      zapMsats: 3000,
      lastActivityAt: 20,
      inRollup: true,
      rolledUp: { likeCount: 4, dislikeCount: 0, emojiCount: 0, reactionCount: 4, zapCount: 0, zapMsats: 3000 },
    },
    [`${DOMAIN_COLLECTION}/example.com`]: {
      domain: "example.com",
      urlCount: 1,
      likeCount: 4,
      reactionCount: 4,
      zapMsats: 3000,
      lastActivityAt: 20,
      hidden: false,
      inSiteTotals: true,
    },
    [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
      domainCount: 1,
      likeCount: 4,
      reactionCount: 4,
      zapMsats: 3000,
      cursorUpdatedAt: 5,
      cursorId: KEY,
    },
  });
}

describe("hide targets", () => {
  it("parses a URL and a domain, and keeps rebuild separate from show", () => {
    const page = parseHideTarget("https://example.com/a/");
    const again = parseHideTarget("https://example.com/a");
    expect(page).toMatchObject({ type: "url", domain: "example.com" });
    expect(page.urlKey).toBe(again.urlKey);
    expect(parseHideTarget("WWW.Example.com")).toEqual({ type: "domain", domain: "example.com" });
    expect(parseHideArgs(["--rebuild", "example.com"])).toMatchObject({
      rebuild: true,
      show: false,
      target: "example.com",
    });
    expect(parseHideArgs(["--rebuild", "--show", "example.com"]).error).toBe("rebuild-or-show");
    expect(parseHideArgs(["--shwo", "example.com"]).error).toBe("unknown-flag:--shwo");
    expect(parseHideArgs(["--", "example.com"])).toMatchObject({
      show: false,
      rebuild: false,
      target: "example.com",
    });
  });
});

describe("setTargetHidden activity time", () => {
  it("moves the domain activity time to the newest URL that stays visible", async () => {
    const other = "cd".repeat(32);
    const db = seeded();
    db.docs.set(`${URL_ACTIVITY_COLLECTION}/${other}`, {
      url: "https://example.com/b",
      domain: "example.com",
      likeCount: 1,
      reactionCount: 1,
      lastActivityAt: 8,
      hidden: false,
      inRollup: true,
      rolledUp: { likeCount: 1, dislikeCount: 0, emojiCount: 0, reactionCount: 1, zapCount: 0, zapMsats: 0 },
    });
    db.docs.set(`${URL_ACTIVITY_COLLECTION}/${KEY}`, {
      ...db.docs.get(`${URL_ACTIVITY_COLLECTION}/${KEY}`),
      lastActivityAt: 50,
    });
    db.docs.set(`${DOMAIN_COLLECTION}/example.com`, {
      ...db.docs.get(`${DOMAIN_COLLECTION}/example.com`),
      lastActivityAt: 50,
      likeCount: 5,
      reactionCount: 5,
      urlCount: 2,
    });
    await setTargetHidden(db, PAGE, true);
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`).lastActivityAt).toBe(8);
  });
});

describe("rollup markers", () => {
  it("keeps a marker when visibility is unchanged and skips it when hide wins the race", () => {
    const snapshot = { hidden: false, likeCount: 4, reactionCount: 4 };
    expect(rollupMarkerForRebuild(snapshot, { hidden: false, likeCount: 9 })).toMatchObject({
      inRollup: true,
      rolledUp: { likeCount: 4, reactionCount: 4 },
    });
    expect(rollupMarkerForRebuild(snapshot, { hidden: true, likeCount: 4 })).toBeNull();
  });
});

describe("setTargetHidden", () => {
  it("takes a URL out of the domain and site totals and puts the same amounts back", async () => {
    const db = seeded();
    const hidden = await setTargetHidden(db, PAGE, true);
    expect(hidden.ok).toBe(true);
    expect(hidden.likeCount).toBe(0);
    expect(hidden.domainCount).toBe(0);
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/${KEY}`)).toMatchObject({
      hidden: true,
      inRollup: false,
    });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`)).toMatchObject({
      urlCount: 0,
      likeCount: 0,
      zapMsats: 0,
    });
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).cursorId).toBe(KEY);

    const shown = await setTargetHidden(db, PAGE, false);
    expect(shown).toMatchObject({ ok: true, likeCount: 4, zapMsats: 3000, domainCount: 1 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`).urlCount).toBe(1);
  });

  it("hides a domain from the site totals and keeps the domain's own numbers", async () => {
    const db = seeded();
    const hidden = await setTargetHidden(db, { type: "domain", domain: "example.com" }, true);
    expect(hidden).toMatchObject({ ok: true, domainCount: 0, likeCount: 0 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`)).toMatchObject({
      hidden: true,
      inSiteTotals: false,
      likeCount: 4,
      urlCount: 1,
    });
    const shown = await setTargetHidden(db, { type: "domain", domain: "example.com" }, false);
    expect(shown).toMatchObject({ domainCount: 1, likeCount: 4 });
  });
});

describe("rebuildDomain", () => {
  it("refuses to rebuild while the sweep rollup holds the lease", async () => {
    const nowMs = Date.parse("2026-10-08T00:00:00.000Z");
    const db = memoryDb({
      [`${SWEEP_STATE_COLLECTION}/${PULSE_LEASE_DOC_ID}`]: {
        owner: "rollup",
        token: "rollup:held",
        until: new Date(nowMs + 60_000).toISOString(),
      },
    });
    await expect(
      rebuildDomain(db, "example.com", { attempts: 1, nowMs }),
    ).rejects.toThrow("pulse-lease-held");
  });

  it("rebuilds a domain from its visible URLs and corrects the site totals", async () => {
    const other = "cd".repeat(32);
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/${KEY}`]: {
        domain: "example.com",
        hidden: false,
        likeCount: 2,
        reactionCount: 2,
        lastActivityAt: 8,
      },
      [`${URL_ACTIVITY_COLLECTION}/${other}`]: {
        domain: "example.com",
        hidden: true,
        likeCount: 100,
        reactionCount: 100,
        lastActivityAt: 99,
      },
      [`${DOMAIN_COLLECTION}/example.com`]: {
        domain: "example.com",
        urlCount: 2,
        likeCount: 9,
        reactionCount: 9,
        hidden: false,
        inSiteTotals: true,
      },
      [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
        domainCount: 1,
        likeCount: 9,
        reactionCount: 9,
        cursorId: "keep",
      },
    });
    const result = await rebuildDomain(db, "example.com");
    expect(result).toMatchObject({ ok: true, likeCount: 2, domainCount: 1 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`)).toMatchObject({
      urlCount: 1,
      likeCount: 2,
      lastActivityAt: 8,
    });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`).markerEpoch).toBe(1);
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/${KEY}`)).toMatchObject({
      stagedInRollup: true,
      stagedEpoch: 1,
    });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/${other}`)).toMatchObject({
      stagedInRollup: false,
      stagedEpoch: 1,
    });
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).cursorId).toBe("keep");
  });

  it("hides a URL after a rebuild without putting the staged total back", async () => {
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/${KEY}`]: {
        domain: "example.com",
        hidden: false,
        likeCount: 2,
        reactionCount: 2,
        lastActivityAt: 8,
      },
      [`${DOMAIN_COLLECTION}/example.com`]: {
        domain: "example.com",
        urlCount: 0,
        likeCount: 9,
        reactionCount: 9,
        hidden: false,
        inSiteTotals: true,
      },
      [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
        domainCount: 1,
        likeCount: 9,
        reactionCount: 9,
      },
    });
    await rebuildDomain(db, "example.com");
    const hidden = await setTargetHidden(db, PAGE, true);
    expect(hidden).toMatchObject({ ok: true, likeCount: 0, domainCount: 0 });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/${KEY}`)).toMatchObject({
      hidden: true,
      inRollup: false,
      markerEpoch: 1,
      stagedEpoch: 0,
    });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/example.com`)).toMatchObject({
      likeCount: 0,
      urlCount: 0,
      markerEpoch: 1,
    });
  });
});
