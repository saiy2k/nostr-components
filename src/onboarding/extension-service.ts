export interface NostrExtension {
  name: string;
  nip07: boolean;
  getPublicKey(): Promise<string>;
  signEvent(event: any): Promise<any>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

export interface DetectedExtension {
  name: string;
  enabled: boolean;
  extension: NostrExtension;
}

export class ExtensionService {
  private static instance: ExtensionService;
  private extensions: DetectedExtension[] = [];
  private currentExtension: DetectedExtension | null = null;
  private listeners: ((extensions: DetectedExtension[]) => void)[] = [];

  private constructor() {
    this.detectExtensions();
    this.startPolling();
  }

  public static getInstance(): ExtensionService {
    if (!ExtensionService.instance) {
      ExtensionService.instance = new ExtensionService();
    }
    return ExtensionService.instance;
  }

  public getExtensions(): DetectedExtension[] {
    return this.extensions;
  }

  /**
   * Get current extension
   */
  public getCurrentExtension(): DetectedExtension | null {
    return this.currentExtension;
  }

  /**
   * Refresh extension detection
   */
  public refresh(): void {
    this.detectExtensions();
  }

  public setCurrentExtension(extension: DetectedExtension | null): void {
    this.currentExtension = extension;
    if (extension) {
      // Set window.nostr to the selected extension
      (window as any).nostr = extension.extension;
    }
  }

  public onExtensionsChanged(callback: (extensions: DetectedExtension[]) => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: (extensions: DetectedExtension[]) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private detectExtensions(): void {
    const newExtensions: DetectedExtension[] = [];

    // Check for common Nostr extensions
    const extensionChecks = [
      { name: 'Alby', key: 'alby' },
      { name: 'nos2x', key: 'nos2x' },
      { name: 'Flamingo', key: 'flamingo' },
      { name: 'Horse', key: 'horse' },
      { name: 'Blockcore', key: 'blockcore' },
    ];

    // Check window.nostr (standard)
    if ((window as any).nostr) {
      const nostr = (window as any).nostr;
      if (this.isValidNostrExtension(nostr)) {
        newExtensions.push({
          name: 'Default Nostr Extension',
          enabled: true,
          extension: nostr,
        });
      }
    }

    // Check for specific extension objects
    extensionChecks.forEach(({ name, key }) => {
      const ext = (window as any)[key];
      if (ext && ext.nostr && this.isValidNostrExtension(ext.nostr)) {
        newExtensions.push({
          name,
          enabled: true,
          extension: ext.nostr,
        });
      }
    });

    // Check if extensions changed
    if (this.extensionsChanged(newExtensions)) {
      this.extensions = newExtensions;
      
      // Auto-select first extension if none selected
      if (!this.currentExtension && newExtensions.length > 0) {
        this.setCurrentExtension(newExtensions[0]);
      }

      // Notify listeners
      this.listeners.forEach(callback => callback(this.extensions));
    }
  }

  private isValidNostrExtension(obj: any): obj is NostrExtension {
    return (
      obj &&
      typeof obj.getPublicKey === 'function' &&
      typeof obj.signEvent === 'function'
    );
  }

  private extensionsChanged(newExtensions: DetectedExtension[]): boolean {
    if (this.extensions.length !== newExtensions.length) {
      return true;
    }

    return !this.extensions.every((ext, index) => 
      ext.name === newExtensions[index]?.name &&
      ext.enabled === newExtensions[index]?.enabled
    );
  }

  private startPolling(): void {
    // Poll for new extensions every 2 seconds
    setInterval(() => {
      this.detectExtensions();
    }, 2000);
  }

  public async testExtension(extension: DetectedExtension): Promise<boolean> {
    try {
      await extension.extension.getPublicKey();
      return true;
    } catch (error) {
      console.warn(`Extension ${extension.name} test failed:`, error);
      return false;
    }
  }
}
