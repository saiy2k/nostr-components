import { Theme } from '../common/types';
import { ExtensionService, DetectedExtension } from './extension-service';
import { SecureStorage } from './secure-storage';
import { ConnectionStringService, AppMetadata } from './connection-string';
import { Nip46Service } from './nip46-service';
import { OTPService } from './otp-service';

const overlayStyles = `
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    backdrop-filter: blur(4px);
    background: rgba(0,0,0,0.6);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal {
    width: 90%;
    max-width: 480px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--nc-bg, #fff);
    color: var(--nc-fg, #000);
    border-radius: 12px;
    padding: 24px 20px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    font-family: system-ui, Arial, sans-serif;
    position: relative;
  }
  h2 { margin-top: 0; font-size: 1.25rem; }
  h3 { font-size: 1.1rem; margin: 16px 0 8px 0; }
  p { font-size: .9rem; line-height: 1.4; margin: 8px 0; }
  .btn-row { margin-top: 16px; display:flex; gap: 8px; flex-wrap:wrap; }
  button {
    flex: 1;
    padding: 10px 14px;
    font-size: .9rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background: var(--nc-accent, #8a63d2);
    color: #fff;
    min-width: 120px;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  button.secondary { background: #e5e5e5; color: #000; }
  button.small { flex: none; padding: 6px 12px; font-size: .8rem; }
  input[type="text"], input[type="password"] {
    padding: 8px 10px;
    width: 100%;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-top: 8px;
    box-sizing: border-box;
  }
  label { font-size: .8rem; display:flex; align-items:center; gap:6px; margin: 8px 0; }
  .close {
    position:absolute;
    top:8px;
    right:12px;
    font-size:1.2rem;
    cursor:pointer;
    z-index: 1000;
    padding: 4px;
    user-select: none;
    color: var(--nc-accent, #8a63d2);
  }
  .close:hover {
    background: rgba(138, 99, 210, 0.1);
    border-radius: 4px;
  }
  .qr-container {
    text-align: center;
    margin: 16px 0;
  }
  .qr-code {
    max-width: 200px;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  .extension-list {
    margin: 12px 0;
  }
  .extension-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin: 4px 0;
  }
  .extension-item.selected {
    border-color: var(--nc-accent, #8a63d2);
    background: rgba(138, 99, 210, 0.1);
  }
  .loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid var(--nc-accent, #8a63d2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .error {
    color: #d32f2f;
    font-size: .8rem;
    margin-top: 4px;
  }
  .success {
    color: #2e7d32;
    font-size: .8rem;
    margin-top: 4px;
  }
  .back-btn {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--nc-accent, #8a63d2);
    z-index: 1000;
    padding: 4px;
    user-select: none;
  }
  .back-btn:hover {
    background: rgba(138, 99, 210, 0.1);
    border-radius: 4px;
  }
`;

type Screen = 'welcome' | 'new' | 'existing' | 'extension' | 'qr' | 'bunker' | 'otp' | 'otp-verify' | 'secure-key' | 'generate-key';

export default class NostrOnboardingModal extends HTMLElement {
  private screen: Screen = 'welcome';
  private theme: Theme = 'light';
  private pendingAction: string = '';
  private retryCallback?: () => void;
  
  // Services
  private extensionService: ExtensionService;
  private nip46Service: Nip46Service;
  private otpService: OTPService;
  
  // State
  private selectedExtension: DetectedExtension | null = null;
  private qrConnectionString: string = '';
  private qrSecret: string = '';
  private qrPubkey: string = '';
  private otpSessionId: string = '';
  private isLoading: boolean = false;
  private errorMessage: string = '';
  private successMessage: string = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Initialize services
    this.extensionService = ExtensionService.getInstance();
    this.nip46Service = new Nip46Service();
    this.otpService = new OTPService();
    
    // Initialize OTP service
    this.otpService.initialize().catch(console.error);
  }

  connectedCallback() {
    this.render();
    
    // Listen for extension changes
    this.extensionService.onExtensionsChanged(() => {
      if (this.screen === 'extension') {
        this.render();
      }
    });
  }

  disconnectedCallback() {
    // Cleanup
    this.extensionService.removeListener(() => {});
  }

  public setPendingAction(desc: string, retry?: () => void) {
    this.pendingAction = desc;
    this.retryCallback = retry;
    this.screen = 'welcome';
    this.render();
  }

  private setScreen(s: Screen) {
    this.screen = s;
    this.errorMessage = '';
    this.isLoading = false;
    this.render();
  }

  private close(retry: boolean = true) {
    this.remove();
    if (retry && this.retryCallback) {
      setTimeout(() => this.retryCallback?.(), 300);
    }
  }

  private handleSignInSuccess() {
    // Show success message and enable actions
    this.showSuccess('Authentication successful! You can now perform actions.');
    
    // Close modal after a brief delay to show success message
    setTimeout(() => {
      this.close();
    }, 2000);
  }

  private showSuccess(message: string) {
    this.errorMessage = '';
    this.successMessage = message;
    this.isLoading = false;
    this.render();
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.isLoading = false;
    this.render();
  }

  private showLoading() {
    this.isLoading = true;
    this.errorMessage = '';
    this.render();
  }

  private setupSigner(signer: any, pubkey: string) {
    // Set up the signer in the global context for components to use
    (window as any).nostr = signer;
    
    // Store signer info for components
    localStorage.setItem('nostr-signer-type', 'extension');
    localStorage.setItem('nostr-pubkey', pubkey);
    
    // Dispatch event to notify components that signer is ready
    window.dispatchEvent(new CustomEvent('nostr-signer-ready', {
      detail: { signer, pubkey, type: 'extension' }
    }));
    
    console.log('Signer configured:', { pubkey, type: 'extension' });
  }

  private setupBunkerSigner(nip46Service: any, pubkey: string) {
    // Create a signer interface that wraps the NIP-46 service
    const bunkerSigner = {
      getPublicKey: () => Promise.resolve(pubkey),
      signEvent: (event: any) => nip46Service.signEvent(event),
      getRelays: () => nip46Service.getRelays?.() || Promise.resolve({}),
      nip04: {
        encrypt: (pubkey: string, plaintext: string) => nip46Service.encrypt?.(pubkey, plaintext),
        decrypt: (pubkey: string, ciphertext: string) => nip46Service.decrypt?.(pubkey, ciphertext)
      }
    };
    
    // Set up the signer in the global context
    (window as any).nostr = bunkerSigner;
    
    // Store signer info for components
    localStorage.setItem('nostr-signer-type', 'bunker');
    localStorage.setItem('nostr-pubkey', pubkey);
    
    // Dispatch event to notify components that signer is ready
    window.dispatchEvent(new CustomEvent('nostr-signer-ready', {
      detail: { signer: bunkerSigner, pubkey, type: 'bunker' }
    }));
    
    console.log('Bunker signer configured:', { pubkey, type: 'bunker' });
  }

  private setupOTPSigner(otpService: any, pubkey: string) {
    // Create a signer interface that wraps the OTP service
    const otpSigner = {
      getPublicKey: () => Promise.resolve(pubkey),
      signEvent: (event: any) => otpService.signEvent?.(event) || Promise.reject('OTP signing not implemented'),
      getRelays: () => Promise.resolve({}),
      nip04: {
        encrypt: (pubkey: string, plaintext: string) => otpService.encrypt?.(pubkey, plaintext),
        decrypt: (pubkey: string, ciphertext: string) => otpService.decrypt?.(pubkey, ciphertext)
      }
    };
    
    // Set up the signer in the global context
    (window as any).nostr = otpSigner;
    
    // Store signer info for components
    localStorage.setItem('nostr-signer-type', 'otp');
    localStorage.setItem('nostr-pubkey', pubkey);
    
    // Dispatch event to notify components that signer is ready
    window.dispatchEvent(new CustomEvent('nostr-signer-ready', {
      detail: { signer: otpSigner, pubkey, type: 'otp' }
    }));
    
    console.log('OTP signer configured:', { pubkey, type: 'otp' });
  }

  /**
   * Generate QR code and display it on canvas
   */
  private async generateQRCodeForCanvas(canvas: HTMLCanvasElement, connectionString: string) {
    try {
      console.log('Generating QR code for:', connectionString);
      
      // Use qrcodejs directly on the canvas
      const QRCode = (await import('qrcodejs')).default;
      
      // Clear canvas first
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 256;
        canvas.height = 256;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Create a temporary container for QR generation
      const tempDiv = document.createElement('div');
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
      
      try {
        // Generate QR code in temp container
        new QRCode(tempDiv, {
          text: connectionString,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
        
        // Wait for QR code generation
        setTimeout(() => {
          const qrCanvas = tempDiv.querySelector('canvas') as HTMLCanvasElement;
          const qrImg = tempDiv.querySelector('img') as HTMLImageElement;
          
          if (qrCanvas && ctx) {
            // Copy from generated canvas to our canvas
            ctx.drawImage(qrCanvas, 0, 0, 256, 256);
            console.log('QR code drawn from canvas');
          } else if (qrImg && ctx) {
            // Copy from generated image to our canvas
            qrImg.onload = () => {
              ctx.drawImage(qrImg, 0, 0, 256, 256);
              console.log('QR code drawn from image');
            };
            if (qrImg.complete) {
              qrImg.onload!(null as any);
            }
          } else {
            console.error('No QR code element found in temp container');
            this.drawFallbackQR(canvas, connectionString);
          }
          
          // Cleanup
          document.body.removeChild(tempDiv);
        }, 300);
        
      } catch (error) {
        console.error('QR code generation error:', error);
        document.body.removeChild(tempDiv);
        this.drawFallbackQR(canvas, connectionString);
      }
      
    } catch (error) {
      console.error('Failed to load QRCode library:', error);
      this.drawFallbackQR(canvas, connectionString);
    }
  }

  /**
   * Draw fallback QR-like pattern on canvas
   */
  private drawFallbackQR(canvas: HTMLCanvasElement, text: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 256;
    canvas.height = 256;
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    
    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 236, 236);
    
    // Draw text
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', 128, 40);
    ctx.font = '12px Arial';
    const shortText = text.length > 30 ? text.substring(0, 30) + '...' : text;
    ctx.fillText(shortText, 128, 128);
    ctx.fillText('Scan with Nostr app', 128, 220);
    
    console.log('Fallback QR pattern drawn');
  }

  private render() {
    const root = this.shadowRoot!;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = overlayStyles;
    root.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close(false);
    });

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Add back button for sub-screens
    if (this.screen !== 'welcome' && this.screen !== 'new') {
      const backBtn = document.createElement('span');
      backBtn.textContent = '←';
      backBtn.className = 'back-btn';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setScreen('existing');
      });
      modal.appendChild(backBtn);
    }

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.className = 'close';
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close(false);
    });
    modal.appendChild(closeBtn);

    // Render screen content
    this.renderScreenContent(modal);

    // Add error/success messages
    if (this.errorMessage) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'color: #d32f2f; background: #ffebee; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.9rem;';
      errorDiv.textContent = this.errorMessage;
      modal.appendChild(errorDiv);
    }
    
    if (this.successMessage) {
      const successDiv = document.createElement('div');
      successDiv.style.cssText = 'color: #2e7d32; background: #e8f5e8; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.9rem;';
      successDiv.textContent = this.successMessage;
      modal.appendChild(successDiv);
    }

    // Add loading indicator
    if (this.isLoading) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.cssText = 'text-align: center; padding: 16px;';
      loadingDiv.innerHTML = '<div class="loading"></div> Processing...';
      modal.appendChild(loadingDiv);
    }

    overlay.appendChild(modal);
    root.appendChild(overlay);

    // Wire up event listeners
    this.attachEventListeners(modal);
  }

  private renderScreenContent(modal: HTMLElement) {
    switch (this.screen) {
      case 'welcome':
        modal.innerHTML += `
          <h2>Welcome to Nostr</h2>
          <p>You need a Nostr signer to ${this.pendingAction || 'continue'}.</p>
          <div class="btn-row">
            <button id="new">New user</button>
            <button id="existing" class="secondary">Existing user</button>
          </div>
        `;
        break;

      case 'new':
        modal.innerHTML += `
          <h2>Getting started</h2>
          <p>Nostr is an open protocol for decentralized social apps.</p>
          <div class="btn-row">
            <button id="generate-key">Generate new key</button>
            <button id="manual-setup" class="secondary">Manual setup</button>
          </div>
          <div id="manual-content" style="display: none;">
            <p>1. Create your profile at <a href="https://nstart.me" target="_blank">nstart.me</a><br>
              2. Copy your <b>nsec</b> (private key)<br>
              3. Install a signer extension/app at <a href="https://nsec.app" target="_blank">nsec.app</a></p>
            <p><a href="https://youtu.be/8thRYn14nB0" target="_blank">Watch a 2-min intro video</a></p>
            <div class="btn-row">
              <button id="done">I am ready</button>
            </div>
          </div>
        `;
        break;

      case 'existing':
        modal.innerHTML += `
          <h2>Sign in</h2>
          <p>Choose your preferred authentication method:</p>
          <div class="btn-row">
            <button id="extension">Browser Extension</button>
            <button id="qr" class="secondary">QR Code</button>
          </div>
          <div class="btn-row">
            <button id="bunker" class="secondary">Bunker URL</button>
            <button id="otp" class="secondary">OTP/DM</button>
          </div>
          <div class="btn-row">
            <button id="secure-key" class="secondary">Secure Key</button>
          </div>
        `;
        break;

      case 'extension':
        this.renderExtensionScreen(modal);
        break;

      case 'qr':
        this.renderQRScreen(modal);
        break;

      case 'bunker':
        this.renderBunkerScreen(modal);
        break;

      case 'otp':
        this.renderOTPScreen(modal);
        break;

      case 'otp-verify':
        this.renderOTPVerifyScreen(modal);
        break;

      case 'secure-key':
        this.renderSecureKeyScreen(modal);
        break;

      case 'generate-key':
        this.renderGenerateKeyScreen(modal);
        break;
    }

    // Show loading or error states
    if (this.isLoading) {
      modal.innerHTML += '<div style="text-align: center; margin: 16px 0;"><div class="loading"></div></div>';
    }
    if (this.errorMessage) {
      modal.innerHTML += `<div class="error">${this.errorMessage}</div>`;
    }
  }

  private renderExtensionScreen(modal: HTMLElement) {
    const extensions = this.extensionService.getExtensions();
    const current = this.extensionService.getCurrentExtension();

    modal.innerHTML += `
      <h2>Browser Extensions</h2>
      <p>Select a Nostr browser extension to use:</p>
    `;

    if (extensions.length === 0) {
      modal.innerHTML += `
        <p>No Nostr extensions detected. Please install one:</p>
        <ul>
          <li><a href="https://getalby.com" target="_blank">Alby</a></li>
          <li><a href="https://github.com/fiatjaf/nos2x" target="_blank">nos2x</a></li>
          <li><a href="https://github.com/supertestnet/horse" target="_blank">Horse</a></li>
        </ul>
        <div class="btn-row">
          <button id="refresh-extensions">Refresh</button>
        </div>
      `;
    } else {
      modal.innerHTML += '<div class="extension-list">';
      extensions.forEach((ext, index) => {
        const isSelected = current?.name === ext.name;
        modal.innerHTML += `
          <div class="extension-item ${isSelected ? 'selected' : ''}" data-index="${index}">
            <span>${ext.name}</span>
            <button class="small" data-action="select" data-index="${index}">
              ${isSelected ? 'Selected' : 'Select'}
            </button>
          </div>
        `;
      });
      modal.innerHTML += '</div>';
      
      if (current) {
        modal.innerHTML += `
          <div class="btn-row">
            <button id="connect-extension">Connect</button>
          </div>
        `;
      }
    }
  }

  private renderQRScreen(modal: HTMLElement) {
    modal.innerHTML += `
      <h2>QR Code Authentication</h2>
      <p>Scan this QR code with your Nostr mobile app:</p>
    `;

    if (!this.qrConnectionString) {
      // Generate QR code
      const appMetadata: AppMetadata = {
        name: 'Nostr Components',
        url: window.location.origin,
        description: 'Nostr Web Components'
      };
      
      const { connectionString, secret, pubkey } = ConnectionStringService.generateConnectionString(appMetadata);
      this.qrConnectionString = connectionString;
      this.qrSecret = secret;
      this.qrPubkey = pubkey;
    }

    modal.innerHTML += `
      <div class="qr-container">
        <canvas id="qr-canvas" class="qr-code"></canvas>
      </div>
      <p style="font-size: 0.8rem; word-break: break-all;">${this.qrConnectionString}</p>
      <div class="btn-row">
        <button id="regenerate-qr" class="secondary">Regenerate</button>
      </div>
    `;
  }

  private renderBunkerScreen(modal: HTMLElement) {
    modal.innerHTML += `
      <h2>Bunker URL (NIP-46)</h2>
      <p>Enter your bunker URL to connect:</p>
      <input type="text" id="bunker-url" placeholder="bunker://pubkey?relay=..." />
      <p style="font-size: 0.8rem;">Examples: nsec.app, Amber, or any NIP-46 compatible signer</p>
      <div class="btn-row">
        <button id="connect-bunker">Connect</button>
      </div>
    `;
  }

  private renderOTPScreen(modal: HTMLElement) {
    modal.innerHTML += `
      <h2>OTP Authentication</h2>
      <p>Enter your npub or username to receive a login code via DM:</p>
      <input type="text" id="otp-identifier" placeholder="npub... or username" />
      <p style="font-size: 0.8rem;">We'll send you a 6-digit code via Nostr DM</p>
      <div class="btn-row">
        <button id="send-otp">Send Code</button>
      </div>
    `;
  }

  private renderOTPVerifyScreen(modal: HTMLElement) {
    modal.innerHTML += `
      <h2>Enter Verification Code</h2>
      <p>Check your Nostr DMs for a 6-digit code:</p>
      <input type="text" id="otp-code" placeholder="123456" maxlength="6" />
      <div class="btn-row">
        <button id="verify-otp">Verify</button>
        <button id="resend-otp" class="secondary">Resend</button>
      </div>
    `;
  }

  private renderSecureKeyScreen(modal: HTMLElement) {
    const storedKeys = SecureStorage.getStoredKeys();
    const legacyKey = SecureStorage.getLegacyKey();

    modal.innerHTML += `
      <h2>Secure Key Storage</h2>
    `;

    if (legacyKey) {
      modal.innerHTML += `
        <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin: 12px 0;">
          <p><strong>Legacy key detected!</strong> Migrate to secure storage:</p>
          <input type="password" id="migrate-password" placeholder="Enter password for encryption" />
          <div class="btn-row">
            <button id="migrate-key">Migrate Key</button>
          </div>
        </div>
      `;
    }

    if (storedKeys.length > 0) {
      modal.innerHTML += `
        <h3>Stored Keys</h3>
        <div class="extension-list">
      `;
      storedKeys.forEach((key, index) => {
        modal.innerHTML += `
          <div class="extension-item" data-key-index="${index}">
            <span>${key.pubkey.substring(0, 16)}...</span>
            <button class="small" data-action="use-key" data-key-index="${index}">Use</button>
          </div>
        `;
      });
      modal.innerHTML += '</div>';
    }

    modal.innerHTML += `
      <h3>Add New Key</h3>
      <input type="text" id="new-nsec" placeholder="nsec..." />
      <input type="password" id="key-password" placeholder="Password for encryption" />
      <div class="btn-row">
        <button id="store-key">Store Securely</button>
      </div>
    `;
  }

  private renderGenerateKeyScreen(modal: HTMLElement) {
    modal.innerHTML += `
      <h2>Generate New Key</h2>
      <p>Create a new Nostr keypair and store it securely:</p>
      <input type="password" id="gen-password" placeholder="Password for encryption" />
      <input type="password" id="gen-password-confirm" placeholder="Confirm password" />
      <div class="btn-row">
        <button id="generate-new-key">Generate Key</button>
      </div>
    `;
  }

  private attachEventListeners(modal: HTMLElement) {
    const qs = (selector: string) => modal.querySelector(selector);
    
    // Welcome screen
    qs('#new')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('new');
    });
    qs('#existing')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('existing');
    });
    
    // New user screen
    qs('#generate-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('generate-key');
    });
    qs('#manual-setup')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const content = qs('#manual-content') as HTMLElement;
      if (content) {
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
      }
    });
    qs('#done')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('existing');
    });
    
    // Existing user screen
    qs('#extension')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('extension');
    });
    qs('#qr')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('qr');
    });
    qs('#bunker')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('bunker');
    });
    qs('#otp')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('otp');
    });
    qs('#secure-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setScreen('secure-key');
    });
    
    // Extension screen
    qs('#refresh-extensions')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.extensionService.refresh();
      this.render();
    });
    qs('#connect-extension')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleExtensionConnect();
    });
    
    // Extension selection
    modal.querySelectorAll('[data-action="select"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
        const extensions = this.extensionService.getExtensions();
        if (extensions[index]) {
          this.extensionService.setCurrentExtension(extensions[index]);
          this.render();
        }
      });
    });

    // QR screen
    qs('#regenerate-qr')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.qrConnectionString = '';
      this.render();
    });
    
    // Generate QR code if canvas exists
    const qrCanvas = qs('#qr-canvas') as HTMLCanvasElement;
    if (qrCanvas && this.qrConnectionString) {
      this.generateQRCodeForCanvas(qrCanvas, this.qrConnectionString);
    }

    // Bunker screen
    qs('#connect-bunker')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleBunkerConnect();
    });

    // OTP screen
    qs('#send-otp')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSendOTP();
    });
    qs('#verify-otp')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleVerifyOTP();
    });
    qs('#resend-otp')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSendOTP();
    });

    // Secure key screen
    qs('#migrate-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleMigrateKey();
    });
    qs('#store-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleStoreKey();
    });
    
    // Stored key selection
    modal.querySelectorAll('[data-action="use-key"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((e.target as HTMLElement).dataset.keyIndex || '0');
        this.handleUseStoredKey(index);
      });
    });

    // Generate key screen
    qs('#generate-new-key')?.addEventListener('click', () => this.handleGenerateNewKey());
  }

  // Authentication handlers
  private async handleExtensionConnect() {
    const current = this.extensionService.getCurrentExtension();
    if (!current) {
      this.showError('No extension selected');
      return;
    }

    this.showLoading();
    try {
      const pubkey = await current.extension.getPublicKey();
      console.log('Connected to extension:', current.name, 'pubkey:', pubkey);
      
      // Set up the signer for components to use
      this.setupSigner(current.extension, pubkey);
      this.handleSignInSuccess();
    } catch (error) {
      console.error('Extension connection failed:', error);
      this.showError('Failed to connect to extension. Please try again.');
    }
  }

  private async handleBunkerConnect() {
    const input = this.shadowRoot?.querySelector('#bunker-url') as HTMLInputElement;
    const bunkerUrl = input?.value.trim();
    
    if (!bunkerUrl) {
      this.showError('Please enter a bunker URL');
      return;
    }

    if (!ConnectionStringService.isValidBunkerUrl(bunkerUrl)) {
      this.showError('Invalid bunker URL format');
      return;
    }

    this.showLoading();
    try {
      const success = await this.nip46Service.connectToBunker(bunkerUrl);
      if (success) {
        const pubkey = await this.nip46Service.getPublicKey();
        console.log('Connected to bunker, pubkey:', pubkey);
        
        // Set up the signer for components to use
        this.setupBunkerSigner(this.nip46Service, pubkey);
        this.handleSignInSuccess();
      } else {
        this.showError('Failed to connect to bunker');
      }
    } catch (error) {
      console.error('Bunker connection failed:', error);
      this.showError('Failed to connect to bunker. Please check the URL and try again.');
    }
  }

  private async handleSendOTP() {
    const input = this.shadowRoot?.querySelector('#otp-identifier') as HTMLInputElement;
    const identifier = input?.value.trim();
    
    if (!identifier) {
      this.showError('Please enter your npub or username');
      return;
    }

    this.showLoading();
    try {
      const pubkey = await this.otpService.resolveToPubkey(identifier);
      if (!pubkey) {
        this.showError('Could not resolve identifier to pubkey');
        return;
      }

      this.otpSessionId = await this.otpService.sendOTP(pubkey);
      this.setScreen('otp-verify');
    } catch (error) {
      console.error('OTP send failed:', error);
      this.showError('Failed to send OTP. Please try again.');
    }
  }

  private async handleVerifyOTP() {
    const input = this.shadowRoot?.querySelector('#otp-code') as HTMLInputElement;
    const code = input?.value.trim();
    
    if (!code) {
      this.showError('Please enter the verification code');
      return;
    }

    this.showLoading();
    try {
      const result = await this.otpService.verifyOTP(this.otpSessionId, code);
      if (result.success && result.pubkey) {
        console.log('OTP verified, pubkey:', result.pubkey);
        
        // Set up the signer for components to use
        this.setupOTPSigner(this.otpService, result.pubkey);
        this.handleSignInSuccess();
      } else {
        this.showError('Invalid or expired code');
      }
    } catch (error) {
      console.error('OTP verification failed:', error);
      this.showError('Failed to verify code. Please try again.');
    }
  }

  private async handleMigrateKey() {
    const input = this.shadowRoot?.querySelector('#migrate-password') as HTMLInputElement;
    const password = input?.value.trim();
    
    if (!password) {
      this.showError('Please enter a password');
      return;
    }

    this.showLoading();
    try {
      const success = await SecureStorage.migrateLegacyKey(password);
      if (success) {
        this.render(); // Refresh to show migrated key
      } else {
        this.showError('Failed to migrate key');
      }
    } catch (error) {
      console.error('Key migration failed:', error);
      this.showError('Failed to migrate key. Please try again.');
    }
  }

  private async handleStoreKey() {
    const nsecInput = this.shadowRoot?.querySelector('#new-nsec') as HTMLInputElement;
    const passwordInput = this.shadowRoot?.querySelector('#key-password') as HTMLInputElement;
    
    const nsec = nsecInput?.value.trim();
    const password = passwordInput?.value.trim();
    
    if (!nsec || !password) {
      this.showError('Please enter both nsec and password');
      return;
    }

    if (!nsec.startsWith('nsec1')) {
      this.showError('Invalid nsec format');
      return;
    }

    this.showLoading();
    try {
      await SecureStorage.storeKey(nsec, password);
      this.render(); // Refresh to show stored key
    } catch (error) {
      console.error('Key storage failed:', error);
      this.showError('Failed to store key. Please try again.');
    }
  }

  private async handleUseStoredKey(index: number) {
    const storedKeys = SecureStorage.getStoredKeys();
    const key = storedKeys[index];
    
    if (!key) {
      this.showError('Key not found');
      return;
    }

    const password = prompt('Enter password to decrypt key:');
    if (!password) {
      return;
    }

    this.showLoading();
    try {
      const nsec = await SecureStorage.retrieveKey(key.pubkey, password);
      if (nsec) {
        SecureStorage.setCurrentKey(key.pubkey);
        console.log('Using stored key, pubkey:', key.pubkey);
        this.handleSignInSuccess();
      } else {
        this.showError('Invalid password');
      }
    } catch (error) {
      console.error('Key retrieval failed:', error);
      this.showError('Failed to decrypt key. Please check your password.');
    }
  }

  private async handleGenerateNewKey() {
    const passwordInput = this.shadowRoot?.querySelector('#gen-password') as HTMLInputElement;
    const confirmInput = this.shadowRoot?.querySelector('#gen-password-confirm') as HTMLInputElement;
    
    const password = passwordInput?.value.trim();
    const confirm = confirmInput?.value.trim();
    
    if (!password || !confirm) {
      this.showError('Please enter and confirm password');
      return;
    }

    if (password !== confirm) {
      this.showError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      this.showError('Password must be at least 8 characters');
      return;
    }

    this.showLoading();
    try {
      const { pubkey, nsec } = await SecureStorage.generateAndStoreKey(password);
      console.log('Generated new key, pubkey:', pubkey);
      
      // Show the generated key to user
      alert(`Key generated successfully!\n\nPublic key: ${pubkey}\nPrivate key: ${nsec}\n\nPlease save your private key securely!`);
      
      this.handleSignInSuccess();
    } catch (error) {
      console.error('Key generation failed:', error);
      this.showError('Failed to generate key. Please try again.');
    }
  }
}

customElements.define('nostr-onboarding-modal', NostrOnboardingModal);
