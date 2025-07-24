import NDK, { NDKEvent, NDKKind, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey, nip04 } from 'nostr-tools';
import { DEFAULT_RELAYS } from '../common/constants';

export interface OTPSession {
  sessionId: string;
  userPubkey: string;
  code: string;
  expiresAt: number;
  verified: boolean;
}

export class OTPService {
  private ndk: NDK;
  private sessions: Map<string, OTPSession> = new Map();
  private tempSigner: NDKPrivateKeySigner;
  private tempPubkey: string;

  constructor() {
    this.ndk = new NDK({ explicitRelayUrls: DEFAULT_RELAYS });
    
    // Create temporary keypair for OTP service
    const tempPrivateKey = generateSecretKey();
    this.tempSigner = new NDKPrivateKeySigner(tempPrivateKey);
    this.tempPubkey = getPublicKey(tempPrivateKey);
  }

  /**
   * Initialize the OTP service
   */
  public async initialize(): Promise<void> {
    await this.ndk.connect();
    this.startListening();
  }

  /**
   * Send OTP code to user via DM
   */
  public async sendOTP(userPubkey: string): Promise<string> {
    try {
      // Validate pubkey format
      if (!this.isValidPubkey(userPubkey)) {
        throw new Error('Invalid pubkey format');
      }

      // Generate session
      const sessionId = this.generateSessionId();
      const code = this.generateOTPCode();
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

      const session: OTPSession = {
        sessionId,
        userPubkey,
        code,
        expiresAt,
        verified: false
      };

      this.sessions.set(sessionId, session);

      // Create DM with OTP code
      const message = `Your Nostr login code is: ${code}\n\nThis code expires in 10 minutes.\n\nSession: ${sessionId}`;
      
      await this.sendDirectMessage(userPubkey, message);

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      return sessionId;
    } catch (error) {
      console.error('Failed to send OTP:', error);
      throw new Error('Failed to send OTP code');
    }
  }

  /**
   * Verify OTP code
   */
  public async verifyOTP(sessionId: string, code: string): Promise<{ success: boolean; pubkey?: string }> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { success: false };
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return { success: false };
    }

    if (session.code !== code.trim()) {
      return { success: false };
    }

    // Mark as verified
    session.verified = true;
    this.sessions.set(sessionId, session);

    return { 
      success: true, 
      pubkey: session.userPubkey 
    };
  }

  /**
   * Get session info
   */
  public getSession(sessionId: string): OTPSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      return null;
    }
    return session;
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Resolve npub/username to pubkey
   */
  public async resolveToPubkey(identifier: string): Promise<string | null> {
    try {
      // If it's already a hex pubkey
      if (this.isValidPubkey(identifier)) {
        return identifier;
      }

      // If it's an npub
      if (identifier.startsWith('npub1')) {
        try {
          const { data } = this.bech32Decode(identifier);
          return this.bytesToHex(data);
        } catch {
          return null;
        }
      }

      // If it's a NIP-05 identifier (username@domain.com)
      if (identifier.includes('@')) {
        return await this.resolveNip05(identifier);
      }

      // If it's just a username, try common domains
      const commonDomains = ['nostr.band', 'iris.to', 'snort.social', 'damus.io'];
      for (const domain of commonDomains) {
        const nip05 = `${identifier}@${domain}`;
        const pubkey = await this.resolveNip05(nip05);
        if (pubkey) {
          return pubkey;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to resolve identifier:', error);
      return null;
    }
  }

  // Private methods
  private async sendDirectMessage(recipientPubkey: string, message: string): Promise<void> {
    try {
      const event = new NDKEvent(this.ndk);
      event.kind = NDKKind.EncryptedDirectMessage;
      event.tags = [['p', recipientPubkey]];
      
      // Encrypt the message using NIP-04
      const encrypted = await nip04.encrypt(
        this.tempSigner.privateKey!,
        recipientPubkey,
        message
      );
      
      event.content = encrypted;
      await event.sign(this.tempSigner);
      await event.publish();
    } catch (error) {
      console.error('Failed to send DM:', error);
      throw error;
    }
  }

  private startListening(): void {
    // Listen for incoming DMs (for potential replies)
    const filter = {
      kinds: [NDKKind.EncryptedDirectMessage],
      '#p': [this.tempPubkey],
      since: Math.floor(Date.now() / 1000)
    };

    const subscription = this.ndk.subscribe(filter);
    
    subscription.on('event', (event: NDKEvent) => {
      this.handleIncomingDM(event);
    });
  }

  private async handleIncomingDM(event: NDKEvent): Promise<void> {
    try {
      // Decrypt the message
      const decrypted = await nip04.decrypt(
        this.tempSigner.privateKey!,
        event.pubkey,
        event.content
      );

      console.log('Received DM:', decrypted);
      // Handle any incoming messages if needed
    } catch (error) {
      console.error('Failed to decrypt incoming DM:', error);
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateOTPCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private isValidPubkey(pubkey: string): boolean {
    return /^[0-9a-f]{64}$/i.test(pubkey);
  }

  private async resolveNip05(nip05: string): Promise<string | null> {
    try {
      const [name, domain] = nip05.split('@');
      if (!name || !domain) return null;

      const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
      const response = await fetch(url);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.names?.[name] || null;
    } catch {
      return null;
    }
  }

  // Utility methods for bech32 decoding (simplified)
  private bech32Decode(str: string): { prefix: string; data: Uint8Array } {
    // Simplified bech32 decoder - in production use proper library
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    
    if (str.length < 8) throw new Error('Invalid bech32 string');
    
    const pos = str.lastIndexOf('1');
    if (pos < 1 || pos + 7 > str.length) throw new Error('Invalid bech32 string');
    
    const prefix = str.substring(0, pos);
    const data = str.substring(pos + 1);
    
    // Convert from bech32 charset to 5-bit values
    const values = [];
    for (let i = 0; i < data.length - 6; i++) {
      const char = data[i];
      const value = CHARSET.indexOf(char);
      if (value === -1) throw new Error('Invalid character in bech32 string');
      values.push(value);
    }
    
    // Convert from 5-bit to 8-bit
    const bytes = this.convertBits(values, 5, 8, false);
    
    return {
      prefix,
      data: new Uint8Array(bytes)
    };
  }

  private convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
    let acc = 0;
    let bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;
    
    for (const value of data) {
      if (value < 0 || (value >> fromBits) !== 0) {
        throw new Error('Invalid data for base conversion');
      }
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push((acc >> bits) & maxv);
      }
    }
    
    if (pad) {
      if (bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
      }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
      throw new Error('Invalid padding in base conversion');
    }
    
    return ret;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
