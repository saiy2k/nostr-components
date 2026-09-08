// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveNip05 } from "../nip05-utils";

describe("resolveNip05", () => {
  const validPubkey = "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves valid identifier to lowercase public key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        names: {
          alice: validPubkey.toUpperCase(),
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveNip05("alice@example.com");
    expect(result).toBe(validPubkey);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/.well-known/nostr.json?name=alice",
      expect.objectContaining({
        headers: { accept: "application/json" },
      })
    );
  });

  it("normalizes mixed-case domain names", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        names: {
          bob: validPubkey,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveNip05("bob@ExAmPlE.CoM");
    expect(result).toBe(validPubkey);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/.well-known/nostr.json?name=bob",
      expect.anything()
    );
  });

  it("rejects uppercase characters or + in local-part per NIP-05 spec", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("Alice@example.com")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    await expect(resolveNip05("alice+tag@example.com")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    await expect(resolveNip05("BOB@example.com")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents prototype property pollution / shadowing (e.g. toString)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        names: {},
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("tostring@example.com")).rejects.toThrow(
      "NIP-05 not found"
    );
  });

  it("rejects non-hex or malformed public keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        names: {
          alice: "not-a-valid-hex-pubkey",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("alice@example.com")).rejects.toThrow(
      "Invalid NIP-05 public key format"
    );
  });

  it("rejects non-string values in names dictionary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        names: {
          alice: 12345,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("alice@example.com")).rejects.toThrow(
      "Invalid NIP-05 public key format"
    );
  });

  it("rejects invalid NIP-05 format without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("invalid-format")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    await expect(resolveNip05("user@")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    await expect(resolveNip05("@domain.com")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    await expect(resolveNip05("user@domain@extra.com")).rejects.toThrow(
      "Invalid NIP-05 format"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when HTTP response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("missing@example.com")).rejects.toThrow(
      "Unable to resolve NIP-05"
    );
  });

  it("throws when JSON payload lacks a valid names object", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNip05("alice@example.com")).rejects.toThrow(
      "NIP-05 not found"
    );
  });

  it("handles request abort / timeout via timer-driven signal", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveNip05("alice@example.com", 100);
    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow("NIP-05 resolution timed out");
  });
});
