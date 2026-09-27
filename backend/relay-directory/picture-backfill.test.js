// SPDX-License-Identifier: MIT

import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { planNostrPicture, planXPicture } from "./picture-backfill.js";

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const otherSecret = generateSecretKey();
const otherPubkey = getPublicKey(otherSecret);

function kind0(secretKey, content, author = pubkey) {
  return finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [],
      content: JSON.stringify(content),
      pubkey: author,
    },
    secretKey,
  );
}

function directoryDoc(extra = {}) {
  return {
    handle: "alice",
    activeIdentity: {
      claimId: "claim-1",
      status: "verified",
      pubkey,
      metadata: { name: "Alice" },
      ...extra.activeIdentity,
    },
    claims: extra.claims || [
      {
        claimId: "claim-1",
        status: "verified",
        pubkey,
        metadata: { name: "Alice" },
      },
      {
        claimId: "claim-2",
        metadata: { name: "Old" },
      },
    ],
  };
}

describe("planNostrPicture", () => {
  it("writes a matching kind-0 picture onto the active identity and active claim", () => {
    const plan = planNostrPicture(
      directoryDoc(),
      kind0(secret, { picture: "https://CDN.Example/alice.png", name: "Alice" }),
    );

    expect(plan.changed).toBe(true);
    expect(plan.reason).toBe("nostr-picture");
    expect(plan.picture).toBe("https://cdn.example/alice.png");
    expect(plan.activeIdentity.metadata).toEqual({
      name: "Alice",
      picture: "https://cdn.example/alice.png",
    });
    expect(plan.claims[0].metadata.picture).toBe("https://cdn.example/alice.png");
    expect(plan.claims[1].metadata.picture).toBeUndefined();
  });

  it("leaves an existing https picture in place", () => {
    const plan = planNostrPicture(
      directoryDoc({
        activeIdentity: {
          metadata: { picture: "https://cdn.example/kept.png" },
        },
      }),
      kind0(secret, { picture: "https://cdn.example/new.png" }),
    );

    expect(plan).toEqual({ changed: false, reason: "has-picture" });
  });

  it("does not store a non-https kind-0 picture", () => {
    const plan = planNostrPicture(
      directoryDoc(),
      kind0(secret, { picture: "http://cdn.example/alice.png" }),
    );

    expect(plan).toEqual({ changed: false, reason: "no-picture" });
  });

  it("rejects a kind-0 signed by someone else", () => {
    const plan = planNostrPicture(
      directoryDoc(),
      kind0(otherSecret, { picture: "https://cdn.example/other.png" }, otherPubkey),
    );

    expect(plan.reason).toBe("pubkey-mismatch");
    expect(plan.changed).toBe(false);
  });

  it("rejects an unsigned kind-0", () => {
    const plan = planNostrPicture(directoryDoc(), {
      kind: 0,
      pubkey,
      content: JSON.stringify({ picture: "https://cdn.example/alice.png" }),
    });

    expect(plan).toEqual({ changed: false, reason: "rejected-kind0" });
  });
});

describe("planXPicture", () => {
  it("stores an upgraded X avatar when kind 0 has no picture", () => {
    const plan = planXPicture(
      directoryDoc(),
      "https://pbs.twimg.com/profile_images/1/photo_normal.jpg",
    );

    expect(plan.changed).toBe(true);
    expect(plan.reason).toBe("x-picture");
    expect(plan.xPicture).toBe(
      "https://pbs.twimg.com/profile_images/1/photo_200x200.jpg",
    );
    expect(plan.activeIdentity.metadata).toEqual({
      name: "Alice",
      xPicture: "https://pbs.twimg.com/profile_images/1/photo_200x200.jpg",
    });
    expect(plan.claims[0].metadata.xPicture).toBe(plan.xPicture);
    expect(plan.claims[1].metadata).toEqual({ name: "Old" });
  });

  it("does not replace a Nostr picture with an X avatar", () => {
    const plan = planXPicture(
      directoryDoc({
        activeIdentity: {
          metadata: { picture: "https://cdn.example/alice.png", name: "Alice" },
        },
      }),
      "https://pbs.twimg.com/profile_images/1/photo_normal.jpg",
    );

    expect(plan).toEqual({ changed: false, reason: "has-nostr-picture" });
  });

  it("leaves a stored X avatar unchanged when it already matches", () => {
    const xPicture = "https://pbs.twimg.com/profile_images/1/photo_200x200.jpg";
    const plan = planXPicture(
      directoryDoc({
        activeIdentity: { metadata: { name: "Alice", xPicture } },
      }),
      xPicture,
    );

    expect(plan.changed).toBe(false);
    expect(plan.reason).toBe("unchanged");
  });
});
