// SPDX-License-Identifier: MIT

import { NDKEvent, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { NostrBaseComponent, NCStatus } from '../base-component/nostr-base-component';
import { EventResolver } from '../resolvers/event-resolver';
import { UserResolver } from '../resolvers/user-resolver';
import { formatEventDate } from '../../common/date-utils';

const EVT_EVENT = 'nc:event';

/**
 * NostrEventComponent
 * ==================
 * Extension of `NostrBaseComponent` that resolves and manages a Nostr Event.
 *
 * Overview
 * - Accepts identity attributes (`hex`, `noteid`, `eventid`, or `naddr`) and validates them.
 * - Resolves an `NDKEvent` via the shared `nostrService` and fetches the event.
 * - Exposes resolved `event` to subclasses for rendering or logic.
 * - Emits lifecycle events for status and event readiness.
 *
 * Observed attributes
 * - `hex`     — raw hex-encoded event ID
 * - `noteid`  — bech32-encoded event ID starting with 'note1...'
 * - `eventid` — bech32-encoded event pointer starting with 'nevent1...' (encodes extra metadata)
 * - `naddr`   — bech32-encoded addressable event code starting with 'naddr1...' (NIP-19)
 *
 * Important: Only one identifier type should be provided (naddr XOR hex/noteid/eventid).
 * Providing multiple identifiers will result in a validation error.
 *
 * Events
 * - `nc:status` — from base, reflects connection and event loading status
 * - `nc:event`  — fired when an event is successfully resolved
 */

export class NostrEventComponent extends NostrBaseComponent {

  protected event: NDKEvent | null = null;
  protected author: NDKUser | null = null;
  protected authorProfile: NDKUserProfile | null = null;
  protected formattedDate: string = '';

  // Decoded naddr data for addressable events (kind, pubkey, dTag, relays)
  protected decodedNaddr: { kind: number; pubkey: string; dTag: string; relays?: string[] } | null = null;

  protected eventStatus = this.channel('event');
  protected authorStatus = this.channel('author');

  // guard to ignore stale event fetches
  private loadSeq = 0;

  private eventResolver!: EventResolver;
  private userResolver!: UserResolver;

  constructor(shadow: boolean = true) {
    super(shadow);
    this.initChannelStatus('event', NCStatus.Loading, { reflectOverall: false });
    this.initChannelStatus('author', NCStatus.Loading, { reflectOverall: false });
    this.eventResolver = new EventResolver(this.nostrService);
    this.userResolver = new UserResolver(this.nostrService);
  }

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'hex',
      'noteid',
      'eventid',
      'naddr',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();

    if (this.validateInputs()) {
      this.resolveEventAndLoad().catch(e => {
        console.error('[NostrEventComponent] init failed:', e);
      });
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);

    if (name === 'hex' || name === 'noteid' || name === 'eventid' || name === 'naddr') {
      if (this.validateInputs()) {
        void this.resolveEventAndLoad();
      }
    }
  }

  /**
   * Returns true if this component requires naddr (addressable events).
   * Returns false if this component uses hex/noteid/eventid (regular events).
   * Override this method in subclasses to specify which identifier type is required.
   * Right now NostrStreamComponent uses this function to return true,
   * so it requires naddr only.
   * In future, if more components need naddr only,
   * we can create a NostrAddressableEventComponent that extends NostrEventComponent and requires naddr only.
   */
  protected requiresNaddr(): boolean {
    return false; // Default: uses hex/noteid/eventid
  }

  /** Protected methods */
  protected validateInputs(): boolean {

    if (!super.validateInputs()) {
      this.eventStatus.set(NCStatus.Idle);
      this.authorStatus.set(NCStatus.Idle);
      return false;
    }

    const hex     = this.getAttribute("hex");
    const noteid  = this.getAttribute("noteid");
    const eventid = this.getAttribute("eventid");
    const naddr   = this.getAttribute("naddr");
    const tagName = this.tagName.toLowerCase();

    const requiresNaddr = this.requiresNaddr();

    if (requiresNaddr) {
      // Component requires naddr only
      // Check if naddr attribute exists (even if empty)
      const hasNaddr = naddr !== null;
      const hasOtherIdentifiers = !!(hex || noteid || eventid);

      if (hasOtherIdentifiers) {
        const provided = [hex && `hex="${hex}"`, noteid && `noteid="${noteid}"`, eventid && `eventid="${eventid}"`].filter(Boolean).join(', ');
        const err = `Provide only naddr attribute. Found: ${provided}`;
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }

      if (!hasNaddr) {
        const err = "Provide naddr attribute";
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }

      // Validate naddr
      const err = this.eventResolver.validateNaddr({ naddr });
      if (err) {
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }
    } else {
      // Component requires hex/noteid/eventid
      const hasNaddr = naddr !== null;
      const hasOtherIdentifiers = !!(hex || noteid || eventid);

      if (hasNaddr) {
        const err = `Provide hex, noteid, or eventid attribute. Found: naddr="${naddr}"`;
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }

      if (!hasOtherIdentifiers) {
        const err = "Provide hex, noteid, or eventid attribute";
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }

      // Validate regular event identifiers
      const err = this.eventResolver.validateInputs({
        hex: hex,
        noteid: noteid,
        eventid: eventid,
      });

      if (err) {
        this.eventStatus.set(NCStatus.Error, err);
        this.authorStatus.set(NCStatus.Error, err);
        console.error(`Nostr-Components: ${tagName}: ${err}`);
        this.errorMessage = err;
        return false;
      }
    }

    this.errorMessage = "";
    return true;

  }

  // TODO: Parallalize loading of event and author profile
  // and render once any of them is ready
  protected async resolveEventAndLoad(): Promise<void> {
    const seq = ++this.loadSeq; // token to prevent stale writes

    // Ensure relays are connected; handle failure inside to avoid unhandled rejection
    try {
      await this.ensureNostrConnected();
    } catch (e) {
      if (seq !== this.loadSeq) return; // stale
      // Base already set status=Error, but make the failure explicit here too
      console.error('[NostrEventComponent] Relay connect failed before event load:', e);
      return;
    }

    this.eventStatus.set(NCStatus.Loading);
    this.authorStatus.set(NCStatus.Loading);
    this.event = null;
    this.author = null;
    this.authorProfile = null;
    this.decodedNaddr = null;

    try {
      const hex     = this.getAttribute('hex');
      const noteid  = this.getAttribute('noteid');
      const eventid = this.getAttribute('eventid');
      const naddr   = this.getAttribute('naddr');

      let event: NDKEvent;

      if (naddr) {
        // Resolve addressable event via naddr
        event = await this.eventResolver.resolveAddressableEvent({ naddr });

        console.log('[NostrEventComponent] Resolved addressable event:', event);

        // Store decoded naddr data for subscription use
        try {
          const decoded = nip19.decode(naddr);
          if (decoded.type === 'naddr') {
            this.decodedNaddr = {
              kind: decoded.data.kind,
              pubkey: decoded.data.pubkey,
              dTag: decoded.data.identifier,
              relays: decoded.data.relays,
            };
          }
        } catch (decodeErr) {
          // Log but don't fail - we already validated and resolved the event
          console.warn('[NostrEventComponent] Failed to cache decoded naddr:', decodeErr);
        }
      } else {
        // Resolve regular event via hex/noteid/eventid
        event = await this.eventResolver.resolveEvent({
          hex: hex,
          noteid: noteid,
          eventid: eventid,
        });
      }

      // stale call check
      if (seq !== this.loadSeq) return;

      this.event = event;
      this.formattedDate = this.formatEventDate(event);
      this.eventStatus.set(NCStatus.Ready);

      this.loadAuthorProfile(event.pubkey, seq);

      this.dispatchEvent(new CustomEvent(EVT_EVENT, {
        detail: { event: this.event },
        bubbles: true,
        composed: true,
      }));

      // Check if both event and author are ready
      this.checkEventAndAuthorReady();
    } catch (err) {
      if (seq !== this.loadSeq) return; // stale
      const msg = err instanceof Error ? err.message : 'Failed to load event';
      console.error('[NostrEventComponent] ' + msg, err);
      this.eventStatus.set(NCStatus.Error, msg);
    }
  }

  private async loadAuthorProfile(pubkey: string, seq: number): Promise<void> {
    try {
      const { user, profile } = await this.userResolver.resolveUser({ pubkey });
      
      // stale call check
      if (seq !== this.loadSeq) return;

      this.author = user;
      this.authorProfile = profile;
      this.authorStatus.set(NCStatus.Ready);

      // Check if both event and author are ready
      this.checkEventAndAuthorReady();
    } catch (err) {
      if (seq !== this.loadSeq) return; // stale
      const msg = err instanceof Error ? err.message : 'Failed to load author profile';
      console.error('[NostrEventComponent] ' + msg, err);
      this.authorStatus.set(NCStatus.Error, msg);
    }
  }

  // TODO: Allow event to render if event is ready, regardless of author status
  // Update post render to handle this
  private checkEventAndAuthorReady(): void {
    const eventReady = this.eventStatus.get() === NCStatus.Ready;
    const authorReady = this.authorStatus.get() === NCStatus.Ready;
    
    if (eventReady && authorReady && this.event) {
      this.onEventReady(this.event);
    }
  }

  private formatEventDate(event: NDKEvent): string {
    return formatEventDate(event.created_at);
  }

  protected renderContent() { }

  /** Hook for subclasses to react when event is ready (e.g., render). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onEventReady(_event: NDKEvent) { }
}
