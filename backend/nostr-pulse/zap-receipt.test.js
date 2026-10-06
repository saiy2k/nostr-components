// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { bech32 } from "@scure/base";
import { describe, expect, it } from "vitest";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifiedSymbol,
} from "nostr-tools";
import { getBolt11AmountMsats, validateZapReceipt } from "./zap-receipt.js";

const BOLT11_AMOUNT_MSATS = 2_000_000;
const RECIPIENT_SK = generateSecretKey();
const RECIPIENT_PK = getPublicKey(RECIPIENT_SK);
const PROVIDER_SK = generateSecretKey();
const PROVIDER_PK = getPublicKey(PROVIDER_SK);
const SENDER_SK = generateSecretKey();
const SENDER_PK = getPublicKey(SENDER_SK);

const PROVIDER = {
  lnurl: "https://ln.example/.well-known/lnurlp/alice",
  callback: "https://ln.example/callback",
  nostrPubkey: PROVIDER_PK,
};
const EXPECTED_URL = "https://x.com/alice/status/42";
const EXPECTED_A_TAG = `39735:${RECIPIENT_PK}:${EXPECTED_URL}`;

function bolt11ForDescription(description) {
  const hash = createHash("sha256").update(description).digest();
  const words = [];
  const timestamp = 1_700_000_000;
  for (let index = 6; index >= 0; index -= 1) {
    words.push((timestamp >> (index * 5)) & 31);
  }
  for (const field of [
    { type: 1, data: Buffer.alloc(32, 1) },
    { type: 23, data: hash },
  ]) {
    const dataWords = bech32.toWords(field.data);
    const length = dataWords.length;
    words.push(field.type, (length >> 5) & 31, length & 31, ...dataWords);
  }
  words.push(...bech32.toWords(Buffer.alloc(65, 2)));
  return bech32.encode("lnbc20u", words, 2000);
}

function makeZapRequest(amountMsats = BOLT11_AMOUNT_MSATS, extraTags = []) {
  return finalizeEvent(
    {
      kind: 9734,
      created_at: 1_700_000_000,
      content: "thanks",
      tags: [
        ["p", RECIPIENT_PK],
        ["amount", String(amountMsats)],
        ["relays", "wss://relay.example"],
        ...extraTags,
      ],
    },
    SENDER_SK,
  );
}

function receiptForRequest(zapRequest, mutateTags) {
  const description = JSON.stringify(zapRequest);
  const baseTags = [
    ["p", RECIPIENT_PK],
    ["P", zapRequest.pubkey],
    ["bolt11", bolt11ForDescription(description)],
    ["description", description],
    ...zapRequest.tags.filter(([name]) => name === "a"),
  ];
  return finalizeEvent(
    {
      kind: 9735,
      created_at: 1_700_000_100,
      content: "",
      tags: mutateTags ? mutateTags(baseTags) : baseTags,
    },
    PROVIDER_SK,
  );
}

function makeValidReceipt(
  amountMsats = BOLT11_AMOUNT_MSATS,
  mutateTags,
  requestExtraTags = [],
) {
  return receiptForRequest(
    makeZapRequest(amountMsats, requestExtraTags),
    mutateTags,
  );
}

describe("getBolt11AmountMsats", () => {
  it("decodes invoice amount in millisatoshis", () => {
    const invoice = bolt11ForDescription("thanks");
    expect(getBolt11AmountMsats(invoice)).toBe(BOLT11_AMOUNT_MSATS);
  });
});

describe("validateZapReceipt", () => {
  it("returns a result for a missing receipt", () => {
    expect(
      validateZapReceipt(null, {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
      }),
    ).toEqual({ ok: false, reason: "not-kind-9735" });
    expect(
      validateZapReceipt(undefined, {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
      }),
    ).toEqual({ ok: false, reason: "not-kind-9735" });
  });

  it("accepts a receipt that satisfies NIP-57 Appendix F checks", () => {
    const result = validateZapReceipt(makeValidReceipt(), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountMsats).toBe(BOLT11_AMOUNT_MSATS);
      expect(result.zapRequest.pubkey).toBe(SENDER_PK);
      expect(result.senderPubkey).toBe(SENDER_PK);
    }
  });

  it("hashes the raw description tag, not a re-serialized zap request", () => {
    const zapRequest = makeZapRequest();
    const compact = JSON.stringify(zapRequest);
    const description = compact.replace("{", "{ ");
    expect(description).not.toBe(compact);
    expect(JSON.stringify(JSON.parse(description))).toBe(compact);
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: 1_700_000_100,
        content: "",
        tags: [
          ["p", RECIPIENT_PK],
          ["bolt11", bolt11ForDescription(description)],
          ["description", description],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(JSON.parse(description))).not.toBe(description);
  });

  it("rejects a description hash that does not match the raw description", () => {
    const zapRequest = makeZapRequest();
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: 1_700_000_100,
        content: "",
        tags: [
          ["p", RECIPIENT_PK],
          ["bolt11", bolt11ForDescription("other description")],
          ["description", JSON.stringify(zapRequest)],
        ],
      },
      PROVIDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "description-hash" });
  });

  it.each([
    ["anon", ""],
    ["anon", "ciphertext"],
  ])("has no sender when the zap request carries %s", (name, value) => {
    const result = validateZapReceipt(
      receiptForRequest(makeZapRequest(BOLT11_AMOUNT_MSATS, [[name, value]])),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.senderPubkey).toBeNull();
  });

  it("does not treat a missing receipt P tag as anonymous", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.filter(([name]) => name !== "P"),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.senderPubkey).toBe(SENDER_PK);
  });

  it("rejects receipts not signed by the LNURL nostrPubkey", () => {
    const zapRequest = makeZapRequest();
    const description = JSON.stringify(zapRequest);
    const receipt = finalizeEvent(
      {
        kind: 9735,
        created_at: 1_700_000_100,
        content: "",
        tags: [
          ["p", RECIPIENT_PK],
          ["bolt11", bolt11ForDescription(description)],
          ["description", description],
        ],
      },
      SENDER_SK,
    );
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "receipt-pubkey-mismatch" });
  });

  it("rejects when zap request amount does not match bolt11 amount", () => {
    const result = validateZapReceipt(makeValidReceipt(999_000), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "amount-mismatch" });
  });

  it("rejects a receipt whose tags were tampered with after signing", () => {
    const receipt = makeValidReceipt();
    receipt.tags = receipt.tags.filter(([name]) => name !== "description");
    delete receipt[verifiedSymbol];
    const result = validateZapReceipt(receipt, {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "receipt-sig" });
  });

  it("rejects missing description", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.filter(([name]) => name !== "description"),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "missing-description" });
  });

  it("rejects a missing receipt p tag", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.filter(([name]) => name !== "p"),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "receipt-p-mismatch" });
  });

  it.each([
    ["p", "duplicate-receipt-p"],
    ["description", "duplicate-description"],
    ["bolt11", "duplicate-bolt11"],
  ])("rejects duplicate receipt %s tags", (name, reason) => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) => {
        const duplicate = tags.find(([tagName]) => tagName === name);
        return [...tags, [...duplicate]];
      }),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason });
  });

  it("rejects duplicate embedded zap-request p tags", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, undefined, [["p", RECIPIENT_PK]]),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "duplicate-zap-request-p" });
  });

  it("rejects invalid description JSON", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.map((tag) =>
          tag[0] === "description" ? ["description", "{not-json"] : tag,
        ),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.reason === "description-json" ||
          result.reason.startsWith("invalid-zap-request:"),
      ).toBe(true);
    }
  });

  it("rejects zap-request p mismatch", () => {
    const wrongP = finalizeEvent(
      {
        kind: 9734,
        created_at: 1_700_000_000,
        content: "thanks",
        tags: [
          ["p", getPublicKey(generateSecretKey())],
          ["amount", String(BOLT11_AMOUNT_MSATS)],
          ["relays", "wss://relay.example"],
        ],
      },
      SENDER_SK,
    );
    const result = validateZapReceipt(receiptForRequest(wrongP), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "zap-request-p-mismatch" });
  });

  it("rejects an embedded request that is not kind 9734", () => {
    const notAZapRequest = finalizeEvent(
      {
        kind: 1,
        created_at: 1_700_000_000,
        content: "thanks",
        tags: [
          ["p", RECIPIENT_PK],
          ["amount", String(BOLT11_AMOUNT_MSATS)],
          ["relays", "wss://relay.example"],
        ],
      },
      SENDER_SK,
    );
    const result = validateZapReceipt(receiptForRequest(notAZapRequest), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
    });
    expect(result).toEqual({ ok: false, reason: "zap-request-kind" });
  });

  it("rejects missing bolt11", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.filter(([name]) => name !== "bolt11"),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "missing-bolt11" });
  });

  it("requires the exact invoice when validating payment completion", () => {
    const result = validateZapReceipt(makeValidReceipt(), {
      recipientPubkey: RECIPIENT_PK,
      provider: PROVIDER,
      expectedBolt11: "lnbc1different",
    });
    expect(result).toEqual({ ok: false, reason: "bolt11-mismatch" });
  });

  it("rejects invalid bolt11 amount", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, (tags) =>
        tags.map((tag) =>
          tag[0] === "bolt11" ? ["bolt11", "not-a-bolt11"] : tag,
        ),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "invalid-bolt11-amount" });
  });

  it("rejects lnurl mismatch when present", () => {
    const result = validateZapReceipt(
      receiptForRequest(
        makeZapRequest(BOLT11_AMOUNT_MSATS, [
          ["lnurl", "https://other.example/.well-known/lnurlp/bob"],
        ]),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result).toEqual({ ok: false, reason: "lnurl-mismatch" });
  });

  it("accepts an lnurl tag that matches the provider after URL normalization", () => {
    const result = validateZapReceipt(
      receiptForRequest(
        makeZapRequest(BOLT11_AMOUNT_MSATS, [
          ["lnurl", "https://ln.example/.well-known/lnurlp/alice"],
        ]),
      ),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: {
          ...PROVIDER,
          lnurl: "https://LN.Example:443/.well-known/lnurlp/alice",
        },
      },
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a bech32-encoded lnurl tag that decodes to the provider LNURL", () => {
    const words = bech32.toWords(new TextEncoder().encode(PROVIDER.lnurl));
    const lnurlTag = bech32.encode("lnurl", words, 1000);
    const result = validateZapReceipt(
      receiptForRequest(
        makeZapRequest(BOLT11_AMOUNT_MSATS, [["lnurl", lnurlTag]]),
      ),
      { recipientPubkey: RECIPIENT_PK, provider: PROVIDER },
    );
    expect(result.ok).toBe(true);
  });

  it("cryptographically binds URL zaps to matching receipt and request a tags", () => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, undefined, [["a", EXPECTED_A_TAG]]),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
        expectedATag: EXPECTED_A_TAG,
      },
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    [
      "missing receipt a",
      (tags) => tags.filter(([name]) => name !== "a"),
      [["a", EXPECTED_A_TAG]],
    ],
    ["missing request a", (tags) => [...tags, ["a", EXPECTED_A_TAG]], []],
    [
      "mismatched a",
      undefined,
      [["a", `39735:${RECIPIENT_PK}:https://x.com/alice/status/99`]],
    ],
    [
      "duplicate a",
      undefined,
      [
        ["a", EXPECTED_A_TAG],
        ["a", EXPECTED_A_TAG],
      ],
    ],
  ])("rejects URL attribution with %s", (_label, mutateTags, requestTags) => {
    const result = validateZapReceipt(
      makeValidReceipt(BOLT11_AMOUNT_MSATS, mutateTags, requestTags),
      {
        recipientPubkey: RECIPIENT_PK,
        provider: PROVIDER,
        expectedATag: EXPECTED_A_TAG,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["a-mismatch", "duplicate-a"]).toContain(result.reason);
    }
  });
});
