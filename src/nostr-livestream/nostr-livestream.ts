// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrEventComponent } from '../base/event-component/nostr-event-component';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { parseLivestreamEvent, ParsedLivestreamEvent, findHostParticipant, getUniqueParticipantPubkeys } from './livestream-utils';
import { renderLivestream, RenderLivestreamOptions } from './render';
import { getLivestreamStyles } from './style';
import { getBatchedProfileMetadata, extractProfileMetadataContent } from '../nostr-zap-button/zap-utils';
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

  private participantsLoadSeq = 0;

  constructor() {
    super();
    this.initChannelStatus('participants', NCStatus.Idle, { reflectOverall: false });
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
   * Check if event and author are ready
   * @returns true if both event and author are ready
   */
  private isEventAndAuthorReady(): boolean {
    return this.eventStatus.get() === NCStatus.Ready && this.authorStatus.get() === NCStatus.Ready;
  }

  /**
   * Override updateHostClasses to only check eventStatus and authorStatus,
   * not participantsStatus (which doesn't affect overall component state)
   */
  protected updateHostClasses() {
    const isReady = this.isEventAndAuthorReady();
    const isError = this.eventStatus.get() === NCStatus.Error || this.authorStatus.get() === NCStatus.Error;
    const isLoading = !isError && !isReady;
    
    // Remove all state classes
    this.classList.remove('is-clickable', 'is-disabled', 'is-error');
    
    // Add appropriate state class (check error first, then loading, then ready)
    if (isError) {
      this.classList.add('is-error');
    } else if (isLoading) {
      this.classList.add('is-disabled');
    } else if (isReady) {
      this.classList.add('is-clickable');
    }
  }

  private parseLivestreamEvent(event: NDKEvent) {
    try {
      this.parsedLivestream = parseLivestreamEvent(event);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse livestream event';
      console.error('[NostrLivestream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.render();
      return;
    }

    // Find host participant
    const hostParticipant = this.parsedLivestream ? findHostParticipant(this.parsedLivestream) : undefined;
    this.hostPubkey = hostParticipant?.pubkey || null;

    this.loadParticipantProfiles();
  }
 
  private async loadParticipantProfiles(): Promise<void> {
    // Increment sequence guard at the start to prevent stale operations
    const seq = ++this.participantsLoadSeq;

    // Check if participants should be shown (defaults to true)
    const showParticipants = this.getAttribute('show-participants') !== 'false';

    // Early returns for empty cases (synchronous, no guard needed)
    if (!this.parsedLivestream || !this.parsedLivestream.participants || this.parsedLivestream.participants.length === 0) {
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    // Determine which pubkeys to fetch
    let pubkeysToFetch: string[];
    
    if (showParticipants) {
      // Fetch all participant profiles
      pubkeysToFetch = getUniqueParticipantPubkeys(this.parsedLivestream);
    } else {
      // Only fetch host profile (needed for author display)
      pubkeysToFetch = this.hostPubkey ? [this.hostPubkey] : [];
    }

    if (pubkeysToFetch.length === 0) {
      this.participantsStatus.set(NCStatus.Ready);
      return;
    }

    // Set status to loading (check guard first in case another call started)
    if (seq !== this.participantsLoadSeq || !this.isConnected) return;
    this.participantsStatus.set(NCStatus.Loading);
    this.render();

    try {
      // Fetch profiles in a single batched call
      const relays = this.getRelays();
      const profileResults = await getBatchedProfileMetadata(pubkeysToFetch, relays);

      // Guard against stale operations after async operation
      if (seq !== this.participantsLoadSeq || !this.isConnected) {
        // This operation is stale, ignore results
        return;
      }

      // Store profiles in Map for quick lookup
      profileResults.forEach(result => {
        // Extract profile metadata content (kind 0 events have JSON content)
        const profileData = result.profile ? extractProfileMetadataContent(result.profile) : null;
        
        // Only store in participantProfiles Map if we're showing participants
        // (host profile is always stored separately if it's the host)
        if (showParticipants) {
          this.participantProfiles.set(result.id, profileData);
        }

        // Store host profile separately if this is the host (needed for author display)
        if (this.hostPubkey && result.id === this.hostPubkey && profileData) {
          this.hostProfile = profileData as NDKUserProfile;
        }
      });

      // Final guard before updating status and rendering
      if (seq !== this.participantsLoadSeq || !this.isConnected) return;

      // Set status to ready
      this.participantsStatus.set(NCStatus.Ready);
      
      // Re-render to show profiles
      this.render();
    } catch (error) {
      // Guard against stale operations in error handler
      if (seq !== this.participantsLoadSeq || !this.isConnected) return;

      const errorMessage = 'Failed to load participants';
      console.error('[NostrLivestream] Participant profile fetch error:', error);
      this.participantsStatus.set(NCStatus.Error, errorMessage);
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
      // Reset all component-specific state when naddr changes
      // This prevents stale data from being displayed during loading
      this.resetLivestreamState();
      // Base class will trigger resolveEventAndLoad
      return;
    }

    // Handle component-specific attributes
    if (name === 'show-participants') {
      // If show-participants changed from false to true, load participant profiles
      const wasHidden = oldValue === 'false';
      const isNowShown = newValue !== 'false';
      if (wasHidden && isNowShown && this.parsedLivestream) {
        // Reload profiles to fetch all participants (previously only host was fetched)
        this.loadParticipantProfiles();
      } else {
        this.render();
      }
    } else if (name === 'show-participant-count' || name === 'auto-play') {
      this.render();
    }
  }

  /**
   * Reset all livestream-specific state when naddr changes
   * This ensures old data doesn't persist while new data is loading
   */
  private resetLivestreamState(): void {
    this.parsedLivestream = null;
    this.participantProfiles.clear();
    this.hostProfile = null;
    this.hostPubkey = null;
    
    // Reset status channels to idle
    this.participantsStatus.set(NCStatus.Idle);
    
    // Increment sequence guard to cancel any in-flight profile loading operations
    this.participantsLoadSeq++;
  }

  /**
   * Handle click on the livestream component - opens zap.stream
   */
  private onLivestreamClick(): void {
    if (!this.isEventAndAuthorReady()) return;

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
    if (!this.isEventAndAuthorReady()) return;

    // Get host pubkey or fallback to event author
    const pubkey = this.hostPubkey || this.event?.pubkey;
    if (!pubkey) return;

    // Convert pubkey to npub for njump URL
    let npub: string;
    try {
      const convertedNpub = hexToNpub(pubkey);
      npub = (convertedNpub && convertedNpub.trim()) || pubkey;
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
      if (!target.closest('.livestream-author-row, video, hls-video, a, .livestream-video')) {
        this.onLivestreamClick();
      }
    });

    // Click on author row (avatar + info)
    this.delegateEvent('click', '.livestream-author-row', () => {
      this.onAuthorClick();
    });
  }

  protected renderContent() {
    const isLoading = !this.isEventAndAuthorReady();
    
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
