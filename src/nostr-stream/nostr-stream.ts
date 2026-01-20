// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { parseStreamEvent, ParsedStreamEvent } from './stream-utils';
import { renderStream, RenderStreamOptions } from './render';
import { getStreamStyles } from './style';
import { getBatchedProfileMetadata } from '../nostr-zap-button/zap-utils';
import 'hls-video-element';

export default class NostrStream extends NostrEventComponent {

  protected parsedStream: ParsedStreamEvent | null = null;
  protected participantProfiles: Map<string, any> = new Map();
  protected hostProfile: NDKUserProfile | null = null;
  protected hostPubkey: string | null = null;

  // Status channels
  protected participantsStatus = this.channel('participants');
  protected videoStatus = this.channel('video');

  constructor() {
    super();
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
   * NostrStream requires naddr (addressable events) only.
   */
  protected requiresNaddr(): boolean {
    return true;
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onEventReady(event: NDKEvent) {
    this.parseLiveStreamEvent(event);
    this.renderContent();
  }

  /**
   * Override updateHostClasses to only check eventStatus and authorStatus,
   * not participantsStatus or videoStatus (which don't affect overall component state)
   */
  protected updateHostClasses() {
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    const isLoading = !(eventReady && authorReady);
    const isError = this.eventStatus.get() === NCStatus.Error || this.authorStatus.get() === NCStatus.Error;
    
    // Remove all state classes
    this.classList.remove('is-clickable', 'is-disabled', 'is-error');
    
    // Add appropriate state class
    if (isLoading) {
      this.classList.add('is-disabled');
    } else if (isError) {
      this.classList.add('is-error');
    } else if (eventReady && authorReady) {
      this.classList.add('is-clickable');
    }
  }

  private parseLiveStreamEvent(event: NDKEvent) {
    try {
      this.parsedStream = parseStreamEvent(event);
      console.log('[NostrStream] Parsed stream event:', this.parsedStream);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse stream event';
      console.error('[NostrStream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.renderContent();
      return;
    }

    // Find host participant (role === 'Host')
    const hostParticipant = this.parsedStream?.participants.find(p => p.role === 'host');
    this.hostPubkey = hostParticipant?.pubkey || null;
    console.log('[NostrStream] Host pubkey:', this.hostPubkey);

    // Reset video status if we have a live stream with video URL
    if (this.parsedStream?.status === 'live' && this.parsedStream?.streamingUrl) {
      this.videoStatus.set(NCStatus.Loading);
    } else {
      this.videoStatus.set(NCStatus.Idle);
    }

    this.loadParticipantProfiles();
  }
 
  private async loadParticipantProfiles(): Promise<void> {
    if (!this.parsedStream || !this.parsedStream.participants || this.parsedStream.participants.length === 0) {
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
    this.renderContent();

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

        // Store host profile separately if this is the host
        if (this.hostPubkey && result.id === this.hostPubkey && profileData) {
          this.hostProfile = profileData as NDKUserProfile;
        }
      });

      // Set status to ready
      this.participantsStatus.set(NCStatus.Ready);

      console.log('[NostrStream] Host profile:', this.hostProfile);
      console.log('participant profiles:', this.participantProfiles);
      
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

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);

    if (name === 'naddr') {
      // Base class will trigger resolveEventAndLoad
      return;
    }

    // Handle component-specific attributes
    if (name === 'show-participants' || name === 'show-participant-count' || name === 'auto-play') {
      this.renderContent();
    }
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
    });

    // Set loading status when video starts loading
    this.delegateEvent('loadstart', '.stream-video', () => {
      this.videoStatus.set(NCStatus.Loading);
    });
  }

  protected renderContent() {
    // Check if event and author are ready (don't include participants/video status in overall)
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    const isLoading = !(eventReady && authorReady);
    
    // Use host profile if available, otherwise fallback to author profile (for backwards compatibility)
    const displayProfile = this.hostProfile || this.authorProfile;

    const renderOptions: RenderStreamOptions = {
      isLoading           :  isLoading,
      isError             :  this.computeOverall() === NCStatus.Error,
      errorMessage        :  this.errorMessage,
      author              :  displayProfile,
      parsedStream        :  this.parsedStream,
      showParticipants    :  this.getAttribute('show-participants') !== 'false', // Default to true
      showParticipantCount:  this.getAttribute('show-participant-count') !== 'false', // Default to true
      autoPlay            :  this.getAttribute('auto-play') === 'true',
      participantProfiles :  this.participantProfiles,
      participantsStatus  :  this.participantsStatus.get(),
      videoStatus         :  this.videoStatus.get(),
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
