// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  DOMAIN_COLLECTION,
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
    const state = { orders: [], max: Infinity, after: null };
    const api = {
      orderBy(field, direction = "asc") {
        state.orders.push([field, direction]);
        return api;
      },
      limit(max) {
        state.max = max;
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
      return {
        doc: (id) => ref(`${name}/${id}`),
        orderBy: (field, direction) => query(name).orderBy(field, direction),
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
  it("folds visible URLs into the domain and site, then skips them on the next run", async () => {
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
    expect(second.urls).toBe(0);
    expect(db.docs.get(`${SWEEP_STATE_COLLECTION}/${ROLLUP_DOC_ID}`).likeCount).toBe(3);
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
});
