import { NostrService } from './common/nostr-service';
import { Theme } from './common/types';
import { parseRelays, parseTheme } from './common/utils';

export enum NCStatus {
  Idle,      // 0
  Loading,   // 1
  Ready,     // 2
  Error,     // 3
}

const EVT_STATUS = 'nc:status';

/**
 * Base class for all Nostr web components in the project.
 * 
 * - Shared `nostrService` instance for connecting to Nostr relays.
 * - Common attributes:
 *    - `relays` (comma-separated relay URLs) — parsed via `parseRelays`
 *    - `theme`  ("light" | "dark") — parsed via `parseTheme`
 * - Single lifecycle status via `NCStatus` (no `isLoading`/`isError`/`rendered`).
 * - Optional open Shadow DOM.
 * - Reacts to attribute changes:
 *    - `relays` → reconnect
 *    - `theme`  → update theme
 * 
 * Extend this class when building new Nostr components to inherit relay
 * connection logic, theme management, and shared service access.
 */
export class NostrBaseComponent extends HTMLElement {

  static readonly KEY_CONNECTION = 'connection' as const;

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

        if (name === 'theme') this.getTheme();
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

  protected channel(key: string) {
    return {
      set: (s: NCStatus, e?: string) => this.setStatusFor(key, s, e),
      get: () => this.getStatusFor(key),
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
      // TODO: Improve relay validation
    } else if (relays && typeof relays != 'string') {
      this.conn.set(NCStatus.Error, `Invalid relays list`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
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
      if (this.validateInputs() == true) {
        this.conn.set(NCStatus.Ready);
      }
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

  protected renderError(errorMessage: String): string {
    return `<span class="error-text">Error: ${errorMessage}</span>`;
  }

  /** Private methods */
  private resetNostrReadyBarrier() {
    this.connectSeq++;
    this.nostrReady = new Promise<void>((resolve, reject) => {
      this.nostrReadyResolve = resolve;
      this.nostrReadyReject = reject;
    });
  }
}
