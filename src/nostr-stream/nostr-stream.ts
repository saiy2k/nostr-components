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
import { getBatchedProfileMetadata } from '../nostr-zap-button/zap-utils';

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
      console.log('parsedStream', this.parsedStream);
      this.lastUpdateTime = Date.now();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse stream event';
      console.error('[NostrStream] ' + msg, error);
      this.eventStatus.set(NCStatus.Error, msg);
      this.renderContent();
      return;
    }

    // Extract pubkey and dTag from decoded naddr data (stored during event resolution)
    if (this.decodedNaddr) {
      this.subscribeToStreamUpdates(this.decodedNaddr.pubkey, this.decodedNaddr.dTag);
    } else {
      console.warn('[NostrStream] No decoded naddr data available for subscription');
    }

    // Start staleness check
    this.startStalenessCheck();

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
   * Subscribe to live stream event updates
   * @param pubkey - The author pubkey from the decoded naddr
   * @param dTag - The 'd' tag identifier from the decoded naddr
   */
  private subscribeToStreamUpdates(pubkey: string, dTag: string): void {
    // Stop existing subscription if present
    if (this.streamSubscription) {
      this.streamSubscription.stop();
      this.streamSubscription = null;
    }

    // Create filter for kind 30311 stream events
    const filter = {
      kinds: [30311],
      authors: [pubkey],
      '#d': [dTag],
    };

    try {
      // Subscribe with persistent subscription (closeOnEose: false)
      this.streamSubscription = this.nostrService.getNDK().subscribe([filter], {
        closeOnEose: false, // Keep subscription open for real-time updates
        groupable: false, // Don't group with other subscriptions
      });

      // Handle incoming events
      this.streamSubscription.on('event', (event: NDKEvent) => {
        // Only update if this event is newer than current event
        if (!this.event || event.created_at > this.event.created_at) {
          try {
            // Update event and parse stream data
            this.event = event;
            console.log('event', event);
            const previousParticipants = this.parsedStream?.participants.map(p => p.pubkey).sort().join(',') || '';
            
            this.parsedStream = parseStreamEvent(event);
            console.log('parsedStream in subs', this.parsedStream);
            this.lastUpdateTime = Date.now();

            // Check if participant list changed
            const currentParticipants = this.parsedStream?.participants.map(p => p.pubkey).sort().join(',') || '';
            const participantsChanged = previousParticipants !== currentParticipants;

            // Re-load participant profiles if participant list changed
            if (participantsChanged) {
              this.loadParticipantProfiles();
            }

            // Re-render with updated data
            this.renderContent();
          } catch (parseError) {
            console.error('[NostrStream] Error parsing stream update:', parseError);
            // Don't set error status - just log it, keep showing current state
          }
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to subscribe to stream updates';
      console.error('[NostrStream] ' + msg, error);
      // Don't set error status - subscription failure is non-fatal, component can still show current state
    }
  }

  /**
   * Start staleness detection for live streams
   * Checks every 5 minutes if a live stream hasn't been updated for 1 hour
   */
  private startStalenessCheck(): void {
    // Clear existing interval if present
    if (this.stalenessCheckInterval !== null) {
      clearInterval(this.stalenessCheckInterval);
      this.stalenessCheckInterval = null;
    }

    // Set interval to check every 5 minutes (300000ms)
    this.stalenessCheckInterval = window.setInterval(() => {
      // Only check if stream is currently live and we have parsed stream data
      if (this.parsedStream && this.parsedStream.status === 'live') {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        const oneHourInMs = 3600000; // 1 hour in milliseconds

        // If no update received for 1 hour, mark as ended
        if (timeSinceLastUpdate > oneHourInMs) {
          console.log('[NostrStream] Stream marked as ended due to staleness (no updates for 1 hour)');
          
          // Update status to ended
          this.parsedStream.status = 'ended';
          
          // Re-render to reflect the status change
          this.renderContent();
        }
      }
    }, 300000); // Check every 5 minutes
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
      const msg = error instanceof Error ? error.message : 'Failed to load participant profiles';
      console.error('[NostrStream] ' + msg, error);
      this.participantsStatus.set(NCStatus.Error, msg);
      this.renderContent();
    }
  }
}

if (!customElements.get('nostr-stream')) {
  customElements.define('nostr-stream', NostrStream);
}
