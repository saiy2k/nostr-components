import { NDKUser, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NostrService } from '../common/nostr-service';

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
    this.isError = false;
    const nip07signer = new NDKNip07Signer();

    this.isLoading = true;
    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      ndk.signer = nip07signer;
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
      if (error.message?.includes('NIP-07')) {
        this.errorMessage = `Looks like you don't have any nostr signing browser extension.
                          Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`;
      } else {
        this.errorMessage = 'Please authorize, click the button to try again!';
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
