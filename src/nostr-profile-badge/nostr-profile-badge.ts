import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { Theme } from '../common/types';
import { NostrService } from '../common/nostr-service';
import { DEFAULT_PROFILE_IMAGE } from '../common/constants';
import { parseRelays, parseTheme, parseBooleanAttribute } from '../common/utils';
import { renderProfileBadge } from './render';
import { getProfileBadgeStyles } from './style';

/**
 * TODO: Improve Follow button placement
 */
export default class NostrProfileBadge extends HTMLElement {
  private nostrService: NostrService = NostrService.getInstance();

  private userProfile: NDKUserProfile = {
    name: '',
    picture: '',
    nip05: '',
  };
  private theme: Theme = 'light';
  private isLoading: boolean = true;
  private isError: boolean = false;
  private rendered: boolean = false;

  private ndkUser: NDKUser | null = null;

  private shadow: ShadowRoot;

  constructor() {
    super();
    // Attach a shadow root to the element
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  private getRelays() {
    return parseRelays(this.getAttribute('relays'));
  }

  private getTheme() {
    this.theme = parseTheme(this.getAttribute('theme'));
  }

  getUserProfileAndRender = async () => {
    try {
      this.isLoading = true;
      this.render();

      const user = await this.nostrService.resolveNDKUser({
        npub: this.getAttribute('npub'),
        nip05: this.getAttribute('nip05'),
        pubkey: this.getAttribute('pubkey'),
      });

      if (user?.npub) {
        this.ndkUser = user;

        const profile = await this.nostrService.getProfile(user);

        if (profile) {
          this.userProfile = profile;
          // Set default image only if profile exists but image is missing
          if (!this.userProfile.picture) {
            this.userProfile.picture = DEFAULT_PROFILE_IMAGE;
          }
          this.isError = false;
        } else {
          throw new Error(`Could not fetch profile initially for user ${user.npub}`);
        }
      } else {
        throw new Error('Npub, pubkey or nip05 should be provided and valid');
      }
    } catch (err) {
      console.error("Error while rendering nostr-profile-badge", err);
      this.isError = true;
    } finally {
      this.isLoading = false;
      this.render();
    }
  };


  async connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      await this.nostrService.connectToNostr(this.getRelays());
      this.getUserProfileAndRender();
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
    ];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'relays') {
      this.nostrService.connectToNostr(this.getRelays());
    }

    if (['relays', 'pubkey', 'npub', 'nip05'].includes(name)) {
      // TODO: Validate npub, pubkey
      this.getUserProfileAndRender();
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
    if (this.isError) return;

    const event = new CustomEvent('profileClick', {
      detail: this.userProfile,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open profile in new tab
      let key = this.userProfile?.nip05 || this.getAttribute('nip05') ||
                this.ndkUser?.npub || this.getAttribute('npub');
      if (key) {
        window.open(`https://njump.me/${key}`, '_blank');
      }
    }
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
      this.userProfile.picture === undefined
    ) {
      this.userProfile.picture = DEFAULT_PROFILE_IMAGE;
    }

    // Update theme class on host element
    this.classList.toggle('dark', this.theme === 'dark');
    this.classList.toggle('loading', this.isLoading);
    this.classList.toggle('error-container', this.isError);

    // Get attribute values
    const showFollow = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub = parseBooleanAttribute(this.getAttribute('show-npub'));
    const npubAttribute = this.getAttribute('npub');

    // Generate the HTML content
    const contentHTML = renderProfileBadge(
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
