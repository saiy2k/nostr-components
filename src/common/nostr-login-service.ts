// SPDX-License-Identifier: MIT

/**
 * NostrLoginService
 * =================
 * Service for lazy-loading and initializing NostrLogin.
 * 
 * This service ensures NostrLogin is initialized only when needed,
 * and provides a unified interface for components that require authentication.
 * 
 * NostrLogin provides window.nostr interface which is compatible with
 * NDKNip07Signer from @nostr-dev-kit/ndk.
 */

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensures NostrLogin is initialized.
 * This will lazy-load the nostr-login package and initialize it on first call.
 * Subsequent calls will return the same promise.
 * 
 * @returns Promise that resolves when NostrLogin is initialized
 */
export async function ensureInitialized(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    return;
  }

  // If initialization is in progress, return the existing promise
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    try {
      // Dynamic import to avoid SSR issues and only load when needed
      const { init } = await import('nostr-login');
      
      // Signup description should be:
      // Nostr is a simple, open protocol that enables a global, decentralized and censorship-resistant social network.
      // Watch a 1-min video
      // Watch a long video
      init({
        "methods": ["connect", "extension"],
      });
      
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize NostrLogin:', error);
      // Reset promise so we can retry
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if NostrLogin is available (window.nostr exists)
 * @returns boolean indicating if window.nostr is available
 */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).nostr;
}

/**
 * Get the public key from window.nostr
 * This will trigger NostrLogin auth flow if user isn't authenticated
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
    console.error('Failed to get public key from NostrLogin:', error);
    return null;
  }
}

/**
 * Sign an event using window.nostr
 * This will trigger NostrLogin auth flow if user isn't authenticated
 * @param event - The event to sign
 * @returns Promise resolving to signed event
 */
export async function signEvent(event: any): Promise<any> {
  await ensureInitialized();
  
  if (!isAvailable()) {
    throw new Error('NostrLogin is not available');
  }

  try {
    const signedEvent = await (window as any).nostr.signEvent(event);
    return signedEvent;
  } catch (error) {
    console.error('Failed to sign event with NostrLogin:', error);
    throw error;
  }
}
