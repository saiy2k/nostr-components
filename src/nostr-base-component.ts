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
  protected nostrService: NostrService = NostrService.getInstance();

  protected theme: Theme = 'light';
  protected status: NCStatus = NCStatus.Idle;
  protected errorMessage: string = '';

  protected nostrReady!: Promise<void>;
  protected nostrReadyResolve?: () => void;
  protected nostrReadyReject?: (e: unknown) => void;

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
    this.getTheme();
    // Avoid duplicate connects if a subclass handles it
    if (this.status === NCStatus.Idle) void this.connectToNostr();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    if (name === 'relays') {
      this.resetNostrReadyBarrier();
      void this.connectToNostr();
      return;
    }

    if (name === 'theme') this.getTheme();
  }

  /** Status management */
  protected setStatus(next: NCStatus, errorMessage?: string) {
    if (this.status === next && (next !== NCStatus.Error || !errorMessage)) return; // dedupe
    this.status = next;

    // clear previous error unless we’re explicitly in Error
    this.errorMessage = next === NCStatus.Error && errorMessage ? errorMessage : '';

    // reflect for CSS like :host([status="loading"])
    this.setAttribute('status', NCStatus[next].toLowerCase());

    // emit an event for external listeners (optional)
    this.dispatchEvent(new CustomEvent(EVT_STATUS, { detail: { status: next } }));
    this.onStatusChange(next);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onStatusChange(_status: NCStatus) { }

  /** Protected methods */
  protected async connectToNostr() {
    const seq = ++this.connectSeq;
    this.setStatus(NCStatus.Loading);
    try {
      await this.nostrService.connectToNostr(this.getRelays());
      if (seq !== this.connectSeq) return; // stale attempt
      this.setStatus(NCStatus.Ready);
      this.nostrReadyResolve?.();
    } catch (error) {
      if (seq !== this.connectSeq) return; // stale attempt
      console.error('Failed to connect to Nostr relays:', error);
      this.setStatus(NCStatus.Error, 'Failed to connect to relays');
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

  /** Private methods */
  private resetNostrReadyBarrier() {
    this.connectSeq++;
    this.nostrReady = new Promise<void>((resolve, reject) => {
      this.nostrReadyResolve = resolve;
      this.nostrReadyReject = reject;
    });
  }
}
