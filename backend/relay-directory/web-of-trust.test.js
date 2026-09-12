// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  DEFAULT_WOT_THRESHOLDS,
  WOT_SIGNAL_WEIGHTS,
  evaluateWebOfTrust,
  trustFieldsFromEvaluation,
  wotRejectsIdentity,
} from "./web-of-trust.js";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const daysAgo = (days) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function xProfile(overrides = {}) {
  return {
    handle: "alice",
    displayName: "Alice",
    description: "Bitcoin developer",
    followers: 5000,
    following: 400,
    tweets: 3000,
    createdAt: daysAgo(2000),
    ...overrides,
  };
}

function nostrMetadata(overrides = {}) {
  return {
    name: "Alice",
    about: "Building on Nostr",
    nip05: "alice@example.com",
    lud16: "alice@example.com",
    ...overrides,
  };
}

describe("web-of-trust outcomes", () => {
  it("accepts an established, mutually linked identity pair", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile(),
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    });

    expect(evaluation.status).toBe("accepted");
    expect(evaluation.score).toBeGreaterThanOrEqual(
      DEFAULT_WOT_THRESHOLDS.acceptScore,
    );
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining([
        "mutual_identity_link",
        "x_account_established",
        "x_followers_strong",
        "nostr_nip05_present",
      ]),
    );
    expect(evaluation.bothProfilesScamRisk).toBe(false);
  });

  it("rejects a pair when both profiles carry scam signals", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile({
        handle: "wallet_support",
        displayName: "Wallet Support",
        description: "DM for wallet recovery. Send your seed phrase.",
        followers: 3,
        following: 9000,
        tweets: 1,
        createdAt: daysAgo(5),
      }),
      nostrMetadata: nostrMetadata({
        name: "Nostr Support Desk",
        about: "Free bitcoin giveaway, DM to claim now",
        nip05: "",
        lud16: "",
      }),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    });

    expect(evaluation.status).toBe("rejected");
    expect(evaluation.bothProfilesScamRisk).toBe(true);
    expect(evaluation.reasons[0]).toBe("both_profiles_scam_risk");
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining(["x_bio_scam_phrase", "nostr_about_scam_phrase"]),
    );
  });

  it("rejects on score alone when only one side looks like a scam", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile({
        handle: "freebtcnow",
        displayName: "Free BTC",
        description: "Free bitcoin airdrop, DM for details",
        followers: 4,
        following: 9000,
        tweets: 1,
        createdAt: daysAgo(3),
      }),
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    });

    expect(evaluation.status).toBe("rejected");
    expect(evaluation.bothProfilesScamRisk).toBe(false);
    expect(evaluation.score).toBeLessThanOrEqual(
      DEFAULT_WOT_THRESHOLDS.rejectScore,
    );
  });

  it("reports unavailable when the X profile could not be fetched", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: null,
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: false, nostrProfileLinksHandle: true },
      now: NOW,
    });

    expect(evaluation).toMatchObject({
      status: "unavailable",
      score: 0,
      reasons: ["x_profile_unavailable"],
      signals: [],
    });
    expect(evaluation.inputs.xProfile).toBe(false);
  });

  it("reports ambiguous for an assessable but inconclusive pair", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile({
        description: "hello",
        followers: 40,
        following: 30,
        tweets: 20,
        createdAt: daysAgo(150),
      }),
      nostrMetadata: { name: "Bob", about: "hi" },
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: false },
      now: NOW,
    });

    expect(evaluation.status).toBe("ambiguous");
    expect(evaluation.score).toBeGreaterThan(
      DEFAULT_WOT_THRESHOLDS.rejectScore,
    );
    expect(evaluation.score).toBeLessThan(DEFAULT_WOT_THRESHOLDS.acceptScore);
  });

  it("treats a missing Nostr profile as an empty one rather than failing", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile(),
      nostrMetadata: null,
      linkage: {},
      now: NOW,
    });

    expect(evaluation.reasons).toContain("nostr_profile_empty");
    expect(evaluation.inputs.nostrMetadata).toBe(false);
    expect(evaluation.status).toBe("accepted");
  });

  it("never throws on malformed input", () => {
    expect(() => evaluateWebOfTrust()).not.toThrow();
    expect(
      evaluateWebOfTrust({
        xProfile: { followers: "many", createdAt: "not-a-date" },
        nostrMetadata: "nonsense",
      }).status,
    ).toBe("unavailable");
  });
});

describe("web-of-trust scoring rules", () => {
  it("produces identical results for identical inputs", () => {
    const input = {
      xProfile: xProfile(),
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    };

    expect(evaluateWebOfTrust(input)).toEqual(evaluateWebOfTrust(input));
  });

  it("sums the documented signal weights", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile(),
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    });
    const expected = evaluation.signals.reduce(
      (total, signal) => total + WOT_SIGNAL_WEIGHTS[signal.id].weight,
      0,
    );

    expect(evaluation.score).toBe(expected);
  });

  it("caps repeated scam phrases at the configured penalty", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile({
        description:
          "giveaway airdrop seed phrase double your bitcoin guaranteed returns",
      }),
      nostrMetadata: nostrMetadata(),
      linkage: {},
      now: NOW,
      thresholds: { maxPhrasePenalty: 4 },
    });
    const phrasePenalty = evaluation.signals
      .filter((signal) => signal.id === "x_bio_scam_phrase")
      .reduce((total, signal) => total + signal.weight, 0);

    expect(phrasePenalty).toBe(-4);
  });

  it("honours threshold overrides", () => {
    const input = {
      xProfile: xProfile({ followers: 40, following: 30, tweets: 20 }),
      nostrMetadata: { name: "Bob" },
      linkage: {},
      now: NOW,
    };

    expect(evaluateWebOfTrust(input).status).toBe("accepted");
    expect(
      evaluateWebOfTrust({ ...input, thresholds: { acceptScore: 99 } }).status,
    ).toBe("ambiguous");
  });

  it("credits an account age only once per bucket", () => {
    const evaluation = evaluateWebOfTrust({
      xProfile: xProfile({ createdAt: daysAgo(120) }),
      nostrMetadata: nostrMetadata(),
      linkage: {},
      now: NOW,
    });
    const ageSignals = evaluation.signals.filter((signal) =>
      signal.id.startsWith("x_account_"),
    );

    expect(ageSignals).toHaveLength(1);
    expect(ageSignals[0].id).toBe("x_account_mature");
  });
});

describe("web-of-trust enforcement modes", () => {
  const rejected = evaluateWebOfTrust({
    xProfile: xProfile({
      description: "free bitcoin giveaway, dm for details",
      followers: 2,
      following: 8000,
      tweets: 0,
      createdAt: daysAgo(2),
    }),
    nostrMetadata: { about: "airdrop giveaway, dm to claim" },
    linkage: {},
    now: NOW,
  });

  it("only rejects an identity in enforce mode", () => {
    expect(rejected.status).toBe("rejected");
    expect(wotRejectsIdentity(rejected, "enforce")).toBe(true);
    expect(wotRejectsIdentity(rejected, "flag")).toBe(false);
    expect(wotRejectsIdentity(rejected, "off")).toBe(false);
  });

  it("never rejects an accepted or ambiguous evaluation", () => {
    const accepted = evaluateWebOfTrust({
      xProfile: xProfile(),
      nostrMetadata: nostrMetadata(),
      linkage: { xBioLinksPubkey: true, nostrProfileLinksHandle: true },
      now: NOW,
    });

    expect(wotRejectsIdentity(accepted, "enforce")).toBe(false);
    expect(wotRejectsIdentity(null, "enforce")).toBe(false);
  });

  it("collapses an evaluation into bounded persistable fields", () => {
    const fields = trustFieldsFromEvaluation(rejected, "flag");

    expect(fields).toMatchObject({
      trustStatus: "rejected",
      trustScore: rejected.score,
      trustMode: "flag",
      trustEvaluatedAt: NOW.toISOString(),
    });
    expect(fields.trustReasons.length).toBeLessThanOrEqual(20);
    expect(trustFieldsFromEvaluation(null)).toEqual({});
  });
});
