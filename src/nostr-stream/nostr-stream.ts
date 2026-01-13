// SPDX-License-Identifier: MIT

import { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { parseStreamEvent, ParsedStreamEvent } from './stream-utils';
import { renderStream, RenderStreamOptions } from './render';
import { getStreamStyles } from './style';
// Imported early as per implementation plan (Phases 4-5)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatEventDate } from '../common/date-utils'; // Will be used in render for date formatting
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getBatchedProfileMetadata } from '../nostr-zap-button/zap-utils'; // Will be used in Phase 5

export default class NostrStream extends NostrEventComponent {

  protected parsedStream: ParsedStreamEvent | null = null;
  protected streamSubscription: NDKSubscription | null = null;
  protected participantProfiles: Map<string, any> = new Map();
  protected lastUpdateTime: number = 0;
  private stalenessCheckInterval: number | null = null;

  // Status channels
  protected participantsStatus = this.channel('participants');
  protected videoStatus = this.channel('video');

  constructor() {
    super();
    // Initialize status channels
    this.initChannelStatus('participants', NCStatus.Idle, { reflectOverall: false });
    this.initChannelStatus('video', NCStatus.Idle, { reflectOverall: false });
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-participants',
      'show-participant-count',
      'auto-play',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();
    // TODO: Attach delegated listeners (Phase 6)
    this.renderContent();
  }

  disconnectedCallback() {
    // Clean up subscription
    if (this.streamSubscription) {
      this.streamSubscription.stop();
      this.streamSubscription = null;
    }
    
    // Clear staleness interval
    if (this.stalenessCheckInterval !== null) {
      clearInterval(this.stalenessCheckInterval);
      this.stalenessCheckInterval = null;
    }
    
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);

    // Handle naddr changes (re-resolve event) - handled by base class
    if (name === 'naddr') {
      // Base class will trigger resolveEventAndLoad
      return;
    }

    // Handle component-specific attributes
    if (name === 'show-participants' || name === 'show-participant-count' || name === 'auto-play') {
      this.renderContent();
    }

    // Handle theme and relays - handled by base class
    if (name === 'data-theme' || name === 'relays') {
      this.renderContent();
    }
  }

  protected onEventReady(event: NDKEvent) {
    console.log('onEventReady', event);
    // Parse stream event
    try {
      this.parsedStream = parseStreamEvent(event);
      this.lastUpdateTime = Date.now();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse stream event';
      console.error('[NostrStream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.renderContent();
      return;
    }

    // Extract pubkey and dTag from decoded naddr data (stored during event resolution)
    // TODO: Start live subscription (Phase 4)
    // subscribeToStreamUpdates(pubkey, dTag);

    // TODO: Start staleness check (Phase 4)
    // startStalenessCheck();

    // TODO: Load participant profiles (Phase 5)
    // loadParticipantProfiles();

    // Render content
    this.renderContent();
  }

  protected renderContent() {
    // Build render options from component state
    const renderOptions: RenderStreamOptions = {
      isLoading: this.computeOverall() === NCStatus.Loading,
      isError: this.computeOverall() === NCStatus.Error,
      errorMessage: this.errorMessage,
      author: this.authorProfile,
      parsedStream: this.parsedStream,
      showParticipants: this.getAttribute('show-participants') === 'true',
      showParticipantCount: this.getAttribute('show-participant-count') === 'true',
      autoPlay: this.getAttribute('auto-play') === 'true',
      participantProfiles: this.participantProfiles,
    };

    // Get styles
    const styles = getStreamStyles();

    // Render
    const rendered = renderStream(renderOptions);

    // Update shadow root
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `${styles}${rendered}`;
    }
  }
}

if (!customElements.get('nostr-stream')) {
  customElements.define('nostr-stream', NostrStream);
}
