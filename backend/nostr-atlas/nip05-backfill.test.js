// SPDX-License-Identifier: MIT

import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { planNip05FromKind0 } from "./nip05-backfill.js";

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const otherSecret = generateSecretKey();
const otherPubkey = getPublicKey(otherSecret);

function kind0(secretKey, content) {
  return finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [],
      content: JSON.stringify(content),
    },
    secretKey,
  );
}

function directoryDoc(extra = {}) {
  return {
    handle: "btcforplebs",
    activeIdentity: {
      claimId: "nd:PY4VgsK1FVyheIFslatp",
      status: "verified",
      pubkey,
      sources: ["nostr.directory"],
      verificationMethods: ["nostr.directory"],
      ...extra.activeIdentity,
    },
    claims: extra.claims || [
      {
        claimId: "nd:PY4VgsK1FVyheIFslatp",
        status: "verified",
        pubkey,
        sources: ["nostr.directory"],
      },
    ],
  };
}

describe("planNip05FromKind0", () => {
  it("writes a matching kind-0 nip05 onto the active identity and active claim", () => {
    const plan = planNip05FromKind0(
      directoryDoc(),
      kind0(secret, { nip05: "logen@btcforplebs.com" }),
    );

    expect(plan.changed).toBe(true);
    expect(plan.reason).toBe("updated");
    expect(plan.activeIdentity.metadata.nip05).toBe("logen@btcforplebs.com");
    expect(plan.claims[0].metadata.nip05).toBe("logen@btcforplebs.com");
  });

  it("replaces a stored nip05 when the kind-0 publishes a different address", () => {
    const plan = planNip05FromKind0(
      directoryDoc({
        activeIdentity: { metadata: { nip05: "old@example.com", name: "Logen" } },
        claims: [
          {
            claimId: "nd:PY4VgsK1FVyheIFslatp",
            status: "verified",
            pubkey,
            metadata: { nip05: "old@example.com", name: "Logen" },
          },
        ],
      }),
      kind0(secret, { nip05: "new@example.com" }),
    );

    expect(plan.reason).toBe("updated");
    expect(plan.activeIdentity.metadata).toEqual({
      nip05: "new@example.com",
      name: "Logen",
    });
    expect(plan.claims[0].metadata.nip05).toBe("new@example.com");
  });

  it("clears a stored nip05 when the matching kind-0 has none", () => {
    const plan = planNip05FromKind0(
      directoryDoc({
        activeIdentity: { metadata: { nip05: "old@example.com", name: "Logen" } },
      }),
      kind0(secret, { name: "Logen" }),
    );

    expect(plan.reason).toBe("cleared");
    expect(plan.nip05).toBeNull();
    expect(plan.activeIdentity.metadata).toEqual({ name: "Logen" });
    expect(plan.claims[0].metadata).toBeUndefined();
  });

  it("leaves a stored nip05 when the kind-0 is missing", () => {
    const doc = directoryDoc({
      activeIdentity: { metadata: { nip05: "old@example.com" } },
    });
    const plan = planNip05FromKind0(doc, null);

    expect(plan).toEqual({ changed: false, reason: "no-kind0" });
  });

  it("leaves the document unchanged when the kind-0 pubkey does not match", () => {
    const plan = planNip05FromKind0(
      directoryDoc(),
      kind0(otherSecret, { nip05: "other@example.com" }),
    );

    expect(plan).toEqual({ changed: false, reason: "pubkey-mismatch" });
    expect(otherPubkey).not.toBe(pubkey);
  });

  it("does not copy nip05 from a pending claim", () => {
    const plan = planNip05FromKind0(
      directoryDoc({
        claims: [
          {
            claimId: "pending-other",
            status: "pending",
            pubkey: otherPubkey,
            metadata: { nip05: "logen@btcforplebs.com" },
          },
          {
            claimId: "nd:PY4VgsK1FVyheIFslatp",
            status: "verified",
            pubkey,
            sources: ["nostr.directory"],
          },
        ],
      }),
      kind0(secret, { nip05: "active@example.com" }),
    );

    expect(plan.activeIdentity.metadata.nip05).toBe("active@example.com");
    expect(plan.claims[0].metadata.nip05).toBe("logen@btcforplebs.com");
    expect(plan.claims[1].metadata.nip05).toBe("active@example.com");
  });

  it("leaves a non-directory document unchanged", () => {
    const plan = planNip05FromKind0(
      {
        activeIdentity: {
          claimId: "relay-event",
          status: "verified",
          pubkey,
          verificationMethods: ["nip39_proof_tweet"],
        },
        claims: [],
      },
      kind0(secret, { nip05: "alice@example.com" }),
    );

    expect(plan).toEqual({ changed: false, reason: "not-directory" });
  });

  it("leaves a stored nip05 when kind-0 content is not an object", () => {
    const plan = planNip05FromKind0(
      directoryDoc({
        activeIdentity: { metadata: { nip05: "old@example.com" } },
      }),
      finalizeEvent(
        {
          kind: 0,
          created_at: 1_700_000_000,
          tags: [],
          content: "not-json",
        },
        secret,
      ),
    );

    expect(plan).toEqual({ changed: false, reason: "rejected-kind0" });
  });

  it("rejects a non-string or overlong nip05 instead of writing it", () => {
    const malformed = planNip05FromKind0(
      directoryDoc({
        activeIdentity: { metadata: { nip05: "old@example.com" } },
      }),
      kind0(secret, { nip05: { name: "not-a-string" } }),
    );
    const overlong = planNip05FromKind0(
      directoryDoc(),
      kind0(secret, { nip05: `${"a".repeat(250)}@example.com` }),
    );

    expect(malformed).toEqual({ changed: false, reason: "rejected-nip05" });
    expect(overlong).toEqual({ changed: false, reason: "rejected-nip05" });
  });

  it("updates the matching claim when the active nip05 already matches", () => {
    const plan = planNip05FromKind0(
      directoryDoc({
        activeIdentity: { metadata: { nip05: "logen@btcforplebs.com" } },
        claims: [
          {
            claimId: "nd:PY4VgsK1FVyheIFslatp",
            status: "verified",
            pubkey,
            sources: ["nostr.directory"],
            metadata: { nip05: "old@example.com" },
          },
        ],
      }),
      kind0(secret, { nip05: "logen@btcforplebs.com" }),
    );

    expect(plan.changed).toBe(true);
    expect(plan.activeIdentity.metadata.nip05).toBe("logen@btcforplebs.com");
    expect(plan.claims[0].metadata.nip05).toBe("logen@btcforplebs.com");
  });

  it("updates a directory claim while a relay identity stays active", () => {
    const directoryClaim = {
      claimId: "nd:1",
      status: "verified",
      pubkey,
      sources: ["nostr.directory"],
    };
    const plan = planNip05FromKind0(
      {
        activeIdentity: {
          claimId: "relay:1",
          status: "verified",
          pubkey: otherPubkey,
          verificationMethods: ["nip39_proof_tweet"],
        },
        claims: [directoryClaim],
      },
      kind0(secret, { nip05: "alice@example.com" }),
      directoryClaim,
    );

    expect(plan.changed).toBe(true);
    expect(plan.activeIdentity).toBeUndefined();
    expect(plan.claims[0].metadata.nip05).toBe("alice@example.com");
  });
});
