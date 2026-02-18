// SPDX-License-Identifier: MIT

/**
 * WindowNostrService
 * ==================
 * Service for lazy-loading window.nostr.js and ensuring window.nostr is available.
 *
 * Injects the window.nostr.js script on first call, which provides a floating
 * NIP-07/NIP-46 widget compatible with NDKNip07Signer from @nostr-dev-kit/ndk.
 */

const WINDOW_NOSTR_JS_SRC = 'https://cdn.jsdelivr.net/npm/window.nostr.js/dist/window.nostr.min.js';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * Ensures window.nostr.js is loaded.
 * Injects the script tag on first call; subsequent calls return immediately.
 *
 * @returns Promise that resolves when window.nostr.js is loaded
 */
export async function ensureInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await injectScript(WINDOW_NOSTR_JS_SRC);
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
  await ensureInitialized();
  
  if (!isAvailable()) {
    return null;
  }

  try {
    const pubkey = await (window as any).nostr.getPublicKey();
    return pubkey || null;
  } catch (error) {
    console.error('Failed to get public key from window.nostr:', error);
    return null;
  }
}

/**
 * Sign an event using window.nostr
 * @param event - The event to sign
 * @returns Promise resolving to signed event
 */
export async function signEvent(event: any): Promise<any> {
  await ensureInitialized();
  
  if (!isAvailable()) {
    throw new Error('window.nostr is not available');
  }

  try {
    const signedEvent = await (window as any).nostr.signEvent(event);
    return signedEvent;
  } catch (error) {
    console.error('Failed to sign event with window.nostr:', error);
    throw error;
  }
}
