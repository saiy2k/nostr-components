// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent, NCStatus } from '../base-component/nostr-base-component';
import { EventResolver } from '../resolvers/event-resolver';

const EVT_EVENT = 'nc:event';

/**
 * NostrEventComponent
 * ==================
 * Extension of `NostrBaseComponent` that resolves and manages a Nostr Event.
 *
 * Overview
 * - Accepts identity attributes (`hex`, `noteid`, or `eventid`) and validates them.
 * - Resolves an `NDKEvent` via the shared `nostrService` and fetches the event.
 * - Exposes resolved `event` to subclasses for rendering or logic.
 * - Emits lifecycle events for status and event readiness.
 *
 * Observed attributes
 * - `hex`     — raw hex-encoded event ID
 * - `noteid`  — bech32-encoded event ID starting with 'note1...'
 * - `eventid` — bech32-encoded event pointer starting with 'nevent1...' (encodes extra metadata)
 *
 * Events
 * - `nc:status` — from base, reflects connection and event loading status
 * - `nc:event`  — fired when an event is successfully resolved
 */

export class NostrEventComponent extends NostrBaseComponent {

  protected event: NDKEvent | null = null;

  protected eventStatus = this.channel('event');

  // guard to ignore stale event fetches
  private loadSeq = 0;

  private resolver = new EventResolver(this.nostrService);

  constructor(shadow: boolean = true) {
    super(shadow);
    this.initChannelStatus('event', NCStatus.Loading, { reflectOverall: false });
  }

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'hex',
      'noteid',
      'eventid',
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

    if (name === 'hex' || name === 'noteid' || name === 'eventid') {
      if (this.validateInputs()) {
        void this.resolveEventAndLoad();
      }
    }
  }

  /** Protected methods */
  protected validateInputs(): boolean {

    if (!super.validateInputs()) return false;

    const hex     = this.getAttribute("hex");
    const noteid  = this.getAttribute("noteid");
    const eventid = this.getAttribute("eventid");
    const tagName = this.tagName.toLowerCase();

    const err = this.resolver.validateInputs({
      hex: hex,
      noteid: noteid,
      eventid: eventid,
    });

    if (err) {
      this.eventStatus.set(NCStatus.Error, err);
      console.error(`Nostr-Components: ${tagName}: ${err}`);
      return false;
    }

    this.errorMessage = "";
    return true;

  }

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

    try {
      const hex     = this.getAttribute('hex');
      const noteid  = this.getAttribute('noteid');
      const eventid = this.getAttribute('eventid');

      const event = await this.resolver.resolveEvent({
        hex: hex,
        noteid: noteid,
        eventid: eventid,
      });

      // stale call check
      if (seq !== this.loadSeq) return;

      this.event = event;
      this.eventStatus.set(NCStatus.Ready);

      // Notify listeners that event is available
      this.dispatchEvent(new CustomEvent(EVT_EVENT, {
        detail: { event: this.event },
        bubbles: true,
        composed: true,
      }));
      this.onEventReady(this.event!);
    } catch (err) {
      if (seq !== this.loadSeq) return; // stale
      const msg = err instanceof Error ? err.message : 'Failed to load event';
      console.error('[NostrEventComponent] ' + msg, err);
      this.eventStatus.set(NCStatus.Error, msg);
    }
  }

  protected renderContent() { }

  /** Hook for subclasses to react when event is ready (e.g., render). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onEventReady(_event: NDKEvent) { }
}
