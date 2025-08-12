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
  private _connectionString = '';

  @state()
  private _bunkerUrl = '';

  @state()
  private _connected = false;

  @state()
  private _qrCodeDataUrl = '';

  @state()
  private _isLoading = false;

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
    this._isLoading = true;
    
    // Set button text to indicate QR code generation is in progress
    const button = this.renderRoot.querySelector('.generate-button');
    if (button) {
      button.textContent = 'Generating QR Code...';
    }

    const signer = onboardingService.connectWithQr(() => {
      // Success callback
      this._connected = true;
      this._isLoading = false;
      setTimeout(() => {
        this.open = false;
        this._resetState();
      }, 2000);
    });

    signer.on('authUrl', async (url: string) => {
      console.log('authUrl event received in modal:', url);
      this._connectionString = url;
      this._qrCodeDataUrl = await onboardingService.generateQrCode(url);
      this._isLoading = false; // Stop loading once we have the QR code
      
      // Force UI update
      this.requestUpdate();
      
      // Debug output to verify QR code data
      console.log('QR code generated:', this._qrCodeDataUrl ? 'Success' : 'Failed');
      console.log('Connection string:', this._connectionString);
    });
  }

  private async _handleConnect(connectionString: string) {
    if (!connectionString) return;
    try {
      this._isLoading = true;
      await onboardingService.connectWithBunker(connectionString, () => {
        // Success callback
        this._connected = true;
        setTimeout(() => {
          this.open = false;
          this._resetState();
        }, 2000);
        this._isLoading = false;
      });
    } catch (error) {
      // Error is already handled in the service with an alert
      this._isLoading = false;
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
        <button @click=${() => this._handleConnect(this._bunkerUrl)} ?disabled=${!this._bunkerUrl}>Connect</button>
      </div>
      <hr style="margin: 1.5rem 0;">
      <div>
        <p>Or connect with a mobile signer.</p>
        <button @click=${this._handleGenerateQrCode} ?disabled=${this._isLoading}>
          ${this._isLoading ? 'Generating...' : 'Generate QR Code'}
        </button>
        ${this._qrCodeDataUrl
          ? html`
              <div style="text-align: center; margin-top: 1rem;">
                <img src="${this._qrCodeDataUrl}" alt="Nostr Connect QR Code">
                <p style="font-size: 0.8rem; word-break: break-all;">${this._connectionString}</p>
                ${this._isLoading ? html`<p style="margin-top: 1rem;">Waiting for approval from your signer app...</p>` : ''}
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

  private _resetState() {
    this._view = 'welcome';
    this._isLoading = false;
    this._qrCodeDataUrl = '';
    this._connectionString = '';
    this._bunkerUrl = '';
    this._connected = false;
  }
}
