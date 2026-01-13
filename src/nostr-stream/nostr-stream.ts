// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { parseStreamEvent, ParsedStreamEvent } from './stream-utils';
import { renderStream, RenderStreamOptions } from './render';
import { getStreamStyles } from './style';
// Imported early as per implementation plan (Phases 4-5)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatEventDate } from '../common/date-utils'; // Will be used in render for date formatting
import { getBatchedProfileMetadata } from '../nostr-zap-button/zap-utils';
// Import hls-video-element to register <hls-video> custom element
import 'hls-video-element';

export default class NostrStream extends NostrEventComponent {

  protected parsedStream: ParsedStreamEvent | null = null;
  protected participantProfiles: Map<string, any> = new Map();

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
    this.attachDelegatedListeners();
    this.renderContent();
  }

  /**
   * Attach delegated event listeners for video player
   */
  private attachDelegatedListeners(): void {
    // Listen for video error events
    this.delegateEvent('error', '.stream-video', (e: Event) => {
      const target = e.target as HTMLMediaElement;
      const error = target.error;
      let errorMessage = 'Video failed to load';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video loading aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video decode error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported';
            break;
          default:
            errorMessage = 'Video failed to load';
        }
      }
      
      console.error('[NostrStream] Video error:', errorMessage, error);
      this.videoStatus.set(NCStatus.Error, errorMessage);
      this.renderContent(); // Re-render to show fallback preview image
    });

    // Listen for video loaded metadata (ready to play)
    this.delegateEvent('loadedmetadata', '.stream-video', () => {
      this.videoStatus.set(NCStatus.Ready);
      // No need to re-render on successful load, just update status
    });

    // Set loading status when video starts loading
    this.delegateEvent('loadstart', '.stream-video', () => {
      this.videoStatus.set(NCStatus.Loading);
      // No need to re-render, just update status
    });
  }

  disconnectedCallback() {
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
      console.log('parsedStream', this.parsedStream);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse stream event';
      console.error('[NostrStream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.renderContent();
      return;
    }

    // Reset video status if we have a live stream with video URL
    if (this.parsedStream?.status === 'live' && this.parsedStream?.streamingUrl) {
      this.videoStatus.set(NCStatus.Loading);
    } else {
      this.videoStatus.set(NCStatus.Idle);
    }

    // Load participant profiles
    this.loadParticipantProfiles();

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
      participantsStatus: this.participantsStatus.get(),
      videoStatus: this.videoStatus.get(),
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

  /**
   * Load participant profiles from Nostr relays
   * Fetches profiles for all participants in the stream
   */
  private async loadParticipantProfiles(): Promise<void> {
    // Extract all participant pubkeys from parsedStream
    if (!this.parsedStream || !this.parsedStream.participants || this.parsedStream.participants.length === 0) {
      // No participants to load
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    const participantPubkeys = this.parsedStream.participants.map(p => p.pubkey);
    
    // Remove duplicates
    const uniquePubkeys = [...new Set(participantPubkeys)];

    if (uniquePubkeys.length === 0) {
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    // Set status to loading
    this.participantsStatus.set(NCStatus.Loading);
    this.renderContent(); // Show loading state

    try {
      // Fetch all profiles in a single batched call
      const profileResults = await getBatchedProfileMetadata(uniquePubkeys);

      // Store profiles in Map for quick lookup
      profileResults.forEach(result => {
        // Extract profile metadata content (kind 0 events have JSON content)
        let profileData = null;
        if (result.profile) {
          try {
            profileData = JSON.parse(result.profile.content || '{}');
          } catch (parseError) {
            console.warn('[NostrStream] Failed to parse profile content for', result.id, parseError);
            profileData = {};
          }
        }
        this.participantProfiles.set(result.id, profileData);
      });

      // Set status to ready
      this.participantsStatus.set(NCStatus.Ready);
      
      // Re-render to show profiles
      this.renderContent();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load participants';
      const userFriendlyMsg = 'Failed to load participants';
      console.error('[NostrStream] Participant profile fetch error:', msg, error);
      this.participantsStatus.set(NCStatus.Error, userFriendlyMsg);
      this.renderContent();
    }
  }
}

if (!customElements.get('nostr-stream')) {
  customElements.define('nostr-stream', NostrStream);
}
