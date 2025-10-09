// SPDX-License-Identifier: MIT

import { NostrService } from '../../common/nostr-service';
import { Theme } from '../../common/types';
import { parseRelays, parseTheme, isValidRelayUrl } from '../../common/utils';

export enum NCStatus {
  Idle,      // 0
  Loading,   // 1
  Ready,     // 2
  Error,     // 3
}

const EVT_STATUS = 'nc:status';

/**
 * NostrBaseComponent
 * ==================
 * Foundation for all Nostr web components in this library.
 *
 * Overview
 * - Manages relay connectivity via a shared `NostrService`.
 * - Parses common attributes (`theme`, `relays`) and applies theme.
 * - Provides a generic status management logic, that is extensible by derived classes.
 * - Offers small utilities useful to subclasses (event delegation, error snippet).
 *
 * Observed attributes
 * - `theme`  — "light" | "dark"
 * - `relays` — CSV of relay URLs
 * 
 * Events
 * - `nc:status` — from base, reflects connection and user/profile loading status
 * 
 * TODO: Is this class doing too much work? Time to split into smaller components?
 */
export abstract class NostrBaseComponent extends HTMLElement {

  protected nostrService: NostrService = NostrService.getInstance();

  protected theme: Theme = 'light';
  protected errorMessage: string = '';

  protected nostrReady!: Promise<void>;
  protected nostrReadyResolve?: () => void;
  protected nostrReadyReject?: (e: unknown) => void;

  protected conn = this.channel('connection');

  private _statuses = new Map<string, NCStatus>();
  private _overall: NCStatus = NCStatus.Idle;

  // guard to ignore stale connects
  private connectSeq = 0;

  constructor(shadow: boolean = true) {
    super();
    if (shadow) this.attachShadow({ mode: 'open' });
    this.resetNostrReadyBarrier();
  }

  /** Lifecycle methods */
  static get observedAttributes() {
    return ['theme', 'relays'];
  }

  connectedCallback() {
    if (this.validateInputs()) {
      this.getTheme();
      // Avoid duplicate connects if a subclass handles it
      if (this.conn.get() === NCStatus.Idle) {
        void this.connectToNostr();
      }
    }
  }

  disconnectedCallback() {
    // Clean up delegated event listeners if shadow root exists
    if (this.shadowRoot && (this as any)._delegated) {
      (this as any)._delegated.clear();
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;

    if (name === 'theme' || name === 'relays') {
      if (this.validateInputs()) {
        if (name === 'relays') {
          this.resetNostrReadyBarrier();
          void this.connectToNostr();
        }

        if (name === 'theme') {
          this.getTheme();
          this.render();
        }
      }
    }
  }

  /** Status map API */

  protected setStatusFor(key: string, next: NCStatus, error?: string) {
    const prev = this._statuses.get(key);
    const changed = prev !== next || (next === NCStatus.Error && !!error);

    if (!changed) return;

    this._statuses.set(key, next);

    if (next === NCStatus.Error && error) {
      this.errorMessage = error;
    } else if (prev === NCStatus.Error && next !== NCStatus.Error) {
      this.errorMessage = '';
    }

    // Reflect per-key attribute, e.g. user-status="loading"
    const perKeyAttr = `${key}-status`;
    const perKeyVal = NCStatus[next].toLowerCase();
    if (this.getAttribute(perKeyAttr) !== perKeyVal) {
      this.setAttribute(perKeyAttr, perKeyVal);
    }

    // Compute & reflect overall for backward-compat CSS
    const overall = this.computeOverall();
    const overallVal = NCStatus[overall].toLowerCase();
    if (this._overall !== overall) {
      this._overall = overall;
      this.setAttribute('status', overallVal);
      this.onStatusChange(overall);
    } else if (overall === NCStatus.Error && error) {
      // propagate error updates even if overall state didn't flip
      this.onStatusChange(overall);
    }

    // Emit a single event with structured detail
    this.dispatchEvent(new CustomEvent(EVT_STATUS, {
      detail: {
        key,
        status: next,
        all: this.snapshotStatuses(),
        overall: this._overall,
        errorMessage: this.errorMessage || undefined,
      },
      bubbles: true,
      composed: true,
    }));
  }

  protected getStatusFor(key: string): NCStatus {
    return this._statuses.get(key) ?? NCStatus.Idle;
  }

  protected snapshotStatuses(): Record<string, NCStatus> {
    return Object.fromEntries(this._statuses.entries());
  }

  /** Overall status change hook */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onStatusChange(_overall: NCStatus) { }

  protected computeOverall(): NCStatus {
    const vals = [...this._statuses.values()];
    if (vals.includes(NCStatus.Error))   return NCStatus.Error;
    if (vals.includes(NCStatus.Loading)) return NCStatus.Loading;
    if (vals.includes(NCStatus.Ready))   return NCStatus.Ready;
    return NCStatus.Idle;
  }

  /**
   * Before first channel.set(), the map won't be set and hence get() will return `idle`.
   * In some cases (or maybe in all cases), this is not ideal.
   * In UserComponent, 'user' not set and hence returning `idle`, while
   *  'connect' switched between idle -> loading -> ready
   * and then
   *  'user' switches to loading -> ready,
   * results in loading -> ready -> loading -> ready in profile-badge onStatusChange.
   * 
   * To avoid this, this function is called from UserComponent constructor,
   * to set default value as 'loading' without emitting onStatusChange event.
   * 
   * Makes sense?
   * Try commenting this function call in UserComponent()
   * and add a log in ProfileBadge :: onStatusChange. You will get it.
   */
  protected initChannelStatus(key: string, status: NCStatus, opts = { reflectOverall: false }) {
    this._statuses.set(key, status);
    this.setAttribute(`${key}-status`, NCStatus[status].toLowerCase());
    if (opts.reflectOverall) {
      const overall = this.computeOverall();
      this._overall = overall;
      this.setAttribute('status', NCStatus[overall].toLowerCase());
    }
  }

  protected channel(key: string) {
    return {
      set: (s: NCStatus, e?: string) => this.setStatusFor(key, s, e),
      get: () => this.getStatusFor(key)
    };
  }

  /** Protected methods */
  protected validateInputs(): boolean {
    const theme   = this.getAttribute('theme') || 'light';
    const relays  = this.getAttribute('relays');
    const tagName = this.tagName.toLowerCase();

    if (!(theme === 'light' || theme === 'dark')) {
      this.conn.set(NCStatus.Error, `Invalid theme '${theme}'. Accepted values are 'light', 'dark'`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    } else if (relays && typeof relays != 'string') {
      this.conn.set(NCStatus.Error, `Invalid relays list`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    } else if (relays) {
      const relayList = relays.split(',').map(r => r.trim()).filter(Boolean);
      const invalidRelays = relayList.filter(relay => !isValidRelayUrl(relay));
      
      if (invalidRelays.length > 0) {
        const invalidRelaysList = invalidRelays.join(', ');
        this.conn.set(NCStatus.Error, `Invalid relay URLs: ${invalidRelaysList}. Relay URLs must start with 'wss://' or 'ws://'`);
        console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
        return false;
      }
    }

    this.errorMessage = "";
    return true;
  }

  protected async connectToNostr() {
    const seq = ++this.connectSeq;
    this.conn.set(NCStatus.Loading);
    try {
      await this.nostrService.connectToNostr(this.getRelays());
      if (seq !== this.connectSeq) return; // stale attempt
      this.conn.set(NCStatus.Ready);
      this.nostrReadyResolve?.();
    } catch (error) {
      if (seq !== this.connectSeq) return; // stale attempt
      console.error('Failed to connect to Nostr relays:', error);
      this.conn.set(NCStatus.Error, 'Failed to connect to relays');
      this.nostrReadyReject?.(error);
    }
  }

  protected ensureNostrConnected(): Promise<void> {
    return this.nostrReady;
  }

  protected getRelays() {
    return parseRelays(this.getAttribute('relays'));
  }

  protected getTheme() {
    this.theme = parseTheme(this.getAttribute('theme'));
  }

  /**
   * Delegate events within shadow DOM.
   * Example: this.delegateEvent('click', '#npub-copy', (e) => this.copyNpub(e));
  */
  protected delegateEvent<K extends keyof HTMLElementEventMap>(
    type: K,
    selector: string,
    handler: (event: HTMLElementEventMap[K]) => void
  ) {
    const root = this.shadowRoot;
    if (!root) return;

    // Attach once per (event type, selector)
    const key = `${type}:${selector}`;
    if ((this as any)._delegated?.has(key)) return;

    if (!(this as any)._delegated) (this as any)._delegated = new Set<string>();
    (this as any)._delegated.add(key);

    root.addEventListener(type, (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(selector)) {
        handler(e as any);
      }
    });
  }

  protected addDelegatedListener<K extends keyof HTMLElementEventMap>(
    type: K,
    selector: string,
    handler: (event: HTMLElementEventMap[K]) => void
  ) {
    this.delegateEvent(type, selector, handler);
  }

  protected renderError(errorMessage: string): string {
    return `Error: ${errorMessage}`;
  }

  /**
   * Updates host element classes based on component status
   * This is a common pattern used by all components
   */
  protected updateHostClasses() {
    const isLoading = this.computeOverall() === NCStatus.Loading;
    const isError = this.computeOverall() === NCStatus.Error;
    const isReady = this.computeOverall() === NCStatus.Ready;
    
    // Remove all state classes
    this.classList.remove('is-clickable', 'is-disabled', 'is-error');
    
    // Add appropriate state class
    if (isLoading) {
      this.classList.add('is-disabled');
    } else if (isError) {
      this.classList.add('is-error');
    } else if (isReady) {
      this.classList.add('is-clickable');
    }
  }

  /**
   * Base render method that handles common render logic
   * Subclasses should override renderContent() instead of render()
   */
  protected render() {
    this.updateHostClasses();
    this.renderContent();
  }

  /**
   * Abstract method for component-specific rendering
   * Must be implemented by subclasses
   */
  protected abstract renderContent(): void;

  /** Private methods */
  private resetNostrReadyBarrier() {
    this.connectSeq++;
    this.nostrReady = new Promise<void>((resolve, reject) => {
      this.nostrReadyResolve = resolve;
      this.nostrReadyReject = reject;
    });
  }
}
