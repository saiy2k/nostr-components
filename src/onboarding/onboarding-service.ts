import { NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';
import { NostrService } from '../common/nostr-service';

class OnboardingService {
  private static instance: OnboardingService;
  private nostrService: NostrService = NostrService.getInstance();

  private constructor() {}

  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  hasNip07Extension(): boolean {
    if (localStorage.getItem('nostr-has-active-signer') === 'true') {
      console.log('Using previously authenticated signer from localStorage');
      return true;
    }
    return typeof window !== 'undefined' && 'nostr' in window;
  }

  showModal(): void {
    const modal = document.createElement('onboarding-modal');
    document.body.appendChild(modal);
  }

  async connectWithBunker(connectionString: string, onSuccess?: () => void): Promise<void> {
    let bunkerUrl = connectionString;

    if (!bunkerUrl.startsWith('bunker://')) {
      try {
        const ndk = this.nostrService.getNDK();
        const user = ndk.getUser({ npub: nip19.decode(bunkerUrl).data as string });
        await user.fetchProfile();
        const bunkerProfile = user.profile?.nip46;

        if (typeof bunkerProfile === 'string') {
          const [pubkey, relay] = bunkerProfile.split('@');
          bunkerUrl = `bunker://${pubkey}?relay=${relay}`;
        } else {
          throw new Error('NIP-05 profile does not contain a bunker connection.');
        }
      } catch (error) {
        console.error('Failed to resolve NIP-05 identifier:', error);
        alert('Could not resolve the NIP-05 identifier. Please check and try again.');
        return;
      }
    }

    try {
      console.log('Attempting to connect with bunker URL:', bunkerUrl);
      const ndk = this.nostrService.getNDK();
      const signer = new NDKNip46Signer(ndk, bunkerUrl);
      this.nostrService.setSigner(signer);
      this.verifySignerConnection(signer, 'bunker', onSuccess);
    } catch (error) {
      console.error('Failed to connect with bunker:', error);
      alert('Failed to connect. Please check the bunker URL and try again.');
    }
  }

  connectWithQr(onSuccess?: () => void): NDKNip46Signer {
    try {
      const ndk = this.nostrService.getNDK();
      
      // Generate a new private key for this connection
      const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
      const hex = Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create a private key signer
      const localSigner = new NDKPrivateKeySigner(hex);
      
      // Create a NIP-46 signer with an empty target bunker URL - this creates a new delegation
      const signer = new NDKNip46Signer(ndk, "", localSigner);

      // Manually generate the auth URL
      // Access the public key from the signer using the correct property name
      const pubkey = localSigner.pubkey;
      const relay = "wss://relay.damus.io"; // Using a common relay
      const authUrl = `nostrconnect://${pubkey}?relay=${encodeURIComponent(relay)}&metadata=${encodeURIComponent(JSON.stringify({
        name: 'Nostr Components',
        url: window.location.origin
      }))}`;

      // Manually emit the authUrl event
      setTimeout(() => {
        signer.emit('authUrl', authUrl);
        console.log("Auth URL generated and emitted:", authUrl);
      }, 500);

      this.nostrService.setSigner(signer);
      this.verifySignerConnection(signer, 'nostrconnect', onSuccess);
      
      return signer;
    } catch (error) {
      console.error('Failed to initialize QR code signer:', error);
      alert('Could not set up QR code authentication. Please try again.');
      throw error;
    }
  }

  async generateQrCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, { width: 300 });
    } catch (err) {
      console.error('Failed to generate QR code', err);
      throw err;
    }
  }

  private verifySignerConnection(
    signer: NDKNip46Signer,
    method: 'bunker' | 'nostrconnect',
    onSuccess?: () => void
  ) {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        console.error(`Connection timed out for ${method}.`);
        alert('Connection timed out. Please approve the connection in your signer app.');
        return;
      }

      try {
        const user = await signer.user();
        if (user?.pubkey) {
          const npub = nip19.npubEncode(user.pubkey);
          console.log(`✅ ${method.toUpperCase()} SUCCESS! User npub:`, npub);
          clearInterval(interval);
          if (onSuccess) onSuccess();
        }
      } catch (e) {
        console.log(`Waiting for approval for ${method}... (${attempts}/${maxAttempts})`);
      }
    }, 1000);
  }
}

export const onboardingService = OnboardingService.getInstance();
