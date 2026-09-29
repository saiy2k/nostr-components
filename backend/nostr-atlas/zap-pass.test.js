// SPDX-License-Identifier: MIT

import { FieldValue } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import {
  activeZapWrite,
  applyZapResult,
  directoryZapClaims,
  isPrivateAddress,
} from "./zap-pass.js";

describe("applyZapResult", () => {
  it("clears stale LNURL fields when the new result does not supply them", () => {
    const next = applyZapResult(
      {
        claimId: "nd:1",
        zappable: true,
        lud16: "old@example.com",
        lnurlp: "https://example.com/.well-known/lnurlp/old",
        lnurlAllowsNostr: true,
        lnurlNostrPubkey: "ab",
      },
      {
        zappable: false,
        lud16: null,
        zapReason: "missing-lud16",
        zapCheckedAt: "2026-09-28T00:00:00.000Z",
        zapCheckTransient: false,
      },
    );

    expect(next.zappable).toBe(false);
    expect(next.lud16).toBeNull();
    expect(next.lnurlp).toBeUndefined();
    expect(next.lnurlAllowsNostr).toBeUndefined();
    expect(next.lnurlNostrPubkey).toBeUndefined();

    const stored = activeZapWrite(
      {
        claimId: "nd:1",
        lnurlp: "https://example.com/.well-known/lnurlp/old",
        lnurlAllowsNostr: true,
        lnurlNostrPubkey: "ab",
      },
      {
        zappable: false,
        lud16: null,
        zapReason: "missing-lud16",
        zapCheckedAt: "2026-09-28T00:00:00.000Z",
        zapCheckTransient: false,
      },
    );
    expect(FieldValue.delete().isEqual(stored.lnurlp)).toBe(true);
    expect(FieldValue.delete().isEqual(stored.lnurlAllowsNostr)).toBe(true);
    expect(FieldValue.delete().isEqual(stored.lnurlNostrPubkey)).toBe(true);
  });
});

describe("directoryZapClaims", () => {
  it("checks an imported directory claim while a relay identity stays active", () => {
    const claims = directoryZapClaims({
      activeIdentity: {
        claimId: "relay:1",
        status: "verified",
        pubkey: "aa",
        verificationMethods: ["nip39_proof_tweet"],
      },
      claims: [
        {
          claimId: "relay:1",
          status: "verified",
          pubkey: "aa",
          verificationMethods: ["nip39_proof_tweet"],
        },
        {
          claimId: "nd:1",
          status: "verified",
          pubkey: "bb",
          sources: ["nostr.directory"],
        },
      ],
    });

    expect(claims.map((claim) => claim.claimId)).toEqual(["nd:1"]);
  });
});

describe("isPrivateAddress", () => {
  it("blocks loopback, private, and link-local destinations", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("169.254.1.1")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
  });
});
