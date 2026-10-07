// SPDX-License-Identifier: MIT

import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { init as openZapModal, type ZapPaidNotice } from './dialog-zap';
import { showHelpDialog } from './dialog-help';
import { openZappersDialog } from './dialog-zappers';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { getZapButtonStyles } from './style';
import { fetchTotalZapAmount, relaysForZapRequest, ZapDetails } from './zap-utils';
import {
  applyRelayZapResult,
  creditPaidZap,
  displayedZapDetails,
  displayedZapTotal,
  emptyZapDisplay,
  hasPendingZapCredit,
  resetZapDisplay,
  type ZapDisplayState,
} from './zap-display';
import { isValidUrl } from '../common/utils';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { ensureSignerForAction } from '../common/auth-onboarding';
import { getRelayTransport, hasInstalledRelayTransport } from '../common/relay-transport';
import { explicitRelays, relaysForComponent } from '../common/relay-routing';
import { setTrustedInnerHTML } from '../common/trusted-html';
import { getTrustedActionContext } from '../common/trusted-action-context';
import { isTrustedUserEvent } from '../common/trusted-user-activation';

/**
 * <nostr-zap-button>
 * Attributes:
 *   - npub | pubkey | nip05   (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - text            (optional) : custom text (default "Zap")
 *   - amount          (optional) : pre-defined zap amount in sats
 *   - default-amount  (optional) : default zap amount in sats (default 21)
 *   - url             (optional) : URL to send zap to (enables URL-based zaps)
 *   - compact         (optional) : icon-only action for host action bars
 * 
 *  TODO: Doesn't yet support dynamic updates of attributes.
 */
export default class NostrZap extends NostrUserComponent {
  protected zapActionStatus=   this.channel('zapAction');
  protected zapListStatus  =   this.channel('zapList');

  protected getRelays() {
    return relaysForComponent(this.getAttribute('relays'));
  }
  
  #totalZapAmount: number | null = null;
  #cachedZapDetails: ZapDetails[] = [];
  #zapDisplay: ZapDisplayState = emptyZapDisplay();
  #cachedAmountDialog: DialogComponent | null = null;
  #countedZapSubject: string | null = null;
  #zapActionNotice = '';
  #zapCountLoadSeq = 0;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this.zapListStatus.get() == NCStatus.Idle) {
      this.initChannelStatus('zapList', NCStatus.Loading, { reflectOverall: false });
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
      'url',
      'compact'
    ];
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
    if (
      name === 'npub' ||
      name === 'url' ||
      name === 'relays' ||
      name === 'amount' ||
      name === 'default-amount'
    ) {
      this.#closeCachedAmountDialog();
    }
    if (name === 'npub' || name === 'pubkey' || name === 'url') {
      this.#forgetZapCountUnlessSubject(this.#zapSubjectKey());
    }
    if (name === 'url' && this.user) {
      void this.updateZapCount();
    }
    this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this.#closeCachedAmountDialog();
  }

  #closeCachedAmountDialog() {
    this.#cachedAmountDialog?.close();
    this.#cachedAmountDialog = null;
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onUserReady(_user: any, _profile: any) {
    this.render();
    this.updateZapCount();
  }

  /** A host relay transport replaces only networking, not the component UI/signer. */
  protected async connectToNostr() {
    if (
      hasInstalledRelayTransport() &&
      !getTrustedActionContext(this)
    ) {
      throw new Error('Untrusted extension action');
    }
    if (!getRelayTransport()) {
      await super.connectToNostr();
      return;
    }

    this.conn.set(NCStatus.Ready);
    this.nostrReadyResolve?.();
    try {
      this.onNostrRelaysConnected();
    } catch (hookError) {
      console.error('Error in onNostrRelaysConnected hook:', hookError);
    }
  }

  /** Protected methods */
  protected validateInputs(): boolean {
    if (
      hasInstalledRelayTransport() &&
      !getTrustedActionContext(this)
    ) {
      this.zapActionStatus.set(NCStatus.Error, 'Untrusted extension action');
      this.zapListStatus.set(NCStatus.Error, 'Untrusted extension action');
      this.userStatus.set(NCStatus.Idle);
      return false;
    }

    if (!super.validateInputs()) {
      this.zapActionStatus.set(NCStatus.Idle);
      this.zapListStatus.set(NCStatus.Idle);
      return false;
    }

    const textAttr      = this.getAttribute("text");
    const amtAttr       = this.getAttribute("amount");
    const defaultAmtAttr= this.getAttribute("default-amount");
    const urlAttr       =
      getTrustedActionContext(this)?.url || this.getAttribute("url");
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
      if (!isValidUrl(urlAttr)) {
        errorMessage = "Invalid URL format";
      }
    }

    if (errorMessage) {
      this.zapActionStatus.set(NCStatus.Error, errorMessage);
      this.zapListStatus.set(NCStatus.Error, errorMessage);
      this.userStatus.set(NCStatus.Idle);
      console.error(`Nostr-Components: ${tagName}: ${errorMessage}`);
      return false;
    }

    return true;
  }

  /** Private functions */
  async #handleZapClick() {
    if (this.userStatus.get() !== NCStatus.Ready) return;
    if (this.zapActionStatus.get() === NCStatus.Loading) return;

    this.#zapActionNotice = '';
    this.zapActionStatus.set(NCStatus.Loading);
    this.render();

    try {
      const signerResult = await ensureSignerForAction({
        action: 'zap',
        theme: this.theme,
      });

      if (signerResult.status === 'dismissed') {
        this.zapActionStatus.set(NCStatus.Ready);
        this.render();
        return;
      }

      if (!signerResult.publicKey) {
        this.zapActionStatus.set(
          NCStatus.Error,
          signerResult.message || 'Connect a Nostr signer to send a zap.'
        );
        this.render();
        return;
      }

      const senderPubkey = signerResult.publicKey;

      const trustedContext = getTrustedActionContext(this);
      if (hasInstalledRelayTransport() && !trustedContext) {
        throw new Error('Untrusted extension action');
      }
      const npub =
        trustedContext?.recipientNpub ||
        this.user?.npub ||
        this.getAttribute('npub');
      if (!npub) {
        this.zapActionStatus.set(NCStatus.Error, "Could not resolve user to zap.");
        this.render();
        return;
      }

      const relays = (await relaysForZapRequest({
        actionId: trustedContext?.actionId,
        pubkey: this.user?.pubkey,
        attributeRelays: explicitRelays(this.getAttribute('relays')),
        transportRelays: this.getRelays(),
      })).join(',');

      this.#cachedAmountDialog = await openZapModal({
        actionId: trustedContext?.actionId,
        npub,
        relays,
        cachedDialogComponent: this.#cachedAmountDialog,
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
        url: trustedContext?.url || this.getAttribute("url") || undefined,
        anon: false,
        onZapPaid: (payment) => {
          this.#recordPaidZap(payment, payment.anonymous ? null : senderPubkey);
        },
      });
      this.zapActionStatus.set(NCStatus.Ready);
    } catch (e: any) {
      console.error('Nostr-Components: Zap button: Unable to zap', e);
      this.#zapActionNotice = e?.message || 'Unable to zap';
      this.zapActionStatus.set(NCStatus.Ready);
    } finally {
      this.render();
    }
  }

  async #handleHelpClick() {
    try {
      await showHelpDialog(this.theme === 'dark' ? 'dark' : 'light');
    } catch (error) {
      console.error('Error showing help dialog:', error);
    }
  }

  async #handleZappersClick() {
    if (this.#cachedZapDetails.length === 0) {
      return; // No zaps to show
    }

    try {
      const transport = getRelayTransport();
      const actionId = getTrustedActionContext(this)?.actionId;
      const zapDetails = actionId && transport?.listZaps
        ? await transport.listZaps(actionId)
        : this.#cachedZapDetails;
      await openZappersDialog({
        zapDetails,
        theme: this.theme === 'dark' ? 'dark' : 'light',
        relays: this.getRelays(),
        actionId,
      });
    } catch (error) {
      console.error("Nostr-Components: Zap button: Error opening zappers dialog", error);
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-zap-button', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleZapClick();
    });

    this.delegateEvent('click', '.help-icon', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleHelpClick();
    });

    this.delegateEvent('click', '.total-zap-amount', (e) => {
      if (!isTrustedUserEvent(e)) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.#handleZappersClick();
    });

    this.delegateEvent('keydown', '.total-zap-amount.clickable', (e: KeyboardEvent) => {
      if (!isTrustedUserEvent(e)) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      void this.#handleZappersClick();
    });
  }

  #zapSubjectKey(): string {
    const trustedContext = getTrustedActionContext(this);
    const recipient =
      trustedContext?.recipientNpub ||
      this.user?.pubkey ||
      this.getAttribute('npub') ||
      this.getAttribute('pubkey') ||
      '';
    const url = trustedContext?.url || this.getAttribute('url') || '';
    return `${recipient}\n${url}`;
  }

  #forgetZapCountUnlessSubject(subjectKey: string) {
    if (this.#countedZapSubject === subjectKey) return;
    this.#applyZapDisplay(resetZapDisplay());
    this.#countedZapSubject = null;
  }

  #applyZapDisplay(next: ZapDisplayState) {
    this.#zapDisplay = next;
    this.#totalZapAmount = displayedZapTotal(next);
    this.#cachedZapDetails = displayedZapDetails(next);
  }

  #recordPaidZap(payment: ZapPaidNotice, authorPubkey: string | null) {
    const subjectKey = this.#zapSubjectKey();
    this.#forgetZapCountUnlessSubject(subjectKey);
    this.#applyZapDisplay(creditPaidZap(this.#zapDisplay, {
      invoice: payment.invoice,
      amountSats: payment.amountSats,
      comment: payment.comment,
      authorPubkey,
      paidAt: new Date(),
    }));
    this.#countedZapSubject = subjectKey;
    this.zapListStatus.set(NCStatus.Ready);
    this.render();
    void this.updateZapCount({ preserveVisibleTotal: true });
  }

  private async updateZapCount(options?: { preserveVisibleTotal?: boolean }) {
    if (!this.user) return;
    const subjectKey = this.#zapSubjectKey();
    this.#forgetZapCountUnlessSubject(subjectKey);
    const seq = ++this.#zapCountLoadSeq;
    const trustedContext = getTrustedActionContext(this);
    const preserveVisibleTotal =
      options?.preserveVisibleTotal === true &&
      displayedZapTotal(this.#zapDisplay) !== null;

    try {
      if (!preserveVisibleTotal) {
        this.zapListStatus.set(NCStatus.Loading);
        this.render();
      }
      
      await this.ensureNostrConnected();
      if (seq !== this.#zapCountLoadSeq) return;

      const result = await fetchTotalZapAmount({ 
        pubkey: this.user.pubkey, 
        relays: this.getRelays(),
        url: trustedContext?.url || this.getAttribute("url") || undefined,
        actionId: trustedContext?.actionId,
      });
      if (seq !== this.#zapCountLoadSeq) return;

      this.#applyZapDisplay(applyRelayZapResult(this.#zapDisplay, result));
      this.#countedZapSubject = subjectKey;
      this.zapListStatus.set(NCStatus.Ready);
    } catch (e) {
      if (seq !== this.#zapCountLoadSeq) return;
      console.error("Nostr-Components: Zap button: Failed to fetch zap count", e);
      const keepCreditedTotal = hasPendingZapCredit(this.#zapDisplay);
      const countedThisSubject = this.#countedZapSubject === subjectKey;
      if (countedThisSubject || keepCreditedTotal) {
        this.zapListStatus.set(NCStatus.Ready);
      } else {
        this.#applyZapDisplay(resetZapDisplay());
        this.#countedZapSubject = null;
        this.zapListStatus.set(NCStatus.Error, 'Failed to load zap total');
      }
    } finally {
      if (seq === this.#zapCountLoadSeq) {
        this.render();
      }
    }
  }

  protected renderContent() {
    const isUserLoading = this.userStatus.get() == NCStatus.Loading;
    const isActionLoading = this.zapActionStatus.get() == NCStatus.Loading;
    const isAmountLoading = this.zapListStatus.get() == NCStatus.Loading;
    const zapCountFailed =
      this.zapListStatus.get() === NCStatus.Error &&
      this.userStatus.get() !== NCStatus.Error &&
      this.conn.get() !== NCStatus.Error &&
      this.zapActionStatus.get() !== NCStatus.Error;
    const isError = this.computeOverall() === NCStatus.Error && !zapCountFailed;
    const errorMessage = this.errorMessage;
    const buttonText = this.getAttribute('text') || 'Zap';

    const renderOptions: RenderZapButtonOptions = {
      isLoading: isUserLoading || isActionLoading,
      isAmountLoading: isAmountLoading,
      isError: isError,
      isSuccess: false, // TODO: Add success state handling
      errorMessage: errorMessage,
      buttonText: buttonText,
      actionNotice: zapCountFailed
        ? (this.errorMessage || 'Failed to load zap total')
        : this.#zapActionNotice,
      totalZapAmount: zapCountFailed ? null : this.#totalZapAmount,
      hasZaps: !zapCountFailed && this.#cachedZapDetails.length > 0,
      compact: this.hasAttribute('compact'),
    };

    setTrustedInnerHTML(this.shadowRoot!, `
      ${getZapButtonStyles()}
      ${renderZapButton(renderOptions)}
    `);
  }
}

if (!customElements.get('nostr-zap-button')) {
  customElements.define('nostr-zap-button', NostrZap);
}
