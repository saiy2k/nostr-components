// SPDX-License-Identifier: MIT

import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { init as openZapModal } from './dialog-zap';
import { showHelpDialog } from './dialog-help';
import { openZappersDialog } from './dialog-zappers';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { getZapButtonStyles } from './style';
import { fetchTotalZapAmount, ZapDetails } from './zap-utils';
import type { DialogComponent } from '../base/dialog-component/dialog-component';

/**
 * <nostr-zap>
 * Attributes:
 *   - npub | pubkey | nip05   (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - text            (optional) : custom text (default "Zap")
 *   - amount          (optional) : pre-defined zap amount in sats
 *   - default-amount  (optional) : default zap amount in sats (default 21)
 *   - url             (optional) : URL to send zap to (enables URL-based zaps)
 */
export default class NostrZap extends NostrUserComponent {
  protected zapStatus     =   this.channel('zap');
  protected amountStatus  =   this.channel('amount');
  
  private totalZapAmount: number | null = null;
  private cachedZapDetails: ZapDetails[] = [];
  private cachedAmountDialog: DialogComponent | null = null;

  constructor() {
    super();
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
      'default-amount',
      'url'
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
    this.render();
    this.updateZapCount();
  }

  /** Protected methods */
  protected validateInputs(): boolean {
    if (!super.validateInputs()) return false;

    const textAttr      = this.getAttribute("text");
    const amtAttr       = this.getAttribute("amount");
    const defaultAmtAttr= this.getAttribute("default-amount");
    const urlAttr       = this.getAttribute("url");
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
    } else if (urlAttr) {
      try {
        new URL(urlAttr);
      } catch {
        errorMessage = "Invalid URL format";
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
        cachedDialogComponent: this.cachedAmountDialog,
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
        url: this.getAttribute("url") || undefined,
        anon: false,
      });
      this.zapStatus.set(NCStatus.Ready);
    } catch (e: any) {
      this.zapStatus.set(NCStatus.Error, e?.message || "Unable to zap");
    } finally {
      this.render();
    }
  }

  private async handleHelpClick() {
    try {
      await showHelpDialog();
    } catch (error) {
      console.error('Error showing help dialog:', error);
    }
  }

  private async handleZappersClick() {
    if (this.cachedZapDetails.length === 0) {
      return; // No zaps to show
    }

    try {
      await openZappersDialog({
        zapDetails: this.cachedZapDetails,
        theme: this.theme === 'dark' ? 'dark' : 'light',
      });
    } catch (error) {
      console.error("Nostr-Components: Zap button: Error opening zappers dialog", error);
    }
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

    this.delegateEvent('click', '.total-zap-amount', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleZappersClick();
    });
  }

  private async updateZapCount() {
    if (!this.user) return;

    try {
      this.amountStatus.set(NCStatus.Loading);
      this.render();
      
      await this.ensureNostrConnected();
      const result = await fetchTotalZapAmount({ 
        pubkey: this.user.pubkey, 
        relays: this.getRelays(),
        url: this.getAttribute("url") || undefined
      });
      this.totalZapAmount = result.totalAmount;
      this.cachedZapDetails = result.zapDetails;
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
    const isUserLoading = this.userStatus.get() == NCStatus.Loading;
    const isAmountLoading = this.amountStatus.get() == NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const errorMessage = this.errorMessage;
    const buttonText = this.getAttribute('text') || 'Zap';

    const renderOptions: RenderZapButtonOptions = {
      isLoading: isUserLoading,
      isAmountLoading: isAmountLoading,
      isError: isError,
      isSuccess: false, // TODO: Add success state handling
      errorMessage: errorMessage,
      buttonText: buttonText,
      totalZapAmount: this.totalZapAmount,
      hasZaps: this.cachedZapDetails.length > 0,
    };

    this.shadowRoot!.innerHTML = `
      ${getZapButtonStyles()}
      ${renderZapButton(renderOptions)}
    `;
  }
}

customElements.define("nostr-zap", NostrZap);
