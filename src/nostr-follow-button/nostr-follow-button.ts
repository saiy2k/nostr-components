import { NDKUser, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NostrService } from '../common/nostr-service';
import { onboardingService } from '../onboarding/onboarding-service';
import '../onboarding/onboarding-modal'; // Ensure the modal component is registered

export default class NostrFollowButton extends HTMLElement {
  private rendered: boolean = false;
  private nostrService: NostrService = NostrService.getInstance();

  private theme: Theme = 'light';

  private isLoading: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = '';

  private isFollowed: boolean = false;
  private boundHandleClick: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getRelays = () => {
    const userRelays = this.getAttribute('relays');
    if (userRelays) {
      return userRelays.split(',');
    }
    return DEFAULT_RELAYS;
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

  connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      this.nostrService.connectToNostr(this.getRelays());
      this.render();
      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ['relays', 'npub', 'theme'];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null
  ) {
    if (name === 'relays') {
      this.nostrService.connectToNostr(this.getRelays());
    }

    if (name === 'theme') {
      this.getTheme();
    }

    this.render();
  }

  private async handleFollowClick() {
    // Show loading state immediately
    this.isLoading = true;
    this.render();

    try {
      // Wait for authentication to be ready (handles async reconnection)
      const hasAuth = await onboardingService.waitForAuthentication();

      if (hasAuth) {
        await this._executeFollowWithNip07();
      } else {
        this.isLoading = false;
        this.render();
        this._showOnboardingModal();
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      this.isLoading = false;
      this.render();
      this._showOnboardingModal();
    }
  }

  private _showOnboardingModal() {
    let modal = document.body.querySelector('nostr-onboarding-modal');
    if (!modal) {
      modal = document.createElement('nostr-onboarding-modal');
      document.body.appendChild(modal);
    }
    modal.setAttribute('open', 'true');
  }

  private async _executeFollowWithNip07() {
    this.isError = false;

    // Check if we already have a signer in the NostrService
    const ndk = this.nostrService.getNDK();
    if (!ndk.signer) {
      // If we don't have a signer yet, try to use the NIP-07 extension
      if (window.nostr) {
        const nip07signer = new NDKNip07Signer();
        this.nostrService.setSigner(nip07signer);
      } else {
        // If we have neither a stored signer nor extension, show an error
        this.errorMessage = 'No authentication method available';
        this.isError = true;
        this.render();
        return;
      }
    }

    this.isLoading = true;
    this.render();

    try {
      await this.nostrService.connectToNostr(this.getRelays());

      const userToFollowNpub = this.getAttribute('npub');
      const userToFollowNip05 = this.getAttribute('nip05');
      const userToFollowPubkey = this.getAttribute('pubkey');

      if (!userToFollowNpub && !userToFollowNip05 && !userToFollowPubkey) {
        this.errorMessage = 'Provide npub, nip05 or pubkey';
        this.isError = true;
      } else {
        let userToFollow: NDKUser | null = null;

        if (userToFollowPubkey) {
          userToFollow = ndk.getUser({
            pubkey: userToFollowPubkey,
          });
        } else if (userToFollowNpub) {
          userToFollow = ndk.getUser({
            npub: userToFollowNpub,
          });
        } else if (userToFollowNip05) {
          const userFromNip05 = await ndk.getUserFromNip05(userToFollowNip05);

          if (userFromNip05) {
            userToFollow = ndk.getUser({
              npub: userFromNip05.npub,
            });
          }
        }

        if (userToFollow != null) {
          const signer = ndk.signer;
          if (!signer) {
            throw new Error('No signer available');
          }
          const signedUser = await signer.user();
          if (signedUser) {
            await signedUser.follow(userToFollow);
          }

          this.isFollowed = true;
        }
      }
    } catch (err) {
      this.isError = true;

      const error = err as Error;
      if (error.message && error.message.includes('NIP-07')) {
        this.errorMessage = `Looks like you don't have any nostr signing browser extension.`;
      } else {
        this.errorMessage = 'An error occurred. Please try again.';
      }
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  attachEventListeners() {
    const button = this.shadowRoot!.querySelector('.nostr-follow-button');
    if (!button) return;

    // Remove any existing listener
    if (this.boundHandleClick) {
      button.removeEventListener('click', this.boundHandleClick);
    }

    // Create and store a new bound handler
    this.boundHandleClick = this.handleFollowClick.bind(this);
    button.addEventListener('click', this.boundHandleClick);
  }

  disconnectedCallback() {
    const button = this.shadowRoot?.querySelector('.nostr-follow-button');
    if (button && this.boundHandleClick) {
      button.removeEventListener('click', this.boundHandleClick);
      this.boundHandleClick = null;
    }
  }

  render() {
    const iconWidthAttribute = this.getAttribute('icon-width');
    const iconHeightAttribute = this.getAttribute('icon-height');

    const iconWidth =
      iconWidthAttribute !== null ? Number(iconWidthAttribute) : 25;
    const iconHeight =
      iconHeightAttribute !== null ? Number(iconHeightAttribute) : 25;

    const renderOptions: RenderFollowButtonOptions = {
      theme: this.theme,
      isLoading: this.isLoading,
      isError: this.isError,
      isFollowed: this.isFollowed,
      errorMessage: this.errorMessage,
      iconWidth,
      iconHeight,
    };

    this.shadowRoot!.innerHTML = renderFollowButton(renderOptions);
    this.attachEventListeners();
  }
}

customElements.define('nostr-follow-button', NostrFollowButton);
