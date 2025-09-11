// SPDX-License-Identifier: MIT

import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent, NCStatus } from '../base-component/nostr-base-component';
import { isValidHex } from '../../common/utils';

const EVT_EVENT = 'nc:event';

/**
 * NostrEventComponent
 * ==================
 * Extension of `NostrBaseComponent` that resolves and manages a Nostr Event.
 *
 * Overview
 * - Accepts identity attribute (`eventId`) and validates.
 * - Fetches an `NDKEvent` via the shared `nostrService`.
 * - Exposes resolved `event` to subclasses for rendering or logic.
 * - Emits lifecycle events for status and event readiness.
 *
 * Observed attributes
 * - `id`     — Nostr event id (64-char hex)
 *
 * Events
 * - `nc:status` — from base, reflects connection and event loading status
 * - `nc:event`  — fired when a event is successfully resolved
 * 
 * - Todo: Support note1, nevent formats
 */

export class NostrEventComponent extends NostrBaseComponent {

  protected event: NDKEvent | null = null;

  protected eventStatus = this.channel('event');

  // guard to ignore stale event fetches
  private loadSeq = 0;

  constructor(shadow: boolean = true) {
    super(shadow);
    this.initChannelStatus('event', NCStatus.Loading, { reflectOverall: false });
  }

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'eventId',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();

    if (this.validateInputs() == true) {
      this.loadEvent().catch(e => {
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

    if (name === 'eventId') {
      if (this.validateInputs() == true) {
        void this.loadEvent();
      }
    }
  }

  /** Protected methods */
  protected validateInputs(): boolean {

    if (!super.validateInputs()) return false;

    const id        = this.getAttribute("eventId");
    const tagName   = this.tagName.toLowerCase();

    if (id == null) {
      this.eventStatus.set(NCStatus.Error, "Please provide id");
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    }

    if (id && !isValidHex(id)) {
      this.eventStatus.set(NCStatus.Error, `Invalid id: ${id}`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    }

    this.errorMessage = "";
    return true;

  }

  protected async loadEvent(): Promise<void> {
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
      const id    = this.getAttribute("eventId")!;

      if (!id) {
        if (seq !== this.loadSeq) return;
        this.eventStatus.set(NCStatus.Error, 'Missing id');
        return;
      }

      const event = await this.nostrService.getPost(id);

      if (!event) {
        if (seq !== this.loadSeq) return;
        this.event = null;
        this.eventStatus.set(NCStatus.Error, `Event not found: ${id}`);
        return;
      }

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
