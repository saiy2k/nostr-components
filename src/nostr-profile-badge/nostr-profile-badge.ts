import NDK, { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderProfileBadge, getProfileBadgeStyles } from './render';

export default class NostrProfileBadge extends HTMLElement {
  private rendered: boolean = false;

  private ndk: NDK = new NDK();

  private userProfile: NDKUserProfile = {
    name: '',
    image: '',
    nip05: '',
  };

  private theme: Theme = 'light';

  private isLoading: boolean = true;
  private isError: boolean = false;

  private onClick: Function | null = null;

  private ndkUser: NDKUser;

  private shadow: ShadowRoot;

  constructor() {
    super();
    // Attach a shadow root to the element
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectToNostr = async () => {
    await this.ndk.connect();
  };

  getRelays = () => {
    const userRelays = this.getAttribute('relays');

    if (userRelays) {
      return userRelays.split(',');
    }

    return DEFAULT_RELAYS;
  };

  getNDKUser = async () => {
    const npub = this.getAttribute('npub');
    const nip05 = this.getAttribute('nip05');
    const pubkey = this.getAttribute('pubkey');

    if (npub) {
      return this.ndk.getUser({
        npub: npub as string,
      });
    } else if (nip05) {
      return this.ndk.getUserFromNip05(nip05 as string);
    } else if (pubkey) {
      return this.ndk.getUser({
        pubkey: pubkey,
      });
    }

    return null;
  };

  getUserProfile = async () => {
    try {
      this.isLoading = true;
      this.render();

      const user = await this.getNDKUser();

      if (user?.npub) {
        this.ndkUser = user;

        await user.fetchProfile();

        // Check if profile was fetched successfully
        if (user.profile) {
          this.userProfile = user.profile as NDKUserProfile;
          // Set default image only if profile exists but image is missing
          if (!this.userProfile.image) {
            this.userProfile.image = './assets/default_dp.png';
          }
          this.isError = false;
        } else {
          // Profile not found initially, just log and ensure default image if needed.
          // DO NOT reset name/nip05 here, as NDK might provide them later.
          console.warn(
            `Could not fetch profile initially for user ${user.npub}`
          );
          if (!this.userProfile.image) {
            // Only set default if absolutely no image is set yet
            this.userProfile.image = './assets/default_dp.png';
          }
          // Consider setting this.isError = true if profile is truly expected but not found?
          // For now, let's keep it false.
          this.isError = false; // Keep consistent with previous logic for now
        }
      } else {
        throw new Error('Either npub or nip05 should be provided');
      }
    } catch (err) {
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  };

  getTheme = async () => {
    this.theme = 'light';

    const userTheme = this.getAttribute('theme');

    if (userTheme) {
      const isValidTheme = ['light', 'dark'].includes(userTheme);

      if (!isValidTheme) {
        throw new Error(
          `Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`
        );
      }

      this.theme = userTheme as Theme;
    }
  };

  async connectedCallback() {
    const onClick = this.getAttribute('onClick');
    if (onClick !== null) {
      this.onClick = window[onClick];
    }

    if (!this.rendered) {
      this.ndk = new NDK({
        explicitRelayUrls: this.getRelays(),
      });

      this.getTheme();

      await this.connectToNostr(); // Wait for connection

      this.getUserProfile(); // Then fetch profile

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return [
      'relays',
      'npub',
      'pubkey',
      'nip05',
      'theme',
      'show-npub',
      'show-follow',
      'onClick',
    ];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'relays') {
      this.ndk.explicitRelayUrls = this.getRelays();
      this.connectToNostr();
    }

    if (['relays', 'npub', 'nip05'].includes(name)) {
      // Possible property changes - relays, npub, nip05
      // For all these changes, we have to fetch profile anyways
      // TODO: Validate npub
      this.getUserProfile();
    }

    if (name === 'onClick') {
      this.onClick = window[newValue];
    }

    if (name === 'theme') {
      this.getTheme();
      this.render();
    }

    if (['show-npub', 'show-follow'].includes(name)) {
      this.render();
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  copy(string: string) {
    navigator.clipboard.writeText(string);
  }

  onProfileClick() {
    if (this.isError) {
      return;
    }

    if (this.onClick !== null && typeof this.onClick === 'function') {
      this.onClick(this.userProfile);
      return;
    }

    let key = '';

    const nip05 = this.getAttribute('nip05');
    const npub = this.getAttribute('npub');

    if (nip05) {
      key = nip05;
    } else if (npub) {
      key = npub;
    } else {
      return;
    }

    window.open(`https://njump.me/${key}`, '_blank');
  }

  attachEventListeners() {
    // Find elements within the shadow DOM
    const profileBadge = this.shadow.querySelector(
      '.nostr-profile-badge-container'
    );
    const npubCopy = this.shadow.querySelector('#npub-copy');
    const nip05Copy = this.shadow.querySelector('#nip05-copy');

    // Add click handler for the profile badge
    profileBadge?.addEventListener('click', (e: Event) => {
      if (
        !(e.target as HTMLElement).closest('.nostr-follow-button-container')
      ) {
        this.onProfileClick();
      }
    });

    // Add click handler for NPUB copy button
    npubCopy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copy(this.getAttribute('npub') || this.ndkUser?.npub || '');
    });

    // Add click handler for NIP-05 copy button
    nip05Copy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copy(this.getAttribute('nip05') || this.userProfile.nip05 || '');
    });
  }

  render() {
    // Ensure default image if needed
    if (
      this.isLoading === false &&
      this.userProfile &&
      this.userProfile.image === undefined
    ) {
      this.userProfile.image = './assets/default_dp.png';
    }

    // Update theme class on host element
    this.classList.toggle('dark', this.theme === 'dark');
    this.classList.toggle('loading', this.isLoading);
    this.classList.toggle('error-container', this.isError);

    // Get attribute values
    const showNpub = this.getAttribute('show-npub');
    const showFollow = this.getAttribute('show-follow');
    const npubAttribute = this.getAttribute('npub');

    // Generate the HTML content
    const contentHTML = renderProfileBadge(
      this.theme,
      this.isLoading,
      this.isError,
      this.userProfile,
      this.ndkUser,
      npubAttribute,
      showNpub,
      showFollow
    );

    // Combine styles and content for shadow DOM
    this.shadow.innerHTML = `
      ${getProfileBadgeStyles(this.theme)}
      <div class="nostr-profile-badge-wrapper">
        ${contentHTML}
      </div>
    `;

    this.attachEventListeners();
  }
}

customElements.define('nostr-profile-badge', NostrProfileBadge);
