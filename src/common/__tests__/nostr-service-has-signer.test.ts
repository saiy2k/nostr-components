// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it } from 'vitest';
import { NostrService } from '../nostr-service';

describe('NostrService.hasSigner', () => {
  const originalLocalStorage = (globalThis as any).localStorage;

  afterEach(() => {
    if (originalLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = originalLocalStorage;
    }
  });

  it('does not treat localStorage nostr_nsec as a signer', () => {
    const store: Record<string, string> = { nostr_nsec: 'a'.repeat(64) };
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };

    // Even with a stored nsec, hasSigner must stay false without NIP-07 / NDK signer.
    expect(NostrService.getInstance().hasSigner()).toBe(false);
  });
});
