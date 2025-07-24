import NDK, { NDKEvent, NDKKind, NDKPrivateKeySigner, NDKRelay } from '@nostr-dev-kit/ndk';
import { getPublicKey, generateSecretKey, finalizeEvent, verifyEvent } from 'nostr-tools';
import { ConnectionStringService } from './connection-string';

export interface Nip46Request {
  id: string;
  method: string;
  params: any[];
}

export interface Nip46Response {
  id: string;
  result?: any;
  error?: string;
}

export interface BunkerConnection {
  pubkey: string;
  relays: string[];
  secret?: string;
  connected: boolean;
}

export class Nip46Service {
  private ndk: NDK;
  private connection: BunkerConnection | null = null;
  private pendingRequests: Map<string, (response: Nip46Response) => void> = new Map();
  private eventListeners: ((event: NDKEvent) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];

  constructor() {
    this.ndk = new NDK();
  }

  /**
   * Connect to a bunker using bunker URL
   */
  public async connectToBunker(bunkerUrl: string): Promise<boolean> {
    try {
      const parsed = ConnectionStringService.parseBunkerUrl(bunkerUrl);
      if (!parsed) {
        throw new Error('Invalid bunker URL format');
      }

      // Set up NDK with bunker relays
      this.ndk.explicitRelayUrls = parsed.relays;
      await this.ndk.connect();

      // Set up connection (but not marked as connected yet)
      this.connection = {
        pubkey: parsed.pubkey,
        relays: parsed.relays,
        secret: parsed.secret,
        connected: false // Not connected until verified
      };

      // Start listening for responses
      this.startListening();

      // Test the connection by sending a ping/get_public_key request
      try {
        console.log('Testing bunker connection...');
        const pubkey = await this.testConnection();
        
        if (pubkey) {
          // Connection verified!
          this.connection.connected = true;
          console.log('Bunker connection verified, pubkey:', pubkey);
          
          // Notify connection listeners
          this.connectionListeners.forEach(listener => listener(true));
          return true;
        } else {
          throw new Error('Failed to verify bunker connection');
        }
      } catch (testError) {
        console.error('Bunker connection test failed:', testError);
        this.connection = null;
        this.connectionListeners.forEach(listener => listener(false));
        return false;
      }
    } catch (error) {
      console.error('Failed to connect to bunker:', error);
      this.connection = null;
      this.connectionListeners.forEach(listener => listener(false));
      return false;
    }
  }

  /**
   * Test bunker connection by sending a get_public_key request
   */
  private async testConnection(): Promise<string | null> {
    if (!this.connection) {
      return null;
    }

    const requestId = this.generateRequestId();
    const request: Nip46Request = {
      id: requestId,
      method: 'get_public_key',
      params: []
    };

    return new Promise((resolve) => {
      // Store the resolver for this request
      this.pendingRequests.set(requestId, (response: Nip46Response) => {
        if (response.error) {
          console.error('Bunker test request failed:', response.error);
          resolve(null);
        } else {
          resolve(response.result);
        }
      });

      // Send the test request
      this.sendRequestEvent(request).catch((error) => {
        console.error('Failed to send test request:', error);
        resolve(null);
      });

      // Set shorter timeout for connection test
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          console.log('Bunker connection test timeout');
          resolve(null);
        }
      }, 10000); // 10 second timeout for connection test
    });
  }

  /**
   * Disconnect from bunker
   */
  public async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.connected = false;
      this.connection = null;
      
      // Clear pending requests
      this.pendingRequests.clear();
      
      // Notify listeners
      this.connectionListeners.forEach(listener => listener(false));
    }
  }

  /**
   * Check if connected to bunker
   */
  public isConnected(): boolean {
    return this.connection?.connected || false;
  }

  /**
   * Get current connection info
   */
  public getConnection(): BunkerConnection | null {
    return this.connection;
  }

  /**
   * Send a request to the bunker
   */
  public async sendRequest(method: string, params: any[] = []): Promise<any> {
    if (!this.connection || !this.connection.connected) {
      throw new Error('Not connected to bunker');
    }

    const requestId = this.generateRequestId();
    const request: Nip46Request = {
      id: requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Store the resolver for this request
      this.pendingRequests.set(requestId, (response: Nip46Response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      });

      // Send the request
      this.sendRequestEvent(request).catch(reject);

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Get public key from bunker
   */
  public async getPublicKey(): Promise<string> {
    return this.sendRequest('get_public_key');
  }

  /**
   * Sign event using bunker
   */
  public async signEvent(event: any): Promise<any> {
    return this.sendRequest('sign_event', [event]);
  }

  /**
   * Get relays from bunker
   */
  public async getRelays(): Promise<Record<string, { read: boolean; write: boolean }>> {
    try {
      return await this.sendRequest('get_relays');
    } catch {
      // Return default if not supported
      return {};
    }
  }

  /**
   * NIP-04 encrypt
   */
  public async nip04Encrypt(pubkey: string, plaintext: string): Promise<string> {
    return this.sendRequest('nip04_encrypt', [pubkey, plaintext]);
  }

  /**
   * NIP-04 decrypt
   */
  public async nip04Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    return this.sendRequest('nip04_decrypt', [pubkey, ciphertext]);
  }

  /**
   * NIP-44 encrypt
   */
  public async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    return this.sendRequest('nip44_encrypt', [pubkey, plaintext]);
  }

  /**
   * NIP-44 decrypt
   */
  public async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    return this.sendRequest('nip44_decrypt', [pubkey, ciphertext]);
  }

  /**
   * Add connection listener
   */
  public onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
  }

  /**
   * Remove connection listener
   */
  public removeConnectionListener(callback: (connected: boolean) => void): void {
    const index = this.connectionListeners.indexOf(callback);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  // Private methods
  private async sendRequestEvent(request: Nip46Request): Promise<void> {
    if (!this.connection) {
      throw new Error('No connection');
    }

    // Create temporary keypair for this request
    const tempPrivateKey = generateSecretKey();
    const tempSigner = new NDKPrivateKeySigner(tempPrivateKey);

    // Create the request event
    const event = new NDKEvent(this.ndk);
    event.kind = NDKKind.NostrConnect;
    event.content = JSON.stringify(request);
    event.tags = [['p', this.connection.pubkey]];

    // Sign and publish
    await event.sign(tempSigner);
    await event.publish();
  }

  private startListening(): void {
    if (!this.connection) return;

    // Subscribe to responses
    const filter = {
      kinds: [NDKKind.NostrConnect],
      '#p': [this.connection.pubkey],
      since: Math.floor(Date.now() / 1000)
    };

    const subscription = this.ndk.subscribe(filter);
    
    subscription.on('event', (event: NDKEvent) => {
      this.handleResponseEvent(event);
    });
  }

  private handleResponseEvent(event: NDKEvent): void {
    try {
      const response: Nip46Response = JSON.parse(event.content);
      
      if (response.id && this.pendingRequests.has(response.id)) {
        const resolver = this.pendingRequests.get(response.id)!;
        this.pendingRequests.delete(response.id);
        resolver(response);
      }
    } catch (error) {
      console.error('Failed to handle response event:', error);
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Create a signer that uses this bunker connection
   */
  public createSigner(): BunkerSigner {
    return new BunkerSigner(this);
  }
}

/**
 * NDK-compatible signer that uses NIP-46 bunker
 */
export class BunkerSigner {
  private bunkerService: Nip46Service;

  constructor(bunkerService: Nip46Service) {
    this.bunkerService = bunkerService;
  }

  public async user(): Promise<{ pubkey: string }> {
    const pubkey = await this.bunkerService.getPublicKey();
    return { pubkey };
  }

  public async sign(event: NDKEvent): Promise<string> {
    const eventData = {
      kind: event.kind,
      content: event.content,
      tags: event.tags,
      created_at: event.created_at || Math.floor(Date.now() / 1000),
      pubkey: await this.bunkerService.getPublicKey()
    };

    const signedEvent = await this.bunkerService.signEvent(eventData);
    return signedEvent.sig;
  }

  public async encrypt(recipient: string, plaintext: string): Promise<string> {
    try {
      return await this.bunkerService.nip44Encrypt(recipient, plaintext);
    } catch {
      // Fallback to NIP-04 if NIP-44 not supported
      return await this.bunkerService.nip04Encrypt(recipient, plaintext);
    }
  }

  public async decrypt(sender: string, ciphertext: string): Promise<string> {
    try {
      return await this.bunkerService.nip44Decrypt(sender, ciphertext);
    } catch {
      // Fallback to NIP-04 if NIP-44 not supported
      return await this.bunkerService.nip04Decrypt(sender, ciphertext);
    }
  }
}
