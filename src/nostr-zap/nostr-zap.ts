// SPDX-License-Identifier: MIT

import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { injectCSS as injectCSSIntoBody, init as openZapModal } from './dialog';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { getZapButtonStyles } from './style';
import { fetchTotalZapAmount } from './zap-utils';

/**
 * <nostr-zap>
 * Attributes:
 *   - npub | pubkey | nip05   (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - text            (optional) : custom text (default "Zap")
 *   - amount          (optional) : pre-defined zap amount in sats
 *   - default-amount  (optional) : default zap amount in sats (default 1000)
 *   - icon-width      (optional) : width of the zap icon (default 25)
 *   - icon-height     (optional) : height of the zap icon (default 25)
 */
export default class NostrZap extends NostrUserComponent {
  protected zapStatus = this.channel('zap');
  protected amountStatus = this.channel('amount');
  
  private totalZapAmount: number | null = null;
  private cachedAmountDialog: any = null;
  private static cssInjected = false;

  connectedCallback() {
    super.connectedCallback?.();
    if (!NostrZap.cssInjected) {
      injectCSSIntoBody();
      NostrZap.cssInjected = true;
    }
    this.attachDelegatedListeners();
    this.render();
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'text',
      'amount',
      'default-amount',
      'icon-width',
      'icon-height'
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
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
    this.updateZapCount();
    this.render();
  }

  /** Protected methods */
  protected validateInputs(): boolean {
    if (!super.validateInputs()) return false;

    const textAttr = this.getAttribute("text");
    const amtAttr = this.getAttribute("amount");
    const defaultAmtAttr = this.getAttribute("default-amount");
    const tagName = this.tagName.toLowerCase();

    if (textAttr && textAttr.length > 128) {
      this.zapStatus.set(NCStatus.Error, "Max text length: 128 characters");
      console.error(`Nostr-Components: ${tagName}: Max text length: 128 characters`);
      return false;
    }

    if (amtAttr) {
      const num = Number(amtAttr);
      if (isNaN(num) || num <= 0) {
        this.zapStatus.set(NCStatus.Error, "Invalid amount");
        console.error(`Nostr-Components: ${tagName}: Invalid amount`);
        return false;
      } else if (num > 210000) {
        this.zapStatus.set(NCStatus.Error, "Amount too high (max 210,000 sats)");
        console.error(`Nostr-Components: ${tagName}: Amount too high (max 210,000 sats)`);
        return false;
      }
    }

    if (defaultAmtAttr) {
      const num = Number(defaultAmtAttr);
      if (isNaN(num) || num <= 0) {
        this.zapStatus.set(NCStatus.Error, "Invalid default-amount");
        console.error(`Nostr-Components: ${tagName}: Invalid default-amount`);
        return false;
      } else if (num > 210000) {
        this.zapStatus.set(NCStatus.Error, "Default-amount too high (max 210,000 sats)");
        console.error(`Nostr-Components: ${tagName}: Default-amount too high (max 210,000 sats)`);
        return false;
      }
    }

    return true;
  }

  /** Private functions */
  private async handleZapClick() {
    if (this.computeOverall() !== NCStatus.Ready) return;

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
          if (!defAttr) return undefined;
          const num = Number(defAttr);
          if (isNaN(num) || num <= 0 || num > 210000) {
            console.error("Nostr-Components: Zap button: Max zap amount: 210,000 sats");
            return undefined;
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

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-zap-button', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleZapClick();
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
    const isLoading = this.computeOverall() == NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const isZapLoading = this.zapStatus.get() == NCStatus.Loading;
    const isAmountLoading = this.amountStatus.get() == NCStatus.Loading;
    const errorMessage = super.renderError(this.errorMessage);
    const buttonText = this.getAttribute('text') || 'Zap';
    const iconWidthAttr = this.getAttribute('icon-width');
    const iconHeightAttr = this.getAttribute('icon-height');

    const renderOptions: RenderZapButtonOptions = {
      isLoading: isLoading || isZapLoading,
      isError: isError,
      isSuccess: false, // TODO: Add success state handling
      errorMessage: errorMessage,
      buttonText: buttonText,
      iconWidth: iconWidthAttr ? Number(iconWidthAttr) : 25,
      iconHeight: iconHeightAttr ? Number(iconHeightAttr) : 25,
      totalZapAmount: this.totalZapAmount,
      isAmountLoading: isAmountLoading,
    };

    this.shadowRoot!.innerHTML = `
      ${getZapButtonStyles()}
      ${renderZapButton(renderOptions)}
    `;
  }
}

customElements.define("nostr-zap", NostrZap);
