import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent, NCStatus } from './nostr-base-component';
import { DEFAULT_PROFILE_IMAGE } from './common/constants';
import { isValidHex, validateNpub, validateNip05 } from './common/utils';

const EVT_USER = 'nc:user';

/**
 * Base class for components that need a resolved Nostr user and profile.
 * 
 * Attributes:
 * - `npub`   — user's Nostr public key in npub format
 * - `nip05`  — user's NIP-05 identifier
 * - `pubkey` — raw hex-encoded public key
 * 
 * Behavior:
 * - On connect (and whenever any identifier changes), resolves an `NDKUser`
 *   via `nostrService.resolveNDKUser`, then fetches the `NDKUserProfile`.
 * - Updates `status` via the base class `setStatus()`:
 *   - Loading → Ready on success; Error on failures or missing identifiers.
 * - Emits `nc:user` event with `{ user, profile }` when ready.
 */
export class NostrUserComponent extends NostrBaseComponent {

  protected user: NDKUser | null = null;
  protected profile: NDKUserProfile | null = null;

  // guard to ignore stale user fetches
  private loadSeq = 0;

  constructor(shadow: boolean = true) {
    super(shadow);
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

    if (this.validateInputs() == true) {
      this.loadUserAndProfile().catch(e => {
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
      if (this.validateInputs() == true) {
        // Re-resolve user + profile on identity changes
        void this.loadUserAndProfile();
      }
    }
  }

  /** Protected methods */
  protected validateInputs(): boolean {

    if (!super.validateInputs()) return false;

    const npub        = this.getAttribute("npub");
    const pubkeyAttr  = this.getAttribute("pubkey");
    const nip05Attr   = this.getAttribute("nip05");
    const tagName     = this.tagName.toLowerCase();

    if (npub == null && pubkeyAttr == null && nip05Attr == null) {
      this.setStatus(NCStatus.Error, "Provide npub, nip05 or pubkey attribute");
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    }

    if (pubkeyAttr && !isValidHex(pubkeyAttr)) {
      this.setStatus(NCStatus.Error, `Invalid Pubkey: ${pubkeyAttr}`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    } else if (nip05Attr && !validateNip05(nip05Attr)) {
      this.setStatus(NCStatus.Error, `Invalid Nip05: ${nip05Attr}`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    } else if (npub && !validateNpub(npub)) {
      this.setStatus(NCStatus.Error, `Invalid Npub: ${npub}`);
      console.error(`Nostr-Components: ${tagName}: ${this.errorMessage}`);
      return false;
    }

    this.errorMessage = "";
    return true;

  }

  protected async loadUserAndProfile(): Promise<void> {
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

    this.setStatus(NCStatus.Loading);

    try {
      const user = await this.fetchUser();
      const profile = await this.fetchProfile(user);

      // stale call check
      if (seq !== this.loadSeq) return;

      this.user = user;
      this.profile = profile;
      this.setStatus(NCStatus.Ready);
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
      this.setStatus(NCStatus.Error, msg);
    }
  }

  protected async fetchUser(): Promise<NDKUser> {
    const npub    = this.getAttribute('npub');
    const nip05   = this.getAttribute('nip05');
    const pubkey  = this.getAttribute('pubkey');

    if (!npub && !nip05 && !pubkey) {
      throw new Error('Provide one of: npub, nip05, or pubkey');
    }

    const user = await this.nostrService.resolveNDKUser({ npub, nip05, pubkey });
    if (!user) {
      throw new Error('Unable to resolve user from provided identifier');
    }
    return user;
  }

  protected async fetchProfile(user: NDKUser): Promise<NDKUserProfile | null> {
    const profile = await this.nostrService.getProfile(user);
    if (profile && (profile.picture === undefined || profile.picture === null)) {
      profile.picture = DEFAULT_PROFILE_IMAGE;
    }
    return profile ?? null;
  }

  /** Hook for subclasses to react when user/profile are ready (e.g., render). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onUserReady(_user: NDKUser, _profile: NDKUserProfile | null) { }
}
