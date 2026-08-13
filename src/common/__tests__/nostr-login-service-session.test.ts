// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";

const PUBLIC_KEY = "a".repeat(64);
const SESSION_KEY = "nostr-components:public-key";

function createSessionStorage(values: Record<string, string>) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete values[key];
    }),
  };
}

describe("nostr login session public-key cache", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("shares one signer request across component instances and caches the result", async () => {
    const values: Record<string, string> = {};
    const getPublicKeyFromSigner = vi.fn().mockResolvedValue(PUBLIC_KEY);
    vi.stubGlobal("window", {
      nostr: { getPublicKey: getPublicKeyFromSigner },
      sessionStorage: createSessionStorage(values),
    });

    const { getPublicKey } = await import("../nostr-login-service");
    const [first, second] = await Promise.all([getPublicKey(), getPublicKey()]);

    expect(first).toBe(PUBLIC_KEY);
    expect(second).toBe(PUBLIC_KEY);
    expect(getPublicKeyFromSigner).toHaveBeenCalledTimes(1);
    expect(values[SESSION_KEY]).toBe(PUBLIC_KEY);
  });

  it("refreshes a tab session after the signer account changes", async () => {
    const previousPublicKey = "a".repeat(64);
    const currentPublicKey = "b".repeat(64);
    const values: Record<string, string> = {
      [SESSION_KEY]: previousPublicKey,
    };
    const getPublicKeyFromSigner = vi.fn().mockResolvedValue(currentPublicKey);
    vi.stubGlobal("window", {
      nostr: { getPublicKey: getPublicKeyFromSigner },
      sessionStorage: createSessionStorage(values),
    });

    const { getPublicKey } = await import("../nostr-login-service");

    await expect(getPublicKey()).resolves.toBe(currentPublicKey);
    expect(getPublicKeyFromSigner).toHaveBeenCalledOnce();
    expect(values[SESSION_KEY]).toBe(currentPublicKey);
  });

  it("clears the previous identity when signer refresh fails", async () => {
    const values: Record<string, string> = { [SESSION_KEY]: PUBLIC_KEY };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(function () {});
    vi.stubGlobal("window", {
      nostr: {
        getPublicKey: vi
          .fn()
          .mockRejectedValue(new Error("Signer unavailable")),
      },
      sessionStorage: createSessionStorage(values),
    });

    const { getCachedPublicKey, getPublicKey } = await import(
      "../nostr-login-service"
    );

    expect(getCachedPublicKey()).toBe(PUBLIC_KEY);
    await expect(getPublicKey()).resolves.toBeNull();
    expect(getCachedPublicKey()).toBeNull();
    expect(values[SESSION_KEY]).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps signer identity out of page storage when a host transport exists", async () => {
    const values: Record<string, string> = { [SESSION_KEY]: "c".repeat(64) };
    const sessionStorage = createSessionStorage(values);
    vi.stubGlobal("window", {
      nostr: { getPublicKey: vi.fn().mockResolvedValue(PUBLIC_KEY) },
      sessionStorage: sessionStorage,
    });
    vi.stubGlobal("__nostrComponentsRelayTransport", {
      query: vi.fn(),
      publish: vi.fn(),
    });

    const { getCachedPublicKey, getPublicKey } = await import(
      "../nostr-login-service"
    );

    expect(getCachedPublicKey()).toBeNull();
    await expect(getPublicKey()).resolves.toBe(PUBLIC_KEY);
    expect(values[SESSION_KEY]).toBeUndefined();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(getCachedPublicKey()).toBe(PUBLIC_KEY);
  });

  it("uses an existing NIP-07 provider without injecting window.nostr.js", async () => {
    const values: Record<string, string> = {};
    vi.stubGlobal("window", {
      nostr: { getPublicKey: vi.fn().mockResolvedValue(PUBLIC_KEY) },
      sessionStorage: createSessionStorage(values),
    });
    const querySelector = vi.fn();
    vi.stubGlobal("document", { querySelector: querySelector });

    const { getPublicKey } = await import("../nostr-login-service");

    await expect(getPublicKey()).resolves.toBe(PUBLIC_KEY);
    expect(querySelector).not.toHaveBeenCalled();
  });
});
