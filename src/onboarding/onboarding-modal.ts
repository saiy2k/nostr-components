import { onboardingService } from './onboarding-service';

type OnboardingView = 'welcome' | 'newUser' | 'existingUser';

export default class NostrOnboardingModal extends HTMLElement {
  private _open = false;
  private _view: OnboardingView = 'welcome';
  private _bunkerUrl = '';
  private _connected = false;
  private _qrCodeDataUrl = '';
  private _isLoading = false;
  private _isConnectingBunker = false;
  private _nostrConnectUri = '';

  private _currentSignerChangedHandler: ((e: Event) => void) | null = null;
  private _currentSignerCleanup: { off: () => void } | null = null;

  private _shadow: ShadowRoot;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._render();
  }

  // Getters and setters for properties
  get open(): boolean {
    return this._open;
  }

  set open(value: boolean) {
    this._open = value;
    this._render();
  }

  get view(): OnboardingView {
    return this._view;
  }

  set view(value: OnboardingView) {
    this._view = value;
    this._render();
  }

  get bunkerUrl(): string {
    return this._bunkerUrl;
  }

  set bunkerUrl(value: string) {
    this._bunkerUrl = value;

    // Update only the specific DOM element instead of re-rendering
    if (this._shadow && this._view === 'existingUser') {
      const bunkerUrlInput = this._shadow.getElementById('nsec-app-url') as HTMLInputElement;
      if (bunkerUrlInput) {
        bunkerUrlInput.value = this._bunkerUrl;
      }

      // Also update connect button state
      const connectBtn = this._shadow.getElementById('connect-btn') as HTMLButtonElement;
      if (connectBtn) {
        connectBtn.disabled = !this._bunkerUrl || this._isConnectingBunker;
      }
    } else if (!this._shadow) {
      // Fall back to _render() when component is not yet initialized
      this._render();
    }
  }

  get connected(): boolean {
    return this._connected;
  }

  set connected(value: boolean) {
    this._connected = value;
    this._render();
  }

  get qrCodeDataUrl(): string {
    return this._qrCodeDataUrl;
  }

  set qrCodeDataUrl(value: string) {
    this._qrCodeDataUrl = value;
    this._render();
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  set isLoading(value: boolean) {
    this._isLoading = value;
    this._render();
  }

  get isConnectingBunker(): boolean {
    return this._isConnectingBunker;
  }

  set isConnectingBunker(value: boolean) {
    this._isConnectingBunker = value;
    this._render();
  }

  get nostrConnectUri(): string {
    return this._nostrConnectUri;
  }

  set nostrConnectUri(value: string) {
    this._nostrConnectUri = value;
    this._render();
  }

  private _getStyles(): string {
    return `
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .modal-content {
        background-color: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        position: relative;
      }
      
      .close-button {
          position: absolute;
          top: 10px;
          right: 10px;
          border: none;
          background: transparent;
          font-size: 1.5rem;
          cursor: pointer;
      }

      h2 {
          margin-top: 0;
      }

      .button-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1.5rem;
      }

      button {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: 1px solid #ccc;
          background-color: #f0f0f0;
          cursor: pointer;
          font-size: 1rem;
      }

      button:hover {
          background-color: #e0e0e0;
      }
      
      input {
          width: 100%;
          padding: 0.5rem;
          margin-top: 0.5rem;
          margin-bottom: 1rem;
          box-sizing: border-box;
      }

      a {
          color: #007bff;
          text-decoration: none;
      }

      a:hover {
          text-decoration: underline;
      }

      ol {
          padding-left: 1.5rem;
      }

      li {
          margin-bottom: 1rem;
      }

      .success-message {
        text-align: center;
        margin-top: 2rem;
      }

      .success-message svg {
        margin-bottom: 1rem;
      }
    `;
  }

  private _renderWelcome(): string {
    return `
      <h2>Welcome to Nostr!</h2>
      <p>A decentralized, open, and censorship-resistant social network.</p>
      <div class="button-group">
        <button id="new-user-btn">I'm new to Nostr</button>
        <button id="existing-user-btn">I already have an account</button>
      </div>
    `;
  }

  private _renderNewUser(): string {
    return `
      <h2>New to Nostr?</h2>
      <p>Here's a quick guide to get you started:</p>
      <ol>
        <li>
            <strong>What is Nostr?</strong> 
            Nostr is a simple, open protocol that enables a global, decentralized, and censorship-resistant social network. 
            <a href="https://www.youtube.com/watch?v=3_3t_G2_5G4" target="_blank" rel="noopener noreferrer">Watch a 1-min video</a>.
        </li>
        <li>
            <strong>Create a Profile:</strong> 
            Visit <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">nstart.me</a> to create your Nostr identity. 
            Make sure to save your private key (nsec) somewhere safe!
        </li>
        <li>
            <strong>Set up a Signer:</strong> 
            Instead of pasting your private key into websites, use a secure signer app. We recommend 
            <a href="https://nsec.app/" target="_blank" rel="noopener noreferrer">nsec.app</a>. It keeps your keys safe and lets you approve actions from a secure environment.
        </li>
      </ol>
      <div class="button-group">
        <button id="setup-complete-btn">I've set up my account and signer</button>
        <button id="back-to-welcome-btn">Back</button>
      </div>
    `;
  }

  private _handleGenerateQrCode() {
    // Clear any existing QR code
    this.qrCodeDataUrl = '';
    this.isLoading = true;

    // Clean up any existing listeners first
    this._cleanupEventListeners();

    // Listen for global signer ready event to reflect connection success in UI
    const handleSignerChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { signerReady?: boolean };
      if (detail?.signerReady && this.isConnected) {
        this.connected = true;
        this.isLoading = false;
        setTimeout(() => {
          if (this.isConnected) {
            this.open = false;
            this._resetState();
          }
        }, 1500);
      }
    };

    this._currentSignerChangedHandler = handleSignerChanged;
    window.addEventListener('nostr-signer-changed', handleSignerChanged);

    const signer = onboardingService.connectWithQr();

    // Store the cleanup function
    this._currentSignerCleanup = signer.on('authUrl', async (data: { qrCodeUrl?: string; connected?: boolean; nostrConnectUri?: string }) => {
      try {
        console.log('authUrl event received in modal:', data);

        // Check if component is still connected to the DOM
        if (!this.isConnected) {
          console.log('Component no longer connected, skipping UI update');
          return;
        }

        // Show QR if present; otherwise, if connected flag arrives, reflect success
        if (data.qrCodeUrl) {
          this.qrCodeDataUrl = data.qrCodeUrl;
          this.isLoading = false;
        }
        if (data.nostrConnectUri) {
          this.nostrConnectUri = data.nostrConnectUri;
        }
        if (data.connected) {
          this.connected = true;
          this.isLoading = false;
        }

        console.log('QR code generated:', this.qrCodeDataUrl ? 'Success' : 'Failed');
      } catch (error) {
        console.error('Error in authUrl handler:', error);
      }
    });

    // Note: cleanup will be handled by _cleanupEventListeners and disconnectedCallback
  }

  private async _handleConnect(connectionString: string) {
    if (!connectionString || !this.isConnected) return;

    try {
      this.isConnectingBunker = true;

      await onboardingService.connectWithBunker(connectionString, async () => {
        if (!this.isConnected) return;

        // Success callback
        this.connected = true;
        this.isConnectingBunker = false;

        // Close the modal after a short delay
        setTimeout(() => {
          if (this.isConnected) {
            this.open = false;
            this._resetState();
          }
        }, 2000);
      });
    } catch (error) {
      console.error('Connection error:', error);
      if (this.isConnected) {
        this.isConnectingBunker = false;
      }
      // Error is already handled in the service with an alert
    }
  }

  private _renderExistingUser(): string {
    if (this._connected) {
      return `
        <div class="success-message">
          <svg width="48" height="48" viewBox="0 0 24 24"><path fill="green" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>
          <h3>Successfully Connected!</h3>
        </div>
      `;
    }

    return `
      <h2>Sign In</h2>
      <p>Connect your Nostr account using a secure signer.</p>
      <div>
        <label for="nsec-app-url">Username/Provider or bunker:// URL</label>
        <input 
          id="nsec-app-url" 
          type="text" 
          placeholder="user@provider.com or bunker://..."
        >
        <button id="connect-btn">
          Connect
        </button>
      </div>
      <hr style="margin: 1.5rem 0;">
      <div>
        <p>Or generate a Nostr connection QR code:</p>
        <button 
          id="generate-qr-btn"
          class="generate-button"
        >
          Generate QR Code
        </button>
        <div id="qr-code-container" style="display: none; text-align: center; margin: 1.5rem 0;">
          <img 
            id="qr-code-image"
            alt="Nostr Connect QR Code"
            style="max-width: 100%; height: auto; border: 1px solid #eee; border-radius: 8px; padding: 8px; background: white; cursor: pointer;"
            title="Click to copy connection URL"
          >
          <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
            Scan this QR code with your Nostr signer app (e.g., nsec.app)<br>
            <em>Click the QR code to copy the connection URL</em>
          </p>
          <details id="connection-url-details" style="margin-top: 1rem; text-align: left; display: none;">
            <summary style="cursor: pointer; font-size: 0.8rem; color: #888;">Show connection URL</summary>
            <div id="connection-url-text" style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 0.7rem; word-break: break-all; max-height: 100px; overflow-y: auto;">
            </div>
            <button 
              id="copy-url-btn"
              style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;"
            >
              Copy URL
            </button>
          </details>
          <div id="loading-message" style="margin-top: 1rem; padding: 0.75rem; background: #f8f9fa; border-radius: 4px; display: none;">
            <p style="margin: 0; color: #0c5460;">
              ⏳ Waiting for approval from your signer app...
            </p>
          </div>
        </div>
      </div>
      <div class="button-group">
        <button id="back-to-welcome-btn">Back</button>
      </div>
    `;
  }

  private _updateExistingUserElements(): void {
    if (this._view !== 'existingUser' || this._connected) {
      return;
    }

    // Update bunker URL input
    const bunkerUrlInput = this._shadow.getElementById('nsec-app-url') as HTMLInputElement;
    if (bunkerUrlInput) {
      bunkerUrlInput.value = this._bunkerUrl;
    }

    // Update connect button
    const connectBtn = this._shadow.getElementById('connect-btn') as HTMLButtonElement;
    if (connectBtn) {
      connectBtn.disabled = !this._bunkerUrl || this._isConnectingBunker;
      connectBtn.textContent = this._isConnectingBunker ? 'Connecting...' : 'Connect';
    }

    // Update generate QR button
    const generateQrBtn = this._shadow.getElementById('generate-qr-btn') as HTMLButtonElement;
    if (generateQrBtn) {
      generateQrBtn.disabled = this._isLoading;
      if (this._isLoading && !this._qrCodeDataUrl) {
        generateQrBtn.textContent = 'Generating QR Code...';
      } else if (this._qrCodeDataUrl) {
        generateQrBtn.textContent = 'Regenerate QR Code';
      } else {
        generateQrBtn.textContent = 'Generate QR Code';
      }
    }

    // Update QR code container
    const qrCodeContainer = this._shadow.getElementById('qr-code-container') as HTMLElement;
    if (qrCodeContainer) {
      qrCodeContainer.style.display = this._qrCodeDataUrl ? 'block' : 'none';
    }

    // Update QR code image
    const qrCodeImage = this._shadow.getElementById('qr-code-image') as HTMLImageElement;
    if (qrCodeImage && this._qrCodeDataUrl) {
      qrCodeImage.src = this._qrCodeDataUrl;
    }

    // Update connection URL details
    const connectionUrlDetails = this._shadow.getElementById('connection-url-details') as HTMLElement;
    if (connectionUrlDetails) {
      connectionUrlDetails.style.display = this._nostrConnectUri ? 'block' : 'none';
    }

    // Update connection URL text
    const connectionUrlText = this._shadow.getElementById('connection-url-text') as HTMLElement;
    if (connectionUrlText && this._nostrConnectUri) {
      connectionUrlText.textContent = this._nostrConnectUri;
    }

    // Update loading message
    const loadingMessage = this._shadow.getElementById('loading-message') as HTMLElement;
    if (loadingMessage) {
      // Show message when QR is rendered but not yet connected
      const showWaiting = this._qrCodeDataUrl && !this._connected;
      loadingMessage.style.display = showWaiting ? 'block' : 'none';
    }
  }

  private _renderContent(): string {
    switch (this._view) {
      case 'newUser':
        return this._renderNewUser();
      case 'existingUser':
        return this._renderExistingUser();
      case 'welcome':
      default:
        return this._renderWelcome();
    }
  }

  private _render(): void {
    if (!this._open) {
      this._shadow.innerHTML = '';
      return;
    }

    this._shadow.innerHTML = `
      <style>${this._getStyles()}</style>
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-content" id="modal-content">
          <button class="close-button" id="close-btn">&times;</button>
          ${this._renderContent()}
        </div>
      </div>
    `;

    this._attachEventListeners();
    this._updateExistingUserElements();
  }

  private _attachEventListeners(): void {
    // Close button
    const closeBtn = this._shadow.getElementById('close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._handleClose());
    }

    // Backdrop click
    const backdrop = this._shadow.getElementById('modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this._handleClose();
        }
      });
    }

    // Welcome view buttons
    const newUserBtn = this._shadow.getElementById('new-user-btn');
    if (newUserBtn) {
      newUserBtn.addEventListener('click', () => {
        this.view = 'newUser';
      });
    }

    const existingUserBtn = this._shadow.getElementById('existing-user-btn');
    if (existingUserBtn) {
      existingUserBtn.addEventListener('click', () => {
        this.view = 'existingUser';
      });
    }

    // New user view buttons
    const setupCompleteBtn = this._shadow.getElementById('setup-complete-btn');
    if (setupCompleteBtn) {
      setupCompleteBtn.addEventListener('click', () => {
        this.view = 'existingUser';
      });
    }

    // Back buttons
    const backBtns = this._shadow.querySelectorAll('#back-to-welcome-btn');
    backBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.view = 'welcome';
      });
    });

    // Existing user view buttons
    const connectBtn = this._shadow.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const input = this._shadow.getElementById('nsec-app-url') as HTMLInputElement;
        if (input) {
          this._handleConnect(input.value);
        }
      });
    }

    const generateQrBtn = this._shadow.getElementById('generate-qr-btn');
    if (generateQrBtn) {
      generateQrBtn.addEventListener('click', () => {
        this._handleGenerateQrCode();
      });
    }

    const copyUrlBtn = this._shadow.getElementById('copy-url-btn');
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        this._copyToClipboard(this._nostrConnectUri);
      });
    }

    // QR code image click
    const qrImage = this._shadow.querySelector('img[alt="Nostr Connect QR Code"]');
    if (qrImage) {
      qrImage.addEventListener('click', () => {
        this._copyToClipboard(this._nostrConnectUri);
      });
    }

    // Input field
    const input = this._shadow.getElementById('nsec-app-url') as HTMLInputElement;
    if (input) {
      input.addEventListener('input', (e) => {
        this.bunkerUrl = (e.target as HTMLInputElement).value;
      });
    }
  }

  private _handleClose() {
    this.open = false;
    this._resetState();
  }

  private _cleanupEventListeners() {
    if (this._currentSignerChangedHandler) {
      window.removeEventListener('nostr-signer-changed', this._currentSignerChangedHandler);
      this._currentSignerChangedHandler = null;
    }

    if (this._currentSignerCleanup && typeof this._currentSignerCleanup.off === 'function') {
      this._currentSignerCleanup.off();
      this._currentSignerCleanup = null;
    }
  }

  private async _copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  private _resetState() {
    this._view = 'welcome';
    this._isLoading = false;
    this._isConnectingBunker = false;
    this._qrCodeDataUrl = '';
    this._nostrConnectUri = '';
    this._bunkerUrl = '';
    this._connected = false;
    this._cleanupEventListeners();
  }

  disconnectedCallback() {
    // Clean up event listeners to prevent memory leaks
    this._cleanupEventListeners();
  }
}

if (!customElements.get('nostr-onboarding-modal')) {
  customElements.define('nostr-onboarding-modal', NostrOnboardingModal);
}
