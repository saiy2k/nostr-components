import { generateSecretKey, getPublicKey } from 'nostr-tools';

export interface StoredKey {
  pubkey: string;
  encrypted: string;
  salt: string;
  iv: string;
}

export class SecureStorage {
  private static readonly STORAGE_KEY = 'nostr_secure_keys';
  private static readonly CURRENT_KEY = 'nostr_current_key';

  /**
   * Generate a new keypair and store it securely
   */
  public static async generateAndStoreKey(password: string): Promise<{ pubkey: string; nsec: string }> {
    const privateKey = generateSecretKey();
    const pubkey = getPublicKey(privateKey);
    const nsec = this.bytesToHex(privateKey);

    await this.storeKey(nsec, password);
    
    return { pubkey, nsec };
  }

  /**
   * Store a private key securely with password encryption
   */
  public static async storeKey(nsec: string, password: string): Promise<void> {
    try {
      // Generate salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt the private key
      const encoder = new TextEncoder();
      const data = encoder.encode(nsec);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      // Get public key for identification
      const privateKeyBytes = this.hexToBytes(nsec);
      const pubkey = getPublicKey(privateKeyBytes);

      const storedKey: StoredKey = {
        pubkey,
        encrypted: this.arrayBufferToBase64(encrypted),
        salt: this.arrayBufferToBase64(salt),
        iv: this.arrayBufferToBase64(iv),
      };

      // Store in localStorage
      const existingKeys = this.getStoredKeys();
      const updatedKeys = existingKeys.filter(k => k.pubkey !== pubkey);
      updatedKeys.push(storedKey);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedKeys));
      localStorage.setItem(this.CURRENT_KEY, pubkey);
    } catch (error) {
      console.error('Failed to store key securely:', error);
      throw new Error('Failed to store key securely');
    }
  }

  /**
   * Retrieve and decrypt a stored key
   */
  public static async retrieveKey(pubkey: string, password: string): Promise<string | null> {
    try {
      const storedKeys = this.getStoredKeys();
      const storedKey = storedKeys.find(k => k.pubkey === pubkey);

      if (!storedKey) {
        return null;
      }

      // Convert base64 back to arrays
      const salt = this.base64ToArrayBuffer(storedKey.salt);
      const iv = this.base64ToArrayBuffer(storedKey.iv);
      const encrypted = this.base64ToArrayBuffer(storedKey.encrypted);

      // Derive key from password
      const key = await this.deriveKey(password, new Uint8Array(salt));

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Failed to retrieve key:', error);
      return null;
    }
  }

  /**
   * Get all stored public keys
   */
  public static getStoredKeys(): StoredKey[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get current active key pubkey
   */
  public static getCurrentKeyPubkey(): string | null {
    return localStorage.getItem(this.CURRENT_KEY);
  }

  /**
   * Set current active key
   */
  public static setCurrentKey(pubkey: string): void {
    localStorage.setItem(this.CURRENT_KEY, pubkey);
  }

  /**
   * Remove a stored key
   */
  public static removeKey(pubkey: string): void {
    const existingKeys = this.getStoredKeys();
    const updatedKeys = existingKeys.filter(k => k.pubkey !== pubkey);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedKeys));

    // Clear current key if it was the removed one
    if (this.getCurrentKeyPubkey() === pubkey) {
      localStorage.removeItem(this.CURRENT_KEY);
    }
  }

  /**
   * Clear all stored keys
   */
  public static clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_KEY);
  }

  /**
   * Store key in legacy format (unencrypted) - for backward compatibility
   */
  public static storeLegacyKey(nsec: string): void {
    localStorage.setItem('nostr_nsec', nsec);
  }

  /**
   * Get legacy key if exists
   */
  public static getLegacyKey(): string | null {
    return localStorage.getItem('nostr_nsec');
  }

  /**
   * Migrate legacy key to secure storage
   */
  public static async migrateLegacyKey(password: string): Promise<boolean> {
    const legacyKey = this.getLegacyKey();
    if (!legacyKey) {
      return false;
    }

    try {
      await this.storeKey(legacyKey, password);
      localStorage.removeItem('nostr_nsec');
      return true;
    } catch {
      return false;
    }
  }

  // Utility methods
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}
