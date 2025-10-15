// SPDX-License-Identifier: MIT

import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { init as openZapModal } from './dialog';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { getZapButtonStyles, getHelpDialogStyles } from './style';
import { fetchTotalZapAmount } from './zap-utils';

/**
 * <nostr-zap>
 * Attributes:
 *   - npub | pubkey | nip05   (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - text            (optional) : custom text (default "Zap")
 *   - amount          (optional) : pre-defined zap amount in sats
 *   - default-amount  (optional) : default zap amount in sats (default 21)
 */
export default class NostrZap extends NostrUserComponent {
  protected zapStatus = this.channel('zap');
  protected amountStatus = this.channel('amount');
  
  private totalZapAmount: number | null = null;
  private cachedAmountDialog: any = null;

  constructor() {
    super();
    // Initialize amount status to loading so skeleton shows immediately
    this.amountStatus.set(NCStatus.Loading);
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'text',
      'amount',
      'default-amount'
    ];
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
    // TODO: To handle text, amount, and default-amount changes?
    this.render();
  }

  disconnectedCallback() {
    if (
      this.cachedAmountDialog &&
      typeof this.cachedAmountDialog.close === "function"
    ) {
      this.cachedAmountDialog.close();
    }
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onUserReady(_user: any, _profile: any) {
    this.render(); // Show button immediately when user is ready
    this.updateZapCount(); // Fetch zap count separately
  }

  /** Protected methods */
  protected validateInputs(): boolean {
    if (!super.validateInputs()) return false;

    const textAttr      = this.getAttribute("text");
    const amtAttr       = this.getAttribute("amount");
    const defaultAmtAttr= this.getAttribute("default-amount");
    const tagName       = this.tagName.toLowerCase();

    let errorMessage: string | null = null;

    if (textAttr && textAttr.length > 128) {
      errorMessage = "Max text length: 128 characters";
    } else if (amtAttr) {
      const num = Number(amtAttr);
      if (isNaN(num) || num <= 0) {
        errorMessage = "Invalid amount";
      } else if (num > 210000) {
        errorMessage = "Amount too high (max 210,000 sats)";
      }
    } else if (defaultAmtAttr) {
      const num = Number(defaultAmtAttr);
      if (isNaN(num) || num <= 0) {
        errorMessage = "Invalid default-amount";
      } else if (num > 210000) {
        errorMessage = "Default-amount too high (max 210,000 sats)";
      }
    }

    if (errorMessage) {
      this.zapStatus.set(NCStatus.Error, errorMessage);
      console.error(`Nostr-Components: ${tagName}: ${errorMessage}`);
      return false;
    }

    return true;
  }

  /** Private functions */
  private async handleZapClick() {
    if (this.userStatus.get() !== NCStatus.Ready) return;

    this.zapStatus.set(NCStatus.Loading);
    this.render();

    try {
      if (!this.user) {
        this.zapStatus.set(NCStatus.Error, "Could not resolve user to zap.");
        this.render();
        return;
      }

      const relays = this.getRelays().join(",");
      const npub = this.user.npub;

      this.cachedAmountDialog = await openZapModal({
        npub,
        relays,
        cachedAmountDialog: this.cachedAmountDialog,
        theme: this.theme === 'dark' ? 'dark' : 'light',
        fixedAmount: (() => {
          const amtAttr = this.getAttribute("amount");
          if (!amtAttr) return undefined;
          const num = Number(amtAttr);
          if (isNaN(num) || num <= 0 || num > 210000) {
            console.error("Nostr-Components: Zap button: Max zap amount: 210,000 sats");
            return undefined;
          }
          return num;
        })(),
        defaultAmount: (() => {
          const defAttr = this.getAttribute("default-amount");
          if (!defAttr) return 21;
          const num = Number(defAttr);
          if (isNaN(num) || num <= 0 || num > 210000) {
            console.error("Nostr-Components: Zap button: Max zap amount: 210,000 sats");
            return 21;
          }
          return num;
        })(),
        anon: false,
      });
      this.zapStatus.set(NCStatus.Ready);
    } catch (e: any) {
      this.zapStatus.set(NCStatus.Error, e?.message || "Unable to zap");
    } finally {
      this.render();
    }
  }

  private handleHelpClick() {
    // Hardcoded YouTube URL for zap tutorial
    const YOUTUBE_URL = "https://youtube.com/watch?v=zap-tutorial";
    
    // Inject help dialog styles
    this.injectHelpDialogStyles();
    
    // Create help dialog
    const dialog = document.createElement('dialog');
    dialog.className = 'nostr-zap-help-dialog';
    dialog.innerHTML = `
      <div class="help-dialog-content">
        <button class="close-btn">✕</button>
        <h2>What is a Zap? (Under construction)</h2>
        <div class="help-content">
          <p>A zap is a Lightning Network payment sent to a Nostr user.</p>
          <p>Zaps allow you to:</p>
          <ul>
            <li>Send micropayments instantly</li>
            <li>Support content creators</li>
            <li>Show appreciation for posts</li>
          </ul>
          <p>Learn more about zaps:</p>
          <a href="${YOUTUBE_URL}" target="_blank" class="youtube-link">
            Watch YouTube Tutorial
          </a>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.showModal();
    
    // Close dialog handlers
    const closeBtn = dialog.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => {
      dialog.close();
      document.body.removeChild(dialog);
    });
    
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
        document.body.removeChild(dialog);
      }
    });
  }

  private injectHelpDialogStyles() {
    // Check if styles are already injected
    if (document.querySelector('style[data-help-dialog-styles]')) return;
    
    const style = document.createElement('style');
    style.setAttribute('data-help-dialog-styles', 'true');
    style.textContent = getHelpDialogStyles();
    document.head.appendChild(style);
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-zap-button', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleZapClick();
    });

    this.delegateEvent('click', '.help-icon', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      this.handleHelpClick();
    });
  }

  private async updateZapCount() {
    if (!this.user) return;

    try {
      this.amountStatus.set(NCStatus.Loading);
      this.render();
      
      await this.ensureNostrConnected();
      const count = await fetchTotalZapAmount({ 
        pubkey: this.user.pubkey, 
        relays: this.getRelays() 
      });
      this.totalZapAmount = count;
      this.amountStatus.set(NCStatus.Ready);
    } catch (e) {
      console.error("Nostr-Components: Zap button: Failed to fetch zap count", e);
      this.totalZapAmount = null;
      this.amountStatus.set(NCStatus.Error);
    } finally {
      this.render();
    }
  }

  protected renderContent() {
    // Check user loading and amount loading separately
    const isUserLoading = this.userStatus.get() == NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const isAmountLoading = this.amountStatus.get() == NCStatus.Loading;
    const errorMessage = super.renderError(this.errorMessage);
    const buttonText = this.getAttribute('text') || 'Zap';

    const renderOptions: RenderZapButtonOptions = {
      isLoading: isUserLoading, // Button shows loading when user is loading
      isError: isError,
      isSuccess: false, // TODO: Add success state handling
      errorMessage: errorMessage,
      buttonText: buttonText,
      totalZapAmount: this.totalZapAmount,
      isAmountLoading: isAmountLoading, // Skeleton shows when amount is loading
    };

    this.shadowRoot!.innerHTML = `
      ${getZapButtonStyles()}
      ${renderZapButton(renderOptions)}
    `;
  }
}

customElements.define("nostr-zap", NostrZap);
