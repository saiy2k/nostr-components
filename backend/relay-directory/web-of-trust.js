// SPDX-License-Identifier: MIT

/**
 * Web-of-Trust (WoT) scoring for linked X <-> Nostr identity pairs.
 *
 * Identifier validation (NIP-39 proof tweets, X bio `npub` / `nprofile` /
 * NIP-05 scanning) only proves that two identifiers point at each other. It
 * says nothing about whether the pair is trustworthy: a scammer controls both
 * halves of their own link. This module scores the pair from deterministic
 * profile signals so the projector can flag or reject scam pairs while leaving
 * identifier validation untouched.
 *
 * Inputs
 *   xProfile       Normalized X profile signals (see extractXProfileSignals in
 *                  x-identity.js): follower/following/tweet counts, account
 *                  creation time, bio text, handle and display name.
 *   nostrMetadata  The kind-0 profile snapshot stored on the claim: name,
 *                  about, nip05, lud16, website.
 *   linkage        How the two sides reference each other:
 *                  xBioLinksPubkey, nostrProfileLinksHandle, proofTweetVerified.
 *   now            Evaluation instant, used only for account-age buckets.
 *   thresholds     Overrides for DEFAULT_WOT_THRESHOLDS.
 *
 * Scoring
 *   Every rule below contributes a fixed weight. Rules are evaluated in a fixed
 *   order and the emitted signal list is sorted by id, so the same inputs always
 *   produce the same score, status and reason list.
 *
 * Decision
 *   unavailable  X profile signals are missing, so nothing can be assessed.
 *   rejected     Both sides emit a scam signal, or score <= rejectScore.
 *   accepted     score >= acceptScore.
 *   ambiguous    Anything in between: assessable, but not conclusive.
 *
 * Failure behavior
 *   The evaluation never throws on malformed input and never performs I/O.
 *   Missing or unparseable fields simply withhold their signals, which pushes
 *   the outcome toward `ambiguous` or `unavailable` rather than a false
 *   `accepted` or `rejected`.
 */

export const WOT_STATUS = Object.freeze({
  accepted: "accepted",
  rejected: "rejected",
  ambiguous: "ambiguous",
  unavailable: "unavailable",
});

export const WOT_MODES = Object.freeze(["off", "flag", "enforce"]);

export const DEFAULT_WOT_THRESHOLDS = Object.freeze({
  acceptScore: 3,
  rejectScore: -3,
  establishedAccountDays: 365,
  matureAccountDays: 90,
  newAccountDays: 30,
  strongFollowers: 1000,
  moderateFollowers: 100,
  negligibleFollowers: 10,
  establishedTweets: 50,
  negligibleTweets: 5,
  spammyFollowing: 500,
  spammyFollowRatio: 10,
  maxPhrasePenalty: 4,
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Scam phrasing shared by X bios and Nostr `about` fields. */
const SCAM_PHRASES = Object.freeze([
  { id: "giveaway", pattern: /\bgive\s?aways?\b/i },
  { id: "airdrop", pattern: /\bair\s?drops?\b/i },
  { id: "seed_phrase", pattern: /\b(?:seed|recovery)\s?phrases?\b|\bmnemonics?\b/i },
  {
    id: "multiply_funds",
    pattern:
      /\b(?:double|triple|[0-9]{1,3}x)\s+(?:your\s+)?(?:btc|bitcoin|sats|money|crypto|investment|portfolio)\b/i,
  },
  {
    id: "guaranteed_returns",
    pattern: /\bguaranteed\s+(?:profits?|returns?|roi|income)\b/i,
  },
  { id: "dm_solicitation", pattern: /\bdms?\s+(?:me\s+)?(?:for|to)\b/i },
  { id: "offsite_contact", pattern: /\b(?:whats\s?app|telegram|t\.me)\b/i },
  {
    id: "wallet_support",
    pattern:
      /\b(?:wallet|account|node|ledger)\s+(?:support|recovery|helpdesk|validation|sync)\b/i,
  },
  { id: "free_funds", pattern: /\bfree\s+(?:btc|bitcoin|sats|crypto|nfts?)\b/i },
  { id: "trading_signals", pattern: /\b(?:forex|binary\s+options?|trading\s+signals?)\b/i },
]);

/** Handle / display-name shapes used by impersonation and support scams. */
const IMPERSONATION_NAME =
  /(?:support|help\s?desk|helpline|customer\s?care|giveaway|air\s?drop|recovery\s?agent|wallet\s?admin)/i;

/**
 * Fixed weight table. Positive weights raise trust, negative weights lower it.
 * `side` identifies which profile produced the signal; `category` separates
 * scam indicators from merely weak ones, because a pair is rejected outright
 * only when BOTH sides look like scam profiles.
 */
export const WOT_SIGNAL_WEIGHTS = Object.freeze({
  mutual_identity_link: { weight: 3, side: "link", category: "trust" },
  nip39_proof_tweet: { weight: 3, side: "link", category: "trust" },
  x_account_established: { weight: 2, side: "x", category: "trust" },
  x_account_mature: { weight: 1, side: "x", category: "trust" },
  x_followers_strong: { weight: 2, side: "x", category: "trust" },
  x_followers_moderate: { weight: 1, side: "x", category: "trust" },
  x_activity_established: { weight: 1, side: "x", category: "trust" },
  x_follow_ratio_healthy: { weight: 1, side: "x", category: "trust" },
  nostr_nip05_present: { weight: 1, side: "nostr", category: "trust" },
  nostr_lightning_present: { weight: 1, side: "nostr", category: "trust" },

  x_account_new: { weight: -3, side: "x", category: "risk" },
  x_followers_negligible: { weight: -2, side: "x", category: "risk" },
  x_activity_negligible: { weight: -1, side: "x", category: "risk" },
  nostr_profile_empty: { weight: -1, side: "nostr", category: "risk" },

  x_follow_ratio_spammy: { weight: -2, side: "x", category: "scam" },
  x_bio_scam_phrase: { weight: -2, side: "x", category: "scam" },
  x_impersonation_name: { weight: -2, side: "x", category: "scam" },
  nostr_about_scam_phrase: { weight: -2, side: "nostr", category: "scam" },
  nostr_impersonation_name: { weight: -2, side: "nostr", category: "scam" },
});

export function evaluateWebOfTrust({
  xProfile = null,
  nostrMetadata = null,
  linkage = {},
  now = new Date(),
  thresholds = {},
} = {}) {
  const limits = { ...DEFAULT_WOT_THRESHOLDS, ...(thresholds || {}) };
  const nowMs = toTimeMs(now) ?? Date.now();
  const evaluatedAt = new Date(nowMs).toISOString();
  const x = normalizeXProfile(xProfile);
  const nostr = normalizeNostrMetadata(nostrMetadata);
  const inputs = {
    xProfile: Boolean(x),
    nostrMetadata: Boolean(nostr),
    xAccountAge: Boolean(x?.createdAtMs),
    xFollowerCounts: Number.isFinite(x?.followers),
  };

  if (!x) {
    return {
      status: WOT_STATUS.unavailable,
      score: 0,
      signals: [],
      reasons: ["x_profile_unavailable"],
      inputs,
      thresholds: limits,
      evaluatedAt,
    };
  }

  const signals = [];
  const add = (id, detail) => {
    const spec = WOT_SIGNAL_WEIGHTS[id];
    if (!spec) return;
    signals.push({ id, ...spec, ...(detail ? { detail } : {}) });
  };

  if (linkage.proofTweetVerified) add("nip39_proof_tweet");
  if (linkage.xBioLinksPubkey && linkage.nostrProfileLinksHandle) {
    add("mutual_identity_link");
  }

  const ageDays = x.createdAtMs ? (nowMs - x.createdAtMs) / DAY_MS : null;
  if (ageDays != null) {
    if (ageDays >= limits.establishedAccountDays) {
      add("x_account_established", `${Math.floor(ageDays)}d`);
    } else if (ageDays >= limits.matureAccountDays) {
      add("x_account_mature", `${Math.floor(ageDays)}d`);
    } else if (ageDays < limits.newAccountDays) {
      add("x_account_new", `${Math.max(0, Math.floor(ageDays))}d`);
    }
  }

  if (Number.isFinite(x.followers)) {
    if (x.followers >= limits.strongFollowers) {
      add("x_followers_strong", String(x.followers));
    } else if (x.followers >= limits.moderateFollowers) {
      add("x_followers_moderate", String(x.followers));
    } else if (x.followers < limits.negligibleFollowers) {
      add("x_followers_negligible", String(x.followers));
    }
  }

  if (Number.isFinite(x.tweets)) {
    if (x.tweets >= limits.establishedTweets) {
      add("x_activity_established", String(x.tweets));
    } else if (x.tweets < limits.negligibleTweets) {
      add("x_activity_negligible", String(x.tweets));
    }
  }

  if (Number.isFinite(x.followers) && Number.isFinite(x.following)) {
    if (
      x.following >= limits.spammyFollowing &&
      x.followers * limits.spammyFollowRatio < x.following
    ) {
      add("x_follow_ratio_spammy", `${x.followers}/${x.following}`);
    } else if (x.following > 0 && x.followers * 2 >= x.following) {
      add("x_follow_ratio_healthy", `${x.followers}/${x.following}`);
    }
  }

  addPhraseSignals(add, "x_bio_scam_phrase", x.text, limits.maxPhrasePenalty);
  if (IMPERSONATION_NAME.test(`${x.handle} ${x.displayName}`)) {
    add("x_impersonation_name", x.handle || x.displayName || null);
  }

  if (nostr) {
    if (nostr.nip05) add("nostr_nip05_present");
    if (nostr.lud16) add("nostr_lightning_present");
    if (!nostr.name && !nostr.about && !nostr.nip05 && !nostr.lud16) {
      add("nostr_profile_empty");
    }
    addPhraseSignals(
      add,
      "nostr_about_scam_phrase",
      nostr.text,
      limits.maxPhrasePenalty,
    );
    if (IMPERSONATION_NAME.test(nostr.name || "")) {
      add("nostr_impersonation_name", nostr.name);
    }
  } else {
    add("nostr_profile_empty");
  }

  signals.sort(
    (a, b) =>
      a.id.localeCompare(b.id) ||
      String(a.detail || "").localeCompare(String(b.detail || "")),
  );
  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const scamSides = new Set(
    signals.filter((signal) => signal.category === "scam").map((s) => s.side),
  );
  const bothProfilesScamRisk = scamSides.has("x") && scamSides.has("nostr");

  const status = bothProfilesScamRisk
    ? WOT_STATUS.rejected
    : score >= limits.acceptScore
      ? WOT_STATUS.accepted
      : score <= limits.rejectScore
        ? WOT_STATUS.rejected
        : WOT_STATUS.ambiguous;

  const reasons = bothProfilesScamRisk
    ? ["both_profiles_scam_risk", ...signals.map((signal) => signal.id)]
    : signals.map((signal) => signal.id);

  return {
    status,
    score,
    signals,
    reasons: [...new Set(reasons)],
    bothProfilesScamRisk,
    inputs,
    thresholds: limits,
    evaluatedAt,
  };
}

/**
 * Collapse an evaluation into the fields persisted on a claim / directory
 * entry. Kept separate so the scoring stays free of storage concerns.
 */
export function trustFieldsFromEvaluation(evaluation, mode = "flag") {
  if (!evaluation) return {};
  return {
    trustStatus: evaluation.status,
    trustScore: evaluation.score,
    trustReasons: evaluation.reasons.slice(0, 20),
    trustEvaluatedAt: evaluation.evaluatedAt,
    trustMode: mode,
  };
}

/** `enforce` is the only mode that turns a failed WoT check into a rejection. */
export function wotRejectsIdentity(evaluation, mode) {
  return mode === "enforce" && evaluation?.status === WOT_STATUS.rejected;
}

function addPhraseSignals(add, signalId, text, maxPenalty) {
  if (!text) return;
  const weight = Math.abs(WOT_SIGNAL_WEIGHTS[signalId]?.weight || 0);
  const maxMatches = weight > 0 ? Math.floor(maxPenalty / weight) : 0;
  const matched = SCAM_PHRASES.filter((phrase) =>
    phrase.pattern.test(text),
  ).slice(0, Math.max(0, maxMatches));
  for (const phrase of matched) add(signalId, phrase.id);
}

function normalizeXProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const handle = String(profile.handle || profile.screenName || "").toLowerCase();
  const displayName = String(profile.displayName || profile.name || "");
  const description = String(profile.description || "");
  const followers = finiteCount(profile.followers);
  const following = finiteCount(profile.following);
  const tweets = finiteCount(profile.tweets);
  const createdAtMs = toTimeMs(profile.createdAt ?? profile.createdAtMs);
  if (
    !handle &&
    !displayName &&
    !description &&
    followers == null &&
    following == null &&
    tweets == null &&
    createdAtMs == null
  ) {
    return null;
  }
  return {
    handle,
    displayName,
    description,
    followers,
    following,
    tweets,
    createdAtMs,
    text: [description, profile.location, profile.website]
      .filter(Boolean)
      .join(" "),
  };
}

function normalizeNostrMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const name = String(metadata.name || "");
  const about = String(metadata.about || "");
  const nip05 = String(metadata.nip05 || "");
  const lud16 = String(metadata.lud16 || "");
  const website = String(metadata.website || "");
  if (!name && !about && !nip05 && !lud16 && !website) return null;
  return {
    name,
    about,
    nip05,
    lud16,
    website,
    text: [about, website].filter(Boolean).join(" "),
  };
}

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

function toTimeMs(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
