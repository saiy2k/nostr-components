// SPDX-License-Identifier: MIT

import { NostrEvent, UnsignedEvent } from 'nostr-tools';

/**
 * WindowNostrService
 * ==================
 * Service for lazy-loading window.nostr.js and ensuring window.nostr is available.
 *
 * Injects the window.nostr.js script on first call, which provides a floating
 * NIP-07/NIP-46 widget compatible with NDKNip07Signer from @nostr-dev-kit/ndk.
 */

const WINDOW_NOSTR_JS_SRC = 'https://cdn.jsdelivr.net/npm/window.nostr.js@0.7.1/dist/window.nostr.min.js';
const WINDOW_NOSTR_JS_SRI = 'sha384-NXQunbmQGIyNl1fc21WUnd+bnTzHy9PcJxhzI8MeUG6kJsaWL9Ok72zo9RCZOKd7';
const PUBLIC_KEY_SESSION_KEY = 'nostr-components:public-key';
const PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/i;

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let publicKeyPromise: Promise<string | null> | null = null;
let inMemoryPublicKey: string | null = null;

/** Host transports run in the page's MAIN world, where storage is page-readable. */
function hasHostRelayTransport(): boolean {
  const transport = (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
  return !!transport;
}

/** Read a validated public key shared by component instances in this tab. */
export function getCachedPublicKey(): string | null {
  if (typeof window === 'undefined') return null;
  if (hasHostRelayTransport()) {
    try {
      window.sessionStorage.removeItem(PUBLIC_KEY_SESSION_KEY);
    } catch (_error) {
      // Sandboxed pages can deny sessionStorage; module state remains private.
    }
    return inMemoryPublicKey;
  }

  try {
    const value = window.sessionStorage.getItem(PUBLIC_KEY_SESSION_KEY);
    if (!value) return null;
    if (!PUBLIC_KEY_PATTERN.test(value)) {
      window.sessionStorage.removeItem(PUBLIC_KEY_SESSION_KEY);
      return null;
    }
    return value.toLowerCase();
  } catch (_error) {
    return null;
  }
}

/** Cache only public identity data for the lifetime of the current tab. */
export function cachePublicKey(value: unknown): string | null {
  if (typeof value !== 'string' || !PUBLIC_KEY_PATTERN.test(value)) {
    return null;
  }

  const publicKey = value.toLowerCase();
  inMemoryPublicKey = publicKey;
  if (hasHostRelayTransport()) {
    try {
      window.sessionStorage.removeItem(PUBLIC_KEY_SESSION_KEY);
    } catch (_error) {
      // Sandboxed pages can deny sessionStorage; module state remains private.
    }
    return publicKey;
  }

  try {
    window.sessionStorage.setItem(PUBLIC_KEY_SESSION_KEY, publicKey);
  } catch (_error) {
    // Sandboxed pages can deny sessionStorage; the signer result still works.
  }
  return publicKey;
}

/** Remove an identity that can no longer be confirmed by the active signer. */
function clearCachedPublicKey(): void {
  inMemoryPublicKey = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PUBLIC_KEY_SESSION_KEY);
  } catch (_error) {
    // Sandboxed pages can deny sessionStorage; module state is already clear.
  }
}

function injectScript(src: string, integrity: string, crossOrigin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      // Script tag already in DOM — resolve immediately if the script has already
      // executed (window.nostr present), otherwise wait for its load/error events.
      if ((window as any).nostr !== undefined) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      }
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.integrity = integrity;
    el.crossOrigin = crossOrigin;
    el.onload = () => resolve();
    el.onerror = () => {
      el.onload = null;
      el.onerror = null;
      el.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(el);
  });
}

/**
 * Ensures window.nostr.js is loaded.
 * Injects the script tag on first call; subsequent calls return immediately.
 * Resolves immediately without touching the DOM when running outside a browser.
 *
 * @returns Promise that resolves when window.nostr.js is loaded (or immediately in SSR)
 */
export async function ensureInitialized(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (isInitialized) {
    return;
  }

  // A NIP-07 extension already owns window.nostr. Do not replace it or inject
  // remote window.nostr.js code into pages whose CSP would reject it.
  if (isAvailable()) {
    isInitialized = true;
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await injectScript(WINDOW_NOSTR_JS_SRC, WINDOW_NOSTR_JS_SRI, 'anonymous');
      isInitialized = true;
    } catch (error) {
      console.error('Failed to load window.nostr.js:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if window.nostr is available
 * @returns boolean indicating if window.nostr is available
 */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).nostr;
}

/**
 * Get the public key from window.nostr
 * @returns Promise resolving to public key or null
 */
export async function getPublicKey(): Promise<string | null> {
  if (publicKeyPromise) {
    return publicKeyPromise;
  }

  publicKeyPromise = (async () => {
    await ensureInitialized();

    if (!isAvailable()) return getCachedPublicKey();

    try {
      // Always refresh from an available signer. A session value can belong to
      // the account that was active before the user switched identities.
      const pubkey = await (window as any).nostr.getPublicKey();
      return cachePublicKey(pubkey);
    } catch (error) {
      console.error('Failed to get public key from window.nostr:', error);
      clearCachedPublicKey();
      return null;
    }
  })().finally(() => {
    publicKeyPromise = null;
  });

  return publicKeyPromise;
}

/**
 * Sign an event using window.nostr
 * @param event - The event to sign
 * @returns Promise resolving to signed event
 */
export async function signEvent(event: UnsignedEvent): Promise<NostrEvent> {
  await ensureInitialized();

  if (!isAvailable()) {
    throw new Error('window.nostr is not available');
  }

  try {
    const signedEvent: NostrEvent = await (window as any).nostr.signEvent(event);
    cachePublicKey(signedEvent.pubkey);
    return signedEvent;
  } catch (error) {
    console.error('Failed to sign event with window.nostr:', error);
    throw error;
  }
}
