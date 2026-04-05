// SPDX-License-Identifier: MIT

import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import { hexToNpub } from '../common/utils';
import { ensureInitialized } from '../common/nostr-login-service';
import { init as openZapModal } from '../nostr-zap-button/dialog-zap';
import { openZappersDialog } from '../nostr-zap-button/dialog-zappers';
import type { ZapDetails } from '../nostr-zap-button/zap-utils';
import {
  fetchFundraiserProgress,
  mergeRelayLists,
  parseFundraiserEvent,
  ParsedFundraiserEvent,
} from './fundraiser-utils';
import { renderFundraiser, RenderFundraiserOptions } from './render';
import { getFundraiserStyles } from './style';

export default class NostrFundraiser extends NostrEventComponent {
  protected parsedFundraiser: ParsedFundraiserEvent | null = null;

  private totalRaised = 0;
  private donorCount = 0;
  private percentRaised = 0;
  private remainingAmount = 0;
  private isClosed = false;
  private cachedZapDetails: ZapDetails[] = [];
  private cachedAmountDialog: DialogComponent | null = null;

  private isDonationsLoading = false;
  private donationErrorMessage = '';
  private isZapLoading = false;
  private zapErrorMessage = '';

  private progressLoadSeq = 0;

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'text',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    if (this.cachedAmountDialog && typeof this.cachedAmountDialog.close === 'function') {
      this.cachedAmountDialog.close();
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);

    if (name === 'hex' || name === 'noteid' || name === 'eventid') {
      this.resetFundraiserState();
      this.render();
      return;
    }

    if (name === 'text') {
      this.render();
    }
  }

  protected validateInputs(): boolean {
    if (!super.validateInputs()) {
      return false;
    }

    const textAttr = this.getAttribute('text');
    if (textAttr && textAttr.length > 48) {
      const errorMessage = 'Max text length: 48 characters';
      this.eventStatus.set(NCStatus.Error, errorMessage);
      this.authorStatus.set(NCStatus.Error, errorMessage);
      console.error(`Nostr-Components: ${this.tagName.toLowerCase()}: ${errorMessage}`);
      this.errorMessage = errorMessage;
      return false;
    }

    return true;
  }

  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onNostrRelaysConnected() {
    if (this.event && this.parsedFundraiser) {
      void this.updateFundraiserProgress();
    }
    this.render();
  }

  protected onEventReady(event: NDKEvent) {
    try {
      this.parsedFundraiser = parseFundraiserEvent(event);
      this.isClosed = !!this.parsedFundraiser.closedAt &&
        this.parsedFundraiser.closedAt <= Math.floor(Date.now() / 1000);
      void this.updateFundraiserProgress();
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to parse fundraiser event';
      console.error('[NostrFundraiser] ' + errorMessage, error);
      this.eventStatus.set(NCStatus.Error, errorMessage);
    } finally {
      this.render();
    }
  }

  private getFundraiserRelays(): string[] {
    return mergeRelayLists(this.getRelays(), this.parsedFundraiser?.relays);
  }

  private async updateFundraiserProgress(): Promise<void> {
    if (!this.event || !this.parsedFundraiser) return;

    const seq = ++this.progressLoadSeq;
    this.isDonationsLoading = true;
    this.donationErrorMessage = '';
    this.render();

    try {
      await this.ensureNostrConnected();
      const result = await fetchFundraiserProgress({
        eventId: this.event.id,
        relays: this.getFundraiserRelays(),
        targetAmountMsats: this.parsedFundraiser.targetAmountMsats,
        closedAt: this.parsedFundraiser.closedAt,
      });

      if (seq !== this.progressLoadSeq) return;

      this.totalRaised = result.totalRaised;
      this.donorCount = result.donorCount;
      this.percentRaised = result.percentRaised;
      this.remainingAmount = result.remainingAmount;
      this.isClosed = result.isClosed;
      this.cachedZapDetails = result.zapDetails;
    } catch (error) {
      if (seq !== this.progressLoadSeq) return;

      console.error('[NostrFundraiser] Failed to fetch fundraiser progress:', error);
      this.totalRaised = 0;
      this.donorCount = 0;
      this.percentRaised = 0;
      this.remainingAmount = this.parsedFundraiser.targetAmountSats;
      this.cachedZapDetails = [];
      this.donationErrorMessage = 'Failed to load donors from relays';
    } finally {
      if (seq !== this.progressLoadSeq) return;
      this.isDonationsLoading = false;
      this.render();
    }
  }

  private async handleZapClick(): Promise<void> {
    if (!this.event || !this.parsedFundraiser) return;

    const npub = this.author?.npub || hexToNpub(this.event.pubkey);
    if (!npub) {
      this.zapErrorMessage = 'Could not resolve fundraiser creator';
      this.render();
      return;
    }

    this.isZapLoading = true;
    this.zapErrorMessage = '';
    this.render();

    try {
      await ensureInitialized();

      this.cachedAmountDialog = await openZapModal({
        npub,
        relays: this.getFundraiserRelays().join(','),
        cachedDialogComponent: this.cachedAmountDialog,
        theme: this.theme === 'dark' ? 'dark' : 'light',
        header: 'Support fundraiser',
        targetEvent: this.event.rawEvent(),
        extraTags: this.parsedFundraiser.beneficiaryZapTags,
      });
    } catch (error) {
      console.error('[NostrFundraiser] Failed to open zap dialog:', error);
      this.zapErrorMessage = error instanceof Error
        ? error.message
        : 'Unable to open zap flow';
    } finally {
      this.isZapLoading = false;
      this.render();
    }
  }

  private async handleDonorsClick(): Promise<void> {
    if (this.cachedZapDetails.length === 0) return;

    try {
      await openZappersDialog({
        zapDetails: this.cachedZapDetails,
        theme: this.theme === 'dark' ? 'dark' : 'light',
        relays: this.getFundraiserRelays(),
        header: 'Donors',
      });
    } catch (error) {
      console.error('[NostrFundraiser] Failed to open donors dialog:', error);
      this.donationErrorMessage = 'Failed to open donors dialog';
      this.render();
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-fundraiser-zap-button', (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      void this.handleZapClick();
    });

    this.delegateEvent('click', '.nostr-fundraiser-donors', (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      void this.handleDonorsClick();
    });
  }

  private resetFundraiserState() {
    this.parsedFundraiser = null;
    this.totalRaised = 0;
    this.donorCount = 0;
    this.percentRaised = 0;
    this.remainingAmount = 0;
    this.isClosed = false;
    this.cachedZapDetails = [];
    this.isDonationsLoading = false;
    this.donationErrorMessage = '';
    this.isZapLoading = false;
    this.zapErrorMessage = '';
    this.progressLoadSeq++;
  }

  protected renderContent() {
    const isLoading = (this.conn.get() === NCStatus.Loading ||
      this.eventStatus.get() === NCStatus.Loading ||
      this.authorStatus.get() === NCStatus.Loading) &&
      !this.parsedFundraiser;

    const isError = this.conn.get() === NCStatus.Error ||
      this.eventStatus.get() === NCStatus.Error ||
      this.authorStatus.get() === NCStatus.Error;

    const renderOptions: RenderFundraiserOptions = {
      isLoading,
      isError,
      errorMessage: this.errorMessage,
      author: this.authorProfile,
      parsedFundraiser: this.parsedFundraiser,
      totalRaised: this.totalRaised,
      donorCount: this.donorCount,
      percentRaised: this.percentRaised,
      remainingAmount: this.remainingAmount,
      isClosed: this.isClosed,
      isDonationsLoading: this.isDonationsLoading,
      donationErrorMessage: this.donationErrorMessage,
      actionErrorMessage: this.zapErrorMessage,
      actionLabel: this.isZapLoading
        ? 'Preparing zap...'
        : (this.getAttribute('text') || 'Zap fundraiser'),
      createdAtLabel: this.formattedDate,
    };

    this.shadowRoot!.innerHTML = `
      ${getFundraiserStyles()}
      ${renderFundraiser(renderOptions)}
    `;
  }
}

if (!customElements.get('nostr-fundraiser')) {
  customElements.define('nostr-fundraiser', NostrFundraiser);
}
