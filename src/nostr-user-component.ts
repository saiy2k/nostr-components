import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent } from './nostr-base-component';
import { DEFAULT_PROFILE_IMAGE } from './common/constants';

export class NostrUserComponent extends NostrBaseComponent {

  protected profile: NDKUserProfile | null = null;

  protected user: NDKUser | null = null;

  constructor(shadow: boolean = true) {
    super(shadow);
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'npub',
      'pubkey',
      'nip05',
    ];
  }

  protected async resolveNDKUser(): Promise<NDKUser | null> {
    const userNpub = this.getAttribute('npub');
    const userNip05 = this.getAttribute('nip05');
    const userPubkey = this.getAttribute('pubkey');

    if (!userNpub && !userNip05 && !userPubkey) {
      this.errorMessage = 'Provide npub, nip05 or pubkey';
      this.isError = true;
      return null;
    } else {
      this.user = await this.nostrService.resolveNDKUser({
        npub: userNpub,
        nip05: userNip05,
        pubkey: userPubkey,
      });
      return this.user;
    }
  }

  protected async getProfile(): Promise<NDKUserProfile | null> {
    if (!this.user) {
      this.profile = await this.nostrService.getProfile(this.user);

      if (this.profile != null) {
        if (this.profile.picture === undefined) {
          this.profile.picture = DEFAULT_PROFILE_IMAGE;
        }
      }
      return this.profile;
    }
    return null;
  }
}
