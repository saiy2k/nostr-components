// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { parseLivestreamEvent, ParsedLivestreamEvent } from './livestream-utils';
import { renderLivestream, RenderLivestreamOptions } from './render';
import { getLivestreamStyles } from './style';
import { getBatchedProfileMetadata } from '../nostr-zap-button/zap-utils';
import { hexToNpub } from '../common/utils';
import 'hls-video-element';

const EVT_LIVESTREAM = 'nc:livestream';
const EVT_AUTHOR = 'nc:author';

export default class NostrLivestream extends NostrEventComponent {

  protected parsedLivestream: ParsedLivestreamEvent | null = null;
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
    this.render();
  }

  /**
   * NostrLivestream requires naddr (addressable events) only.
   */
  protected requiresNaddr(): boolean {
    return true;
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onEventReady(event: NDKEvent) {
    this.parseLivestreamEvent(event);
    this.render();
  }

  /**
   * Override updateHostClasses to only check eventStatus and authorStatus,
   * not participantsStatus or videoStatus (which don't affect overall component state)
   */
  protected updateHostClasses() {
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    const isError = this.eventStatus.get() === NCStatus.Error || this.authorStatus.get() === NCStatus.Error;
    const isLoading = !isError && !(eventReady && authorReady);
    
    // Remove all state classes
    this.classList.remove('is-clickable', 'is-disabled', 'is-error');
    
    // Add appropriate state class (check error first, then loading, then ready)
    if (isError) {
      this.classList.add('is-error');
    } else if (isLoading) {
      this.classList.add('is-disabled');
    } else if (eventReady && authorReady) {
      this.classList.add('is-clickable');
    }
  }

  private parseLivestreamEvent(event: NDKEvent) {
    try {
      this.parsedLivestream = parseLivestreamEvent(event);
      console.log('[NostrLivestream] Parsed livestream event:', this.parsedLivestream);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse livestream event';
      console.error('[NostrLivestream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.render();
      return;
    }

    // Find host participant (role === 'Host')
    const hostParticipant = this.parsedLivestream?.participants.find(p => p.role === 'host');
    this.hostPubkey = hostParticipant?.pubkey || null;
    console.log('[NostrLivestream] Host pubkey:', this.hostPubkey);

    // Reset video status if we have a live stream with video URL
    if (this.parsedLivestream?.status === 'live' && this.parsedLivestream?.streamingUrl) {
      this.videoStatus.set(NCStatus.Loading);
    } else {
      this.videoStatus.set(NCStatus.Idle);
    }

    this.loadParticipantProfiles();
  }
 
  private async loadParticipantProfiles(): Promise<void> {
    if (!this.parsedLivestream || !this.parsedLivestream.participants || this.parsedLivestream.participants.length === 0) {
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    const participantPubkeys = this.parsedLivestream.participants.map(p => p.pubkey);
    
    // Remove duplicates
    const uniquePubkeys = [...new Set(participantPubkeys)];

    if (uniquePubkeys.length === 0) {
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    // Set status to loading
    this.participantsStatus.set(NCStatus.Loading);
    this.render();

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
            console.warn('[NostrLivestream] Failed to parse profile content for', result.id, parseError);
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

      console.log('[NostrLivestream] Host profile:', this.hostProfile);
      console.log('participant profiles:', this.participantProfiles);
      
      // Re-render to show profiles
      this.render();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load participants';
      const userFriendlyMsg = 'Failed to load participants';
      console.error('[NostrLivestream] Participant profile fetch error:', msg, error);
      this.participantsStatus.set(NCStatus.Error, userFriendlyMsg);
      this.render();
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
      this.render();
    }
  }

  /**
   * Handle click on the livestream component - opens zap.stream
   */
  private onLivestreamClick(): void {
    // Check if component is ready (event and author loaded)
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    if (!eventReady || !authorReady) return;

    const naddr = this.getAttribute('naddr');
    if (!naddr) return;

    const event = new CustomEvent(EVT_LIVESTREAM, {
      detail: {
        event: this.event,
        parsedLivestream: this.parsedLivestream,
        naddr,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);
    if (notPrevented) {
      window.open(`https://zap.stream/${naddr}`, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Handle click on author info - opens njump.me profile
   */
  private onAuthorClick(): void {
    // Check if component is ready (event and author loaded)
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    if (!eventReady || !authorReady) return;

    // Get host pubkey or fallback to event author
    const pubkey = this.hostPubkey || this.event?.pubkey;
    if (!pubkey) return;

    // Convert pubkey to npub for njump URL
    let npub: string;
    try {
      npub = hexToNpub(pubkey);
    } catch {
      // Fallback to raw pubkey if conversion fails
      npub = pubkey;
    }

    const displayProfile = this.hostProfile || this.authorProfile;

    const event = new CustomEvent(EVT_AUTHOR, {
      detail: {
        pubkey,
        npub,
        profile: displayProfile,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);
    if (notPrevented) {
      window.open(`https://njump.me/${npub}`, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Attach delegated event listeners for video player and click handlers
   */
  private attachDelegatedListeners(): void {
    // Click anywhere on the livestream container (except interactive elements)
    this.delegateEvent('click', '.nostr-livestream-container', (e: Event) => {
      const target = e.target as HTMLElement;
      // Don't trigger livestream click if clicking on author info, video controls, or links
      if (!target.closest('.livestream-author-row, video, hls-video, a, .livestream-video')) {
        this.onLivestreamClick();
      }
    });

    // Click on author row (avatar + info)
    this.delegateEvent('click', '.livestream-author-row', () => {
      this.onAuthorClick();
    });

    // Listen for video error events
    this.delegateEvent('error', '.livestream-video', (e: Event) => {
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
      
      console.error('[NostrLivestream] Video error:', errorMessage, error);
      this.videoStatus.set(NCStatus.Error, errorMessage);
      this.render(); // Re-render to show fallback preview image
    });

    // Listen for video loaded metadata (ready to play)
    this.delegateEvent('loadedmetadata', '.livestream-video', () => {
      this.videoStatus.set(NCStatus.Ready);
    });

    // Set loading status when video starts loading
    this.delegateEvent('loadstart', '.livestream-video', () => {
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

    const renderOptions: RenderLivestreamOptions = {
      isLoading           :  isLoading,
      isError             :  this.computeOverall() === NCStatus.Error,
      errorMessage        :  this.errorMessage,
      author              :  displayProfile,
      parsedLivestream    :  this.parsedLivestream,
      showParticipants    :  this.getAttribute('show-participants') !== 'false', // Default to true
      showParticipantCount:  this.getAttribute('show-participant-count') !== 'false', // Default to true
      autoPlay            :  this.getAttribute('auto-play') === 'true',
      participantProfiles :  this.participantProfiles,
      participantsStatus  :  this.participantsStatus.get(),
      videoStatus         :  this.videoStatus.get(),
    };

    // Get styles
    const styles = getLivestreamStyles();

    // Render
    const rendered = renderLivestream(renderOptions);

    // Update shadow root
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `${styles}${rendered}`;
    }
  }
}

if (!customElements.get('nostr-livestream')) {
  customElements.define('nostr-livestream', NostrLivestream);
}
