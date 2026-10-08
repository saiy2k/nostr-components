// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { rebuildDomain } from "./hide.js";
import {
  DOMAIN_COLLECTION,
  PULSE_LEASE_DOC_ID,
  ROLLUP_DOC_ID,
  SWEEP_STATE_COLLECTION,
  projectUrl,
  runRollup,
} from "./rollup.js";
import { URL_ACTIVITY_COLLECTION } from "./ingest.js";

function memoryDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  function ref(path) {
    return {
      path,
      id: path.split("/").pop(),
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
  function rows(collection) {
    const prefix = `${collection}/`;
    return [...docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, data]) => ({ id: path.slice(prefix.length), data }));
  }
  function query(collection) {
    const state = { orders: [], max: Infinity, after: null, at: null };
    const api = {
      orderBy(field, direction = "asc") {
        state.orders.push([field, direction]);
        return api;
      },
      limit(max) {
        state.max = max;
        return api;
      },
      startAt(updatedAt) {
        state.at = updatedAt;
        return api;
      },
      startAfter(updatedAt, id) {
        state.after = [updatedAt, id];
        return api;
      },
      async get() {
        let list = rows(collection).filter((row) => row.data.updatedAt != null);
        list.sort((left, right) => {
          const delta = Number(left.data.updatedAt) - Number(right.data.updatedAt);
          if (delta) return delta;
          return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        });
        if (state.at != null) {
          list = list.filter((row) => row.data.updatedAt >= state.at);
        }
        if (state.after) {
          const [updatedAt, id] = state.after;
          list = list.filter(
            (row) =>
              row.data.updatedAt > updatedAt ||
              (row.data.updatedAt === updatedAt && row.id > id),
          );
        }
        return {
          docs: list.slice(0, state.max).map((row) => ({
            id: row.id,
            data: () => ({ ...row.data }),
          })),
        };
      },
    };
    return api;
  }
  return {
    docs,
    collection(name) {
      const prefix = `${name}/`;
      return {
        doc: (id) => ref(`${name}/${id}`),
        orderBy: (field, direction) => query(name).orderBy(field, direction),
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

function url(id, fields) {
  return [`${URL_ACTIVITY_COLLECTION}/${id}`, { domain: "x.com", ...fields }];
}

describe("projectUrl", () => {
  it("adds a visible URL once and ignores a second pass", () => {
    const domain = {
      domain: "x.com",
      urlCount: 0,
      hidden: false,
      inSiteTotals: false,
      lastActivityAt: null,
    };
    const first = projectUrl(domain, { domainCount: 0 }, {
      hidden: false,
      likeCount: 2,
      lastActivityAt: 10,
    });
    expect(first.domain).toMatchObject({
      urlCount: 1,
      likeCount: 2,
      inSiteTotals: true,
      lastActivityAt: 10,
    });
    expect(first.site).toMatchObject({ domainCount: 1, likeCount: 2 });
    expect(first.url.inRollup).toBe(true);

    const again = projectUrl(
      first.domain,
      first.site,
      { hidden: false, likeCount: 2, lastActivityAt: 10, ...first.url },
    );
    expect(again.domain.likeCount).toBe(2);
    expect(again.site.likeCount).toBe(2);
    expect(again.site.domainCount).toBe(1);
  });

  it("keeps a hidden URL at a zero snapshot", () => {
    const projected = projectUrl(
      { domain: "x.com", urlCount: 0, hidden: false, inSiteTotals: false },
      { domainCount: 0 },
      { hidden: true, likeCount: 9, inRollup: false },
    );
    expect(projected.domain.likeCount).toBe(0);
    expect(projected.domain.urlCount).toBe(0);
    expect(projected.site.likeCount).toBe(0);
    expect(projected.url).toEqual({
      inRollup: false,
      markerEpoch: 0,
      stagedEpoch: 0,
      rolledUp: {
        likeCount: 0,
        dislikeCount: 0,
        emojiCount: 0,
        reactionCount: 0,
        zapCount: 0,
        zapMsats: 0,
      },
    });
  });
});

describe("runRollup", () => {
  it("folds visible URLs into the domain and site, then leaves totals unchanged", async () => {
    const db = memoryDb(Object.fromEntries([
      url("a", { updatedAt: 1, likeCount: 2, reactionCount: 2, lastActivityAt: 10 }),
      url("b", { updatedAt: 2, likeCount: 9, reactionCount: 9, hidden: true, lastActivityAt: 50 }),
      url("c", { updatedAt: 3, likeCount: 1, reactionCount: 1, lastActivityAt: 12, domain: "news.example" }),
    ]));
    const waits = [];
    const first = await runRollup(db, {
      pageSize: 10,
      batchSize: 2,
      paceMs: 1000,
      sleep: async (ms) => waits.push(ms),
    });
    expect(waits).toEqual([1000]);
    expect(first.urls).toBe(3);
    expect(first.cursorId).toBe("c");
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`)).toMatchObject({
      urlCount: 1,
      likeCount: 2,
      inSiteTotals: true,
      lastActivityAt: 10,
    });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/news.example`)).toMatchObject({
      urlCount: 1,
      likeCount: 1,
    });
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`)).toMatchObject({
      domainCount: 2,
      likeCount: 3,
      cursorId: "c",
    });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/b`).inRollup).toBe(false);
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).updatedAt).toBe(1);

    const second = await runRollup(db, { pageSize: 10, batchSize: 2, paceMs: 0 });
    expect(second).toMatchObject({ urls: 1, cursorId: "c", likeCount: 3 });
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).likeCount).toBe(3);
  });

  it("includes a URL that shares the cursor timestamp and sorts before the cursor id", async () => {
    const rolled = {
      likeCount: 1,
      dislikeCount: 0,
      emojiCount: 0,
      reactionCount: 1,
      zapCount: 0,
      zapMsats: 0,
    };
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/m`]: {
        domain: "x.com",
        updatedAt: 5,
        likeCount: 1,
        reactionCount: 1,
        inRollup: true,
        rolledUp: rolled,
      },
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 5,
        likeCount: 4,
        reactionCount: 4,
      },
      [`${DOMAIN_COLLECTION}/x.com`]: {
        domain: "x.com",
        urlCount: 1,
        likeCount: 1,
        reactionCount: 1,
        hidden: false,
        inSiteTotals: true,
      },
      [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
        domainCount: 1,
        likeCount: 1,
        reactionCount: 1,
        cursorUpdatedAt: 5,
        cursorId: "m",
      },
    });
    const result = await runRollup(db, { paceMs: 0, pageSize: 1 });
    expect(result).toMatchObject({ likeCount: 5, cursorId: "m" });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).inRollup).toBe(true);
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`).likeCount).toBe(5);
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).domainCount).toBe(1);
  });

  it("skips the rollup while a rebuild holds the lease", async () => {
    const nowMs = Date.parse("2026-10-08T00:00:00.000Z");
    const db = memoryDb({
      [`${SWEEP_STATE_COLLECTION}/${PULSE_LEASE_DOC_ID}`]: {
        owner: "rebuild",
        token: "rebuild:held",
        until: new Date(nowMs + 60_000).toISOString(),
      },
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 1,
        likeCount: 3,
        reactionCount: 3,
      },
    });
    const result = await runRollup(db, { paceMs: 0, nowMs, leaseAttempts: 1 });
    expect(result).toMatchObject({ skipped: true, urls: 0 });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).inRollup).toBeUndefined();
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${PULSE_LEASE_DOC_ID}`).token).toBe(
      "rebuild:held",
    );
  });

  it("stops after the lease token changes and leaves the new holder's lease in place", async () => {
    const nowMs = Date.parse("2026-10-08T00:00:00.000Z");
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 1,
        likeCount: 1,
        reactionCount: 1,
      },
      [`${URL_ACTIVITY_COLLECTION}/b`]: {
        domain: "x.com",
        updatedAt: 2,
        likeCount: 4,
        reactionCount: 4,
      },
    });
    const result = await runRollup(db, {
      paceMs: 1,
      pageSize: 10,
      batchSize: 1,
      nowMs,
      leaseMs: 60_000,
      sleep: async () => {
        db.docs.set(`${SWEEP_STATE_COLLECTION}/${PULSE_LEASE_DOC_ID}`, {
          owner: "rebuild",
          token: "rebuild:other",
          until: new Date(nowMs + 60_000).toISOString(),
        });
      },
    });
    expect(result).toMatchObject({ skipped: true, reason: "pulse-lease-lost" });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).inRollup).toBe(true);
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/b`).inRollup).toBeUndefined();
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${PULSE_LEASE_DOC_ID}`).token).toBe(
      "rebuild:other",
    );
  });

  it("leaves a hidden domain out of the site-wide totals", async () => {
    const db = memoryDb({
      [`${DOMAIN_COLLECTION}/x.com`]: {
        domain: "x.com",
        hidden: true,
        inSiteTotals: false,
        urlCount: 0,
      },
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 1,
        likeCount: 5,
        reactionCount: 5,
      },
    });
    await runRollup(db, { paceMs: 0 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`)).toMatchObject({
      likeCount: 5,
      urlCount: 1,
      hidden: true,
      inSiteTotals: false,
    });
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`)).toMatchObject({
      likeCount: 0,
      domainCount: 0,
    });
  });

  it("does not apply a rebuilt URL twice while its live marker is still old", async () => {
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 1,
        likeCount: 5,
        reactionCount: 5,
        lastActivityAt: 4,
      },
      [`${DOMAIN_COLLECTION}/x.com`]: {
        domain: "x.com",
        urlCount: 1,
        likeCount: 1,
        reactionCount: 1,
        hidden: false,
        inSiteTotals: true,
      },
      [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
        domainCount: 1,
        likeCount: 1,
        reactionCount: 1,
      },
    });
    await rebuildDomain(db, "x.com");
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`)).toMatchObject({
      likeCount: 5,
      markerEpoch: 1,
    });
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).rolledUp).toBeUndefined();
    await runRollup(db, { paceMs: 0 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`).likeCount).toBe(5);
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).likeCount).toBe(5);
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`)).toMatchObject({
      inRollup: true,
      markerEpoch: 1,
      stagedEpoch: 0,
    });
  });

  it("keeps the sweep on the live marker when rebuild totals do not commit", async () => {
    const rolled = {
      likeCount: 1,
      dislikeCount: 0,
      emojiCount: 0,
      reactionCount: 1,
      zapCount: 0,
      zapMsats: 0,
    };
    const db = memoryDb({
      [`${URL_ACTIVITY_COLLECTION}/a`]: {
        domain: "x.com",
        updatedAt: 1,
        likeCount: 5,
        reactionCount: 5,
        inRollup: true,
        rolledUp: rolled,
      },
      [`${DOMAIN_COLLECTION}/x.com`]: {
        domain: "x.com",
        urlCount: 1,
        likeCount: 1,
        reactionCount: 1,
        hidden: false,
        inSiteTotals: true,
      },
      [`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`]: {
        domainCount: 1,
        likeCount: 1,
        reactionCount: 1,
      },
    });
    const original = db.runTransaction.bind(db);
    db.runTransaction = async (fn) => original(async (tx) => {
      const set = tx.set.bind(tx);
      tx.set = (target, data, options) => {
        if (data?.markerEpoch > 0 && data?.domain === "x.com") throw new Error("totals-failed");
        return set(target, data, options);
      };
      return fn(tx);
    });
    await expect(rebuildDomain(db, "x.com", { attempts: 1 })).rejects.toThrow("totals-failed");
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`)).toMatchObject({ likeCount: 1 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`).markerEpoch).toBeUndefined();
    expect(db.docs.get(`${URL_ACTIVITY_COLLECTION}/a`).rolledUp).toEqual(rolled);
    db.runTransaction = original;
    await runRollup(db, { paceMs: 0 });
    expect(db.docs.get(`${DOMAIN_COLLECTION}/x.com`).likeCount).toBe(5);
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).likeCount).toBe(5);
  });
});
