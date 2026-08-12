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

  it("reuses the tab session after the component bundle is evaluated again", async () => {
    const values: Record<string, string> = { [SESSION_KEY]: PUBLIC_KEY };
    const getPublicKeyFromSigner = vi.fn();
    vi.stubGlobal("window", {
      nostr: { getPublicKey: getPublicKeyFromSigner },
      sessionStorage: createSessionStorage(values),
    });

    const { getPublicKey } = await import("../nostr-login-service");

    await expect(getPublicKey()).resolves.toBe(PUBLIC_KEY);
    expect(getPublicKeyFromSigner).not.toHaveBeenCalled();
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
