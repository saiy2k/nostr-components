import { Theme } from '../common/types';

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
    max-width: 420px;
    background: var(--nc-bg, #fff);
    color: var(--nc-fg, #000);
    border-radius: 12px;
    padding: 24px 20px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    font-family: system-ui, Arial, sans-serif;
  }
  h2 { margin-top: 0; font-size: 1.25rem; }
  p { font-size: .9rem; line-height: 1.4; }
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
  }
  button.secondary { background: #e5e5e5; color: #000; }
  input[type="text"] {
    padding: 8px 10px;
    width: 100%;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-top: 8px;
  }
  label { font-size: .8rem; display:flex; align-items:center; gap:6px; }
  .close {
    position:absolute;
    top:8px;
    right:12px;
    font-size:1.2rem;
    cursor:pointer;
  }
`;

type Screen = 'welcome' | 'new' | 'existing' | 'signin';

export default class NostrOnboardingModal extends HTMLElement {
  private screen: Screen = 'welcome';
  private theme: Theme = 'light';
  private pendingAction: string = '';
  private retryCallback?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  public setPendingAction(desc: string, retry?: () => void) {
    this.pendingAction = desc;
    this.retryCallback = retry;
    this.screen = 'welcome';
    this.render();
  }

  private setScreen(s: Screen) {
    this.screen = s;
    this.render();
  }

  private close() {
    this.remove();
    // when closed, attempt the retry again (user might have installed ext)
    if (this.retryCallback) {
      setTimeout(() => this.retryCallback?.(), 300);
    }
  }

  private handleSignInSuccess() {
    // naïve check – real apps should verify signer presence
    this.close();
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
      if (e.target === overlay) this.close();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.className = 'close';
    closeBtn.addEventListener('click', () => this.close());
    modal.appendChild(closeBtn);

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
          <p>Nostr is an open protocol for decentralised social apps.</p>
          <p>1. Create your profile at <a href="https://nstart.me" target="_blank">nstart.me</a><br>
            2. Copy your <b>nsec</b> (private key)<br>
            3. Install a signer extension/app at <a href="https://nsec.app" target="_blank">nsec.app</a></p>
          <p><a href="https://youtu.be/8thRYn14nB0" target="_blank">Watch a 2-min intro video</a></p>
          <div class="btn-row">
            <button id="done">I am ready</button>
          </div>
        `;
        break;
      case 'existing':
        modal.innerHTML += `
          <h2>Sign in</h2>
          <p>Connect an existing signer.</p>
          <div class="btn-row">
            <button id="extension">Use browser extension</button>
            <button id="qr" class="secondary">Scan QR</button>
          </div>
          <p style="margin-top:12px; font-weight:600;">Or paste your nsec</p>
          <input type="text" placeholder="nsec..." id="nsecInput" />
          <label><input type="checkbox" id="danger"/> I like to live dangerously</label>
          <div class="btn-row"><button id="signin">Sign in</button></div>
        `;
        break;
    }

    overlay.appendChild(modal);
    root.appendChild(overlay);

    // wire buttons
    const qs = (sel: string) => modal.querySelector(sel) as HTMLElement | null;

    qs('#new')?.addEventListener('click', () => this.setScreen('new'));
    qs('#existing')?.addEventListener('click', () => this.setScreen('existing'));
    qs('#done')?.addEventListener('click', () => this.setScreen('existing'));

    qs('#extension')?.addEventListener('click', () => {
      // attempt reload to detect newly installed extension
      alert('Please install/enable your Nostr signer browser extension and click "Sign in" when ready.');
    });

    qs('#signin')?.addEventListener('click', () => {
      const danger = (qs('#danger') as HTMLInputElement)?.checked;
      if (!danger) {
        alert('Enable the checkbox to use raw nsec');
        return;
      }
      const nsec = (qs('#nsecInput') as HTMLInputElement)?.value.trim();
      if (!nsec) {
        alert('Enter your nsec');
        return;
      }
      try {
        localStorage.setItem('nostr_nsec', nsec); // naive storage; real apps should encrypt
        this.handleSignInSuccess();
      } catch (e) {
        console.error('Sign-in failed', e);
        alert('Failed to store key');
      }
    });

    qs('#qr')?.addEventListener('click', () => {
      alert('QR sign-in not implemented yet');
    });
  }
}

customElements.define('nostr-onboarding-modal', NostrOnboardingModal);
