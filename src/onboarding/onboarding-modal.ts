import { LitElement, html, css } from 'lit';

import { customElement, property, state } from 'lit/decorators.js';
import { onboardingService } from './onboarding-service';

type OnboardingView = 'welcome' | 'newUser' | 'existingUser';

@customElement('nostr-onboarding-modal')
export default class NostrOnboardingModal extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @state()
  private _view: OnboardingView = 'welcome';

  @state()
  private _bunkerUrl = '';

  @state()
  private _connected = false;

  @state()
  private _qrCodeDataUrl = '';

  @state()
  private _isLoading = false;

  @state()
  private _isConnectingBunker = false;

  @state()
  private _nostrConnectUri = '';

  private _currentSignerChangedHandler: ((e: Event) => void) | null = null;
  private _currentSignerCleanup: { off: () => void } | null = null;

  static styles = css`
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

  private _renderWelcome() {
    return html`
      <h2>Welcome to Nostr!</h2>
      <p>A decentralized, open, and censorship-resistant social network.</p>
      <div class="button-group">
        <button @click=${() => this._view = 'newUser'}>I'm new to Nostr</button>
        <button @click=${() => this._view = 'existingUser'}>I already have an account</button>
      </div>
    `;
  }

  private _renderNewUser() {
    return html`
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
        <button @click=${() => this._view = 'existingUser'}>I've set up my account and signer</button>
        <button @click=${() => this._view = 'welcome'}>Back</button>
      </div>
    `;
  }

  private _handleGenerateQrCode() {
    // Clear any existing QR code
    this._qrCodeDataUrl = '';
    this._isLoading = true;

    // Update the UI immediately
    this.requestUpdate();

    // Clean up any existing listeners first
    this._cleanupEventListeners();

    // Listen for global signer ready event to reflect connection success in UI
    const handleSignerChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { signerReady?: boolean };
      if (detail?.signerReady && this.isConnected) {
        this._connected = true;
        this._isLoading = false;
        this.requestUpdate();
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
          this._qrCodeDataUrl = data.qrCodeUrl;
          this._isLoading = false;
        }
        if (data.nostrConnectUri) {
          this._nostrConnectUri = data.nostrConnectUri;
        }
        if (data.connected) {
          this._connected = true;
          this._isLoading = false;
        }

        // Let Lit handle the update
        await this.requestUpdate();

        console.log('QR code generated:', this._qrCodeDataUrl ? 'Success' : 'Failed');
      } catch (error) {
        console.error('Error in authUrl handler:', error);
      }
    });

    // Note: cleanup will be handled by _cleanupEventListeners and disconnectedCallback
  }

  private async _handleConnect(connectionString: string) {
    if (!connectionString || !this.isConnected) return;

    try {
      this._isConnectingBunker = true;
      this.requestUpdate(); // Update UI to show loading state

      await onboardingService.connectWithBunker(connectionString, async () => {
        if (!this.isConnected) return;

        // Success callback
        this._connected = true;
        this._isConnectingBunker = false;
        this.requestUpdate();

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
        this._isConnectingBunker = false;
        this.requestUpdate();
      }
      // Error is already handled in the service with an alert
    }
  }



  private _renderExistingUser() {
    if (this._connected) {
      return html`
        <div class="success-message">
          <svg width="48" height="48" viewBox="0 0 24 24"><path fill="green" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>
          <h3>Successfully Connected!</h3>
        </div>
      `;
    }

    return html`
      <h2>Sign In</h2>
      <p>Connect your Nostr account using a secure signer.</p>
      <div>
        <label for="nsec-app-url">Username/Provider or bunker:// URL</label>
        <input 
          id="nsec-app-url" 
          type="text" 
          placeholder="user@provider.com or bunker://..."
          .value=${this._bunkerUrl}
          @input=${(e: Event) => this._bunkerUrl = (e.target as HTMLInputElement).value}
        >
        <button @click=${() => this._handleConnect(this._bunkerUrl)} ?disabled=${!this._bunkerUrl || this._isConnectingBunker}>
          ${this._isConnectingBunker ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      <hr style="margin: 1.5rem 0;">
      <div>
        <p>Or generate a Nostr connection QR code:</p>
        <button 
          @click=${this._handleGenerateQrCode} 
          ?disabled=${this._isLoading}
          class="generate-button"
        >
          ${this._isLoading && !this._qrCodeDataUrl ? 'Generating QR Code...' :
        this._qrCodeDataUrl ? 'Regenerate QR Code' : 'Generate QR Code'}
        </button>
        ${this._qrCodeDataUrl
        ? html`
              <div style="text-align: center; margin: 1.5rem 0;">
                <img 
                  src="${this._qrCodeDataUrl}" 
                  alt="Nostr Connect QR Code"
                  style="max-width: 100%; height: auto; border: 1px solid #eee; border-radius: 8px; padding: 8px; background: white; cursor: pointer;"
                  @click=${() => this._copyToClipboard(this._nostrConnectUri)}
                  title="Click to copy connection URL"
                >
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                  Scan this QR code with your Nostr signer app (e.g., nsec.app)<br>
                  <em>Click the QR code to copy the connection URL</em>
                </p>
                ${this._nostrConnectUri ? html`
                  <details style="margin-top: 1rem; text-align: left;">
                    <summary style="cursor: pointer; font-size: 0.8rem; color: #888;">Show connection URL</summary>
                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 0.7rem; word-break: break-all; max-height: 100px; overflow-y: auto;">
                      ${this._nostrConnectUri}
                    </div>
                    <button 
                      @click=${() => this._copyToClipboard(this._nostrConnectUri)}
                      style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;"
                    >
                      Copy URL
                    </button>
                  </details>
                ` : ''}
                ${this._isLoading ? html`
                  <div style="margin-top: 1rem; padding: 0.75rem; background: #f8f9fa; border-radius: 4px;">
                    <p style="margin: 0; color: #0c5460;">
                      ⏳ Waiting for approval from your signer app...
                    </p>
                  </div>
                ` : ''}
              </div>
            `
        : ''}
      </div>
      <div class="button-group">
        <button @click=${() => this._view = 'welcome'}>Back</button>
      </div>
    `;
  }

  private _renderContent() {
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

  render() {
    if (!this.open) {
      return html``;
    }

    return html`
      <div class="modal-backdrop" @click=${this._handleClose}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <button class="close-button" @click=${this._handleClose}>&times;</button>
          ${this._renderContent()}
        </div>
      </div>
    `;
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
    super.disconnectedCallback();
    // Clean up event listeners to prevent memory leaks
    this._cleanupEventListeners();
  }
}
