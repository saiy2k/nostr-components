import { generateSecretKey, getPublicKey } from 'nostr-tools';

export interface ConnectionStringParams {
  pubkey: string;
  relay: string;
  secret: string;
  name?: string;
  url?: string;
  icon?: string;
  perms?: string;
}

export interface AppMetadata {
  name: string;
  url?: string;
  icon?: string;
  description?: string;
}

export class ConnectionStringService {
  private static readonly DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net'
  ];

  /**
   * Generate a connection string for QR code authentication
   */
  public static generateConnectionString(
    appMetadata: AppMetadata,
    relays: string[] = this.DEFAULT_RELAYS,
    permissions: string[] = [
      'sign_event',
      'get_public_key', 
      'nip04_encrypt',
      'nip04_decrypt',
      'nip44_encrypt',
      'nip44_decrypt',
      'get_relays',
      'nip07_info'
    ]
  ): { connectionString: string; secret: string; pubkey: string } {
    // Generate temporary keypair for this connection
    const secret = this.generateSecret();
    const tempPrivateKey = generateSecretKey();
    const pubkey = getPublicKey(tempPrivateKey);

    // Build connection string parameters
    const params = new URLSearchParams();
    params.set('relay', relays[0]); // Primary relay
    params.set('secret', secret);
    
    if (appMetadata.name) params.set('name', appMetadata.name);
    if (appMetadata.url) params.set('url', appMetadata.url);
    if (appMetadata.icon) params.set('icon', appMetadata.icon);
    if (permissions.length > 0) params.set('perms', permissions.join(','));

    // Add additional relays
    relays.slice(1).forEach(relay => {
      params.append('relay', relay);
    });

    const connectionString = `nostrconnect://${pubkey}?${params.toString()}`;

    return {
      connectionString,
      secret,
      pubkey
    };
  }

  /**
   * Parse a connection string
   */
  public static parseConnectionString(connectionString: string): ConnectionStringParams | null {
    try {
      const url = new URL(connectionString);
      
      if (url.protocol !== 'nostrconnect:') {
        return null;
      }

      const pubkey = url.hostname || url.pathname.replace('//', '');
      const params = url.searchParams;

      const relay = params.get('relay');
      const secret = params.get('secret');

      if (!pubkey || !relay || !secret) {
        return null;
      }

      return {
        pubkey,
        relay,
        secret,
        name: params.get('name') || undefined,
        url: params.get('url') || undefined,
        icon: params.get('icon') || undefined,
        perms: params.get('perms') || undefined,
      };
    } catch (error) {
      console.error('Failed to parse connection string:', error);
      return null;
    }
  }

  /**
   * Generate a bunker URL for NIP-46
   */
  public static generateBunkerUrl(
    pubkey: string,
    relays: string[] = this.DEFAULT_RELAYS,
    secret?: string
  ): string {
    const params = new URLSearchParams();
    
    relays.forEach(relay => {
      params.append('relay', relay);
    });

    if (secret) {
      params.set('secret', secret);
    }

    return `bunker://${pubkey}?${params.toString()}`;
  }

  /**
   * Parse a bunker URL
   */
  public static parseBunkerUrl(bunkerUrl: string): { pubkey: string; relays: string[]; secret?: string } | null {
    try {
      const url = new URL(bunkerUrl);
      
      if (url.protocol !== 'bunker:') {
        return null;
      }

      const pubkey = url.hostname || url.pathname.replace('//', '');
      const params = url.searchParams;

      const relays = params.getAll('relay');
      const secret = params.get('secret') || undefined;

      if (!pubkey || relays.length === 0) {
        return null;
      }

      return {
        pubkey,
        relays,
        secret
      };
    } catch (error) {
      console.error('Failed to parse bunker URL:', error);
      return null;
    }
  }

  /**
   * Generate QR code data URL using qrcodejs library
   */
  public static async generateQRCode(text: string, size: number = 256): Promise<string> {
    try {
      // Import qrcodejs library
      const QRCode = (await import('qrcodejs')).default;
      
      // Create a temporary container for QR code generation
      const tempContainer = document.createElement('div');
      tempContainer.style.display = 'none';
      tempContainer.style.position = 'absolute';
      tempContainer.style.top = '-9999px';
      document.body.appendChild(tempContainer);
      
      return new Promise((resolve, reject) => {
        try {
          // Generate QR code with proper options
          new QRCode(tempContainer, {
            text: text,
            width: size,
            height: size,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
          
          // Wait for QR code to be generated
          setTimeout(() => {
            try {
              // Try to get canvas first (preferred)
              const canvas = tempContainer.querySelector('canvas') as HTMLCanvasElement;
              if (canvas) {
                const dataURL = canvas.toDataURL('image/png');
                document.body.removeChild(tempContainer);
                resolve(dataURL);
                return;
              }
              
              // Fallback to img element
              const img = tempContainer.querySelector('img') as HTMLImageElement;
              if (img && img.src) {
                // Convert img to canvas to get data URL
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = size;
                canvas.height = size;
                
                img.onload = () => {
                  ctx.drawImage(img, 0, 0, size, size);
                  const dataURL = canvas.toDataURL('image/png');
                  document.body.removeChild(tempContainer);
                  resolve(dataURL);
                };
                
                img.onerror = () => {
                  document.body.removeChild(tempContainer);
                  reject(new Error('Failed to load QR code image'));
                };
                
                // If img.src is already a data URL, trigger onload
                if (img.complete) {
                  img.onload!(null as any);
                }
                return;
              }
              
              // No QR code element found
              document.body.removeChild(tempContainer);
              reject(new Error('No QR code element generated'));
            } catch (error) {
              document.body.removeChild(tempContainer);
              reject(error);
            }
          }, 200); // Increased timeout for generation
          
        } catch (error) {
          document.body.removeChild(tempContainer);
          reject(error);
        }
      });
    } catch (error) {
      console.error('QR code generation failed:', error);
      return this.generateFallbackQR(text, size);
    }
  }

  /**
   * Generate fallback QR-like pattern
   */
  private static generateFallbackQR(text: string, size: number = 256): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = size;
    canvas.height = size;
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    // Create a recognizable pattern with the text
    ctx.fillStyle = '#000000';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    
    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    
    // Draw text (truncated)
    const maxLength = 30;
    const displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    ctx.fillText('QR Code', size / 2, 30);
    ctx.fillText(displayText, size / 2, size / 2);
    ctx.fillText('Scan with Nostr app', size / 2, size - 30);
    
    return canvas.toDataURL();
  }



  /**
   * Validate connection string format
   */
  public static isValidConnectionString(connectionString: string): boolean {
    return this.parseConnectionString(connectionString) !== null;
  }

  /**
   * Validate bunker URL format
   */
  public static isValidBunkerUrl(bunkerUrl: string): boolean {
    return this.parseBunkerUrl(bunkerUrl) !== null;
  }

  // Private helper methods
  private static generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }


}
