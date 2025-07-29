import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent } from './nostr-base-component';
import { DEFAULT_PROFILE_IMAGE } from './common/constants';

export class NostrUserComponent extends NostrBaseComponent {

  protected profile: NDKUserProfile = {
    name: '',
    picture: '',
    nip05: '',
  };

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
    const userToFollowNpub = this.getAttribute('npub');
    const userToFollowNip05 = this.getAttribute('nip05');
    const userToFollowPubkey = this.getAttribute('pubkey');

    if (!userToFollowNpub && !userToFollowNip05 && !userToFollowPubkey) {
      this.errorMessage = 'Provide npub, nip05 or pubkey';
      this.isError = true;
      return null;
    } else {
      this.user = await this.nostrService.resolveNDKUser({
        npub: this.getAttribute('npub'),
        nip05: this.getAttribute('nip05'),
        pubkey: this.getAttribute('pubkey'),
      });
      return this.user;
    }
  }

  protected async getProfile(): Promise<NDKUserProfile> {
    const profile = await this.nostrService.getProfile(this.user);
    if (profile == null) {
      this.profile = {
        name: "ERROR",
        nip05: "",
        picture: DEFAULT_PROFILE_IMAGE
      };
    } else {
      this.profile = profile;
      if (this.profile.picture === undefined) {
        this.profile.picture = DEFAULT_PROFILE_IMAGE;
      }
    }
    return this.profile;
  }
}
