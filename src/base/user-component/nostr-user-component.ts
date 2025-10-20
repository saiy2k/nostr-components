// SPDX-License-Identifier: MIT

import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent, NCStatus } from '../base-component/nostr-base-component';
import { UserResolver } from '../resolvers/user-resolver';

const EVT_USER = 'nc:user';

/**
 * NostrUserComponent
 * ==================
 * Extension of `NostrBaseComponent` that resolves and manages a Nostr user.
 *
 * Overview
 * - Accepts identity attributes (`npub`, `nip05`, or `pubkey`) and validates them.
 * - Resolves an `NDKUser` via the shared `nostrService` and fetches its profile.
 * - Exposes resolved `user` and `profile` to subclasses for rendering or logic.
 * - Emits lifecycle events for status and user readiness.
 *
 * Observed attributes
 * - `npub`   — user's Nostr public key (bech32 npub)
 * - `nip05`  — NIP-05 identifier (e.g. `alice@example.com`)
 * - `pubkey` — raw hex-encoded public key
 *
 * Events
 * - `nc:status` — from base, reflects connection and user/profile loading status
 * - `nc:user`   — fired when a user and profile are successfully resolved
 */

export class NostrUserComponent extends NostrBaseComponent {

  protected user: NDKUser | null = null;
  protected profile: NDKUserProfile | null = null;

  protected userStatus = this.channel('user');

  // guard to ignore stale user fetches
  private loadSeq = 0;

  private resolver = new UserResolver(this.nostrService);

  constructor(shadow: boolean = true) {
    super(shadow);
    this.initChannelStatus('user', NCStatus.Loading, { reflectOverall: false });
  }

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'npub',
      'pubkey',
      'nip05',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();

    if (this.validateInputs()) {
      this.resolveUserAndProfile().catch(e => {
        console.error('[NostrUserComponent] init failed:', e);
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

    if (name === 'npub' || name === 'nip05' || name === 'pubkey') {
      if (this.validateInputs()) {
        // Re-resolve user + profile on identity changes
        void this.resolveUserAndProfile();
      }
    }
  }

  /** Protected methods */
  protected validateInputs(): boolean {

    if (!super.validateInputs()) {
      this.userStatus.set(NCStatus.Idle);
      return false;
    }

    const npub    = this.getAttribute("npub");
    const pubkey  = this.getAttribute("pubkey");
    const nip05   = this.getAttribute("nip05");
    const tagName = this.tagName.toLowerCase();

    const err = this.resolver.validateInputs({
      npub: npub,
      pubkey: pubkey,
      nip05: nip05,
    });

    if (err) {
      this.userStatus.set(NCStatus.Error, err);
      console.error(`Nostr-Components: ${tagName}: ${err}`);
      return false;
    }

    this.errorMessage = "";
    return true;

  }

  protected async resolveUserAndProfile(): Promise<void> {
    const seq = ++this.loadSeq; // token to prevent stale writes

    // Ensure relays are connected; handle failure inside to avoid unhandled rejection
    try {
      await this.ensureNostrConnected();
    } catch (e) {
      if (seq !== this.loadSeq) return; // stale
      // Base already set status=Error, but make the failure explicit here too
      console.error('[NostrUserComponent] Relay connect failed before user/profile load:', e);
      return;
    }

    this.userStatus.set(NCStatus.Loading);

    try {
      const { user, profile } = await this.resolver.resolveUser({
        npub: this.getAttribute('npub'),
        pubkey: this.getAttribute('pubkey'),
        nip05: this.getAttribute('nip05'),
      });

      // stale call check
      if (seq !== this.loadSeq) return;

      if (profile == null) {
        this.userStatus.set(NCStatus.Error, "Profile not found");
        return;
      }

      this.user = user;
      this.profile = profile;
      this.userStatus.set(NCStatus.Ready);
      // Notify listeners that user + profile are available
      this.dispatchEvent(new CustomEvent(EVT_USER, {
        detail: { user: this.user, profile: this.profile },
        bubbles: true,
        composed: true,
      }));
      this.onUserReady(this.user!, this.profile);
    } catch (err) {
      if (seq !== this.loadSeq) return; // stale
      const msg = err instanceof Error ? err.message : 'Failed to load user/profile';
      console.error('[NostrUserComponent] ' + msg, err);
      this.userStatus.set(NCStatus.Error, msg);
    }
  }

  protected renderContent() { }

  /** Hook for subclasses to react when user/profile are ready (e.g., render). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onUserReady(_user: NDKUser, _profile: NDKUserProfile | null) { }
}
