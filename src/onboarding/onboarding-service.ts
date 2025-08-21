// Use main NDK for everything except NIP-46 signer
// Import NIP-46 signer from aliased newer NDK specifically for nostrconnect
import { NDKNip46Signer } from '@nostr-dev-kit/ndk-nc';
import { nip19 } from 'nostr-tools';
import { toDataURL } from 'qrcode';

// Test QR code generation when the module loads (dev only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    const onboardingService = OnboardingService.getInstance();
    onboardingService.testQrCodeGeneration().catch(console.error);
  }, 1000);
}

// (no-op) removed unused random string helper from previous implementation

type ErrorWithMessage = {
  name: string;
  message: string;
  stack?: string;
};
import { NostrService } from '../common/nostr-service';

class OnboardingService {
  private static instance: OnboardingService;
  private nostrService: NostrService = NostrService.getInstance();

  private normalizeRelayUrl(relayInput: string): string {
    if (!relayInput || typeof relayInput !== 'string') {
      throw new Error('Invalid relay input');
    }

    // Trim whitespace
    let relay = relayInput.trim();

    if (!relay) {
      throw new Error('Empty relay URL');
    }

    // Strip existing scheme if present
    relay = relay.replace(/^wss?:\/\//i, '');

    // Basic validation - ensure it looks like a valid host
    if (!/^[a-zA-Z0-9.-]+([:/][a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?$/.test(relay)) {
      throw new Error(`Invalid relay format: ${relay}`);
    }

    // Add wss:// scheme
    return `wss://${relay}`;
  }

  private validatePubkey(pubkey: string): boolean {
    return typeof pubkey === 'string' && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey);
  }

  // Use sessionStorage for sensitive data, localStorage for non-sensitive preferences
  public setSecretItem(key: string, value: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
    }
  }

  public getSecretItem(key: string): string | null {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
    return null;
  }

  private removeSecretItem(key: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  }

  private clearAllSecrets(): void {
    this.removeSecretItem('local-nsec');
    this.removeSecretItem('local-relay');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('nostr-has-active-signer');
    }
  }

  private constructor() { }

  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  hasNip07Extension(): boolean {
    // Check for browser extension first
    if (typeof window !== 'undefined' && 'nostr' in window) {
      return true;
    }

    // Check for stored remote signer and try to reconnect
    if (localStorage.getItem('nostr-has-active-signer') === 'true') {
      console.log('Found stored signer, attempting to reconnect...');
      this.tryAutoReconnect();
      return true;
    }

    return false;
  }

  async waitForAuthentication(): Promise<boolean> {
    // Check for browser extension first
    if (typeof window !== 'undefined' && 'nostr' in window) {
      return true;
    }

    // Check if we already have a signer
    const ndk = this.nostrService.getNDK();
    if (ndk.signer) {
      return true;
    }

    // If we have stored credentials, wait for reconnection to complete
    if (localStorage.getItem('nostr-has-active-signer') === 'true') {
      console.log('Waiting for auto-reconnect to complete...');

      try {
        // Add a timeout to prevent indefinite waiting
        await Promise.race([
          this.tryAutoReconnect(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Auto-reconnect timeout')), 10000)
          )
        ]);

        // Check again if we have a signer after reconnection
        if (ndk.signer) {
          console.log('Auto-reconnect successful, signer available');
          return true;
        } else {
          console.log('Auto-reconnect completed but no signer available');
          // Clear the stored flag since reconnection failed
          localStorage.removeItem('nostr-has-active-signer');
          return false;
        }
      } catch (error) {
        console.error('Auto-reconnect failed or timed out:', error);
        // Clear the stored flag since reconnection failed
        localStorage.removeItem('nostr-has-active-signer');
        return false;
      }
    }

    return false;
  }

  private reconnectPromise: Promise<void> | null = null;

  private async tryAutoReconnect(): Promise<void> {
    // Prevent multiple simultaneous reconnection attempts
    if (this.reconnectPromise) {
      console.log('Auto-reconnect already in progress, waiting...');
      return this.reconnectPromise;
    }

    this.reconnectPromise = (async () => {
      try {
        const localNsec = this.getSecretItem('local-nsec');
        const localRelay = this.getSecretItem('local-relay');

        if (!localNsec || !localRelay) {
          console.log('Missing stored credentials, cannot auto-reconnect');
          localStorage.removeItem('nostr-has-active-signer');
          return;
        }

        console.log('Attempting auto-reconnect with stored credentials');
        console.log('Using relay:', localRelay);

        // Add timeout to reconnectWithNsec call
        const reconnectPromise = this.reconnectWithNsec(localNsec, localRelay);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Reconnect timeout after 8 seconds')), 8000)
        );

        const signer = await Promise.race([reconnectPromise, timeoutPromise]);

        if (signer) {
          console.log('Auto-reconnect successful');
        } else {
          console.log('Auto-reconnect failed - no signer returned');
          this.clearAllSecrets();
        }
      } catch (error) {
        console.error('Auto-reconnect failed:', error);
        console.log('Clearing all stored authentication data');
        this.clearAllSecrets();
      } finally {
        this.reconnectPromise = null;
      }
    })();

    return this.reconnectPromise;
  }

  showModal(): void {
    let modal = document.body.querySelector('nostr-onboarding-modal');
    if (!modal) {
      modal = document.createElement('nostr-onboarding-modal');
      document.body.appendChild(modal);
    }
    modal.setAttribute('open', 'true');
  }

  // Method to clear authentication and force re-authentication
  clearAuthentication(): void {
    console.log('Clearing authentication state');

    // Clear all stored authentication data
    this.clearAllSecrets();

    // Clear signer from NostrService
    const ndk = this.nostrService.getNDK();
    if (ndk.signer) {
      ndk.signer = undefined;
    }

    // Clear reconnection promise
    this.reconnectPromise = null;

    console.log('Authentication cleared, showing modal');
    this.showModal();
  }

  // Test function to verify QR code generation (dev only)
  async testQrCodeGeneration(): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('testQrCodeGeneration is only available in development mode');
      return;
    }

    try {
      const testData = 'nostrconnect://testpubkey?relay=wss%3A%2F%2Frelay.damus.io&metadata=%7B%22name%22%3A%22Test%22%7D';
      console.log('Testing QR code generation with data:', testData);

      const qrCodeUrl = await toDataURL(testData, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 8
      });

      if (qrCodeUrl && qrCodeUrl.startsWith('data:image/')) {
        console.log('✅ QR code generation test passed');
        console.log('QR code data URL (truncated):', qrCodeUrl.substring(0, 50) + '...');
      } else {
        console.error('❌ QR code generation test failed - invalid data URL');
      }
    } catch (error) {
      console.error('❌ QR code generation test failed:', error);
    }
  }

  async connectWithBunker(connectionString: string, onSuccess?: () => Promise<void>): Promise<void> {
    let bunkerUrl = connectionString;

    // Handle nostrconnect:// URL
    if (bunkerUrl.startsWith('nostrconnect://')) {
      try {
        const url = new URL(bunkerUrl);
        const pubkey = url.hostname;
        const params = new URLSearchParams(url.search);
        const relay = params.get('relay');

        if (!relay) {
          throw new Error('No relay specified in connection string');
        }

        bunkerUrl = `bunker://${pubkey}?relay=${encodeURIComponent(relay)}`;
      } catch (error) {
        console.error('Error parsing nostrconnect URL:', error);
        alert('Invalid connection URL. Please check and try again.');
        return;
      }
    }
    // Handle bunker URL format: username@provider or pubkey@relay
    else if (!bunkerUrl.startsWith('bunker://') && bunkerUrl.includes('@')) {
      try {
        // This is a bunker format: username@provider or pubkey@relay
        const [identifier, provider] = bunkerUrl.split('@');

        // Check if it's a valid hex pubkey (64 chars) or if it looks like a username
        if (this.validatePubkey(identifier)) {
          // It's a pubkey@relay format
          const normalizedRelay = this.normalizeRelayUrl(provider);
          bunkerUrl = `bunker://${identifier}?relay=${encodeURIComponent(normalizedRelay)}`;
        } else {
          // It's a username@provider format, need to resolve via NIP-05
          try {
            const ndk = this.nostrService.getNDK();
            const user = await ndk.getUserFromNip05(bunkerUrl);

            if (user?.pubkey) {
              // Look for NIP-46 info in the user's profile
              await user.fetchProfile();
              const bunkerProfile = user.profile?.nip46;

              if (typeof bunkerProfile === 'string') {
                const [pubkey, relay] = bunkerProfile.split('@');
                if (this.validatePubkey(pubkey)) {
                  const normalizedRelay = this.normalizeRelayUrl(relay);
                  bunkerUrl = `bunker://${pubkey}?relay=${encodeURIComponent(normalizedRelay)}`;
                } else {
                  throw new Error('Invalid pubkey in NIP-46 profile');
                }
              } else {
                // Fallback: use the user's pubkey with a default relay
                if (this.validatePubkey(user.pubkey)) {
                  const normalizedRelay = this.normalizeRelayUrl(provider);
                  bunkerUrl = `bunker://${user.pubkey}?relay=${encodeURIComponent(normalizedRelay)}`;
                } else {
                  throw new Error('Invalid user pubkey from NIP-05');
                }
              }
            } else {
              throw new Error('Could not resolve user from NIP-05');
            }
          } catch (nip05Error) {
            console.error('Error resolving NIP-05:', nip05Error);
            alert('Could not resolve the NIP-05 identifier. Please check and try again.');
            return;
          }
        }
      } catch (error) {
        console.error('Error parsing bunker format:', error);
        alert('Invalid connection format. Please use: username@provider, pubkey@relay, or bunker:// URL');
        return;
      }
    }
    // Handle other formats (npub, etc.)
    else if (!bunkerUrl.startsWith('bunker://')) {
      try {
        // Try to decode as npub or other bech32 format
        const decoded = nip19.decode(bunkerUrl);
        if (decoded.type === 'npub') {
          const pubkey = decoded.data as string;
          if (this.validatePubkey(pubkey)) {
            const normalizedRelay = this.normalizeRelayUrl('relay.nsec.app');
            bunkerUrl = `bunker://${pubkey}?relay=${encodeURIComponent(normalizedRelay)}`;
          } else {
            throw new Error('Invalid pubkey from npub');
          }
        } else {
          throw new Error('Unsupported format');
        }
      } catch (error) {
        console.error('Error parsing connection string:', error);
        alert('Invalid connection format. Please use: username@provider, npub, or bunker:// URL');
        return;
      }
    }

    try {
      console.log('Attempting to connect with bunker URL:', bunkerUrl);
      const ndk = this.nostrService.getNDK();
      const signer = new NDKNip46Signer(ndk as any, bunkerUrl);
      // Don't set signer yet - let setupNip46Connection handle it after verification
      await this.setupNip46Connection(signer, onSuccess);
    } catch (error) {
      console.error('Failed to connect with bunker:', error);
      alert('Failed to connect. Please check the bunker URL and try again.');
      throw error;
    }
  }

  connectWithQr() {
    // Capture NDK reference outside the async function for cleanup access
    const ndk = this.nostrService.getNDK();
    let originalRelays: string[] | undefined;

    return {
      on: (_event: string, callback: (data: any) => void) => {
        (async () => {
          try {
            console.log('Initializing NIP-46 nostrconnect flow...');

            // Choose a relay to be used to communicate with the signer (try nsec.app's preferred relay)
            const relay = 'wss://relay.nsec.app';

            // Clear existing relays and use only our specified relay for NIP-46
            console.log('Setting up relay for NIP-46:', relay);
            originalRelays = ndk.explicitRelayUrls;
            ndk.explicitRelayUrls = [relay];

            try {
              // Connect to our relay
              await ndk.connect();
              console.log('Connected to relay successfully');
            } catch (error) {
              console.warn('Failed to connect to relay:', error);
              // Restore original relays if connection fails
              ndk.explicitRelayUrls = originalRelays;
            }

            // Restore this from session storage (safer for secrets)
            const localNsec = this.getSecretItem('local-nsec') || undefined;

            // Instantiate the signer using NDK 2.14.33 (cast ndk for type compatibility)
            const signer = NDKNip46Signer.nostrconnect(ndk as any, relay, localNsec, {
              name: "Nostr Components",
              // Request permissions for all basic social media actions
              perms: "sign_event:1,sign_event:3,sign_event:6,sign_event:7,sign_event:9735,sign_event:30023,nip04_encrypt,nip04_decrypt,nip44_encrypt,nip44_decrypt"
            });

            console.log('Signer created:', {
              hasNostrConnectUri: !!signer.nostrConnectUri,
              hasLocalSigner: !!signer.localSigner,
              relay: relay
            });

            // Show the signer.nostrConnectUri URI as a QR code
            if (_event === 'authUrl') {
              try {
                const uri = signer.nostrConnectUri;
                if (!uri) {
                  throw new Error('nostrConnectUri is not available');
                }
                const qrCodeUrl = await toDataURL(uri, {
                  errorCorrectionLevel: 'H',
                  margin: 1,
                  scale: 8,
                });
                if (!qrCodeUrl || !qrCodeUrl.startsWith('data:image/')) {
                  throw new Error('Invalid QR code data URL generated');
                }
                callback({ qrCodeUrl, nostrConnectUri: uri });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to generate QR code:', error);
                throw new Error('Failed to generate QR code: ' + errorMessage);
              }
            }

            // Wait for the user to connect with timeout
            console.log('Waiting for user approval...');
            console.log('nostrConnectUri:', signer.nostrConnectUri);

            // Add event listeners to debug what's happening
            if ((signer as any).on) {
              (signer as any).on('ready', () => console.log('Signer ready event fired'));
              (signer as any).on('error', (err: any) => console.error('Signer error:', err));
            }

            // Create a promise that resolves when the signer is ready, with timeout
            const connectionPromise = Promise.race([
              signer.blockUntilReady(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 2 minutes')), 120000)
              )
            ]);

            const user = await connectionPromise;
            console.log("Welcome", (user as any).npub);

            // Store secrets in sessionStorage for security (session-only persistence)
            if (signer.localSigner?.nsec) {
              this.setSecretItem('local-nsec', signer.localSigner.nsec);
              console.log('Saved local nsec for this session');
            }
            this.setSecretItem('local-relay', relay);

            // Set the signer in our service (cast for type compatibility)
            const success = await this.nostrService.setSigner(signer as any);
            if (!success) {
              throw new Error('Failed to set signer after verification');
            }
            console.log('Signer set in NostrService');

            // Notify UI of successful connection
            callback({ connected: true });

          } catch (error) {
            console.error('Failed to initialize QR code signer:', error);
            // Clear secrets on failure
            this.clearAllSecrets();
            callback({
              error: 'Failed to establish connection. Please try again.',
              details: error instanceof Error ? error.message : String(error)
            });
          } finally {
            // Always restore original relays after the flow
            if (originalRelays !== undefined) {
              ndk.explicitRelayUrls = originalRelays;
              try {
                await ndk.connect();
              } catch (connectError) {
                console.warn('Failed to reconnect to original relays:', connectError);
              }
            }
          }
        })();

        return {
          off: () => {
            console.log('QR flow cancelled by user');
            // Basic cancellation - restore relays immediately
            if (originalRelays !== undefined) {
              ndk.explicitRelayUrls = originalRelays;
              try {
                ndk.connect();
              } catch (connectError) {
                console.warn('Failed to reconnect to original relays after cancellation:', connectError);
              }
            }
          }
        };
      }
    };
  }

  private async setupNip46Connection(signer: NDKNip46Signer, onSuccess?: () => Promise<void>) {
    console.log('Setting up NIP-46 connection...');

    try {
      // Set a timeout for the connection attempt (2 minutes)
      const timeoutMs = 2 * 60 * 1000;

      console.log('Waiting for NIP-46 connection to be established...');

      // Set up a promise that will resolve when the connection is ready
      const connectionPromise = (async () => {
        try {
          const user = await signer.blockUntilReady();
          if (!user?.pubkey) {
            throw new Error('No user pubkey received');
          }
          console.log('NIP-46 connection established with pubkey:', user.pubkey);
          return user;
        } catch (error) {
          console.error('Error in NIP-46 connection:', error);
          throw error;
        }
      })();

      // Set up a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timed out after ${timeoutMs / 1000} seconds. Please try again.`));
        }, timeoutMs);
      });

      // Race the connection against the timeout
      const user = await Promise.race([connectionPromise, timeoutPromise]);

      if (user?.pubkey) {
        const npub = nip19.npubEncode(user.pubkey);
        console.log('✅ NIP-46 connection established! User npub:', npub);

        // Set the signer in the service after successful connection
        const success = await this.nostrService.setSigner(signer as any);
        if (!success) {
          throw new Error('Failed to set signer after successful NIP-46 connection');
        }

        try {
          if (onSuccess) {
            console.log('Calling onSuccess callback...');
            await onSuccess();
          }
        } catch (callbackError) {
          console.error('Error in onSuccess callback:', callbackError);
          // Don't fail the whole connection if callback fails
        }
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      const errorDetails = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      };

      console.error('NIP-46 connection error:', errorDetails);

      // More user-friendly error messages
      let userMessage = 'Failed to establish connection. Please try again.';
      if (err.message.includes('timed out')) {
        userMessage = 'Connection timed out. Please make sure you scanned the QR code and approved the connection in your signer app.';
      } else if (err.message.includes('already in use')) {
        userMessage = 'This connection is already in use. Please try again with a new QR code.';
      }

      alert(userMessage);
      throw error;
    }
  }

  async generateQrCode(data: string): Promise<string> {
    try {
      return await toDataURL(data, { width: 300 });
    } catch (err) {
      console.error('Failed to generate QR code', err);
      throw err;
    }
  }

  // Reconnection method for existing sessions (nostrconnect)
  async reconnectWithNsec(nsec: string, relay: string): Promise<NDKNip46Signer | null> {
    try {
      const ndk = this.nostrService.getNDK();

      // Instantiate the signer using the saved nsec (following documentation format)
      const signer = NDKNip46Signer.nostrconnect(ndk as any, relay, nsec, {
        name: "Nostr Components",
        // Request permissions for all basic social media actions
        perms: "sign_event:1,sign_event:3,sign_event:6,sign_event:7,sign_event:9735,sign_event:30023,nip04_encrypt,nip04_decrypt,nip44_encrypt,nip44_decrypt"
      });

      // Wait for the user to connect with timeout
      console.log('Waiting for signer to be ready...');
      const connectionPromise = Promise.race([
        signer.blockUntilReady(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Signer blockUntilReady timeout after 5 seconds')), 5000)
        )
      ]);

      const user = await connectionPromise;
      console.log("Welcome back", user.npub);

      // Set the signer in the service (cast for type compatibility)
      const success = await this.nostrService.setSigner(signer as any);
      if (!success) {
        throw new Error('Failed to set signer after verification');
      }

      // Store secrets in sessionStorage for security (session-only persistence)
      if (signer.localSigner?.nsec) {
        this.setSecretItem('local-nsec', signer.localSigner.nsec);
      }
      this.setSecretItem('local-relay', relay);

      return signer;
    } catch (error) {
      console.error('Failed to reconnect with nsec:', error);
      this.clearAllSecrets();
      return null;
    }
  }
}

export const onboardingService = OnboardingService.getInstance();

// Global functions for debugging/recovery (dev only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).clearNostrAuth = () => {
    console.log('🔄 Clearing Nostr authentication...');
    onboardingService.clearAuthentication();
  };

  (window as any).checkNostrAuth = () => {
    const ndk = onboardingService['nostrService'].getNDK();
    console.log('🔍 Authentication status:', {
      hasStoredSigner: localStorage.getItem('nostr-has-active-signer'),
      hasLocalNsec: !!onboardingService.getSecretItem('local-nsec'),
      hasLocalRelay: onboardingService.getSecretItem('local-relay'),
      hasNdkSigner: !!ndk.signer,
      hasWindow: typeof window !== 'undefined',
      hasNostrExtension: typeof window !== 'undefined' && 'nostr' in window
    });
  };
}
