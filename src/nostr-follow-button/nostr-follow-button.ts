import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { NostrBaseComponent } from '../nostr-base-component';
import { renderFollowButton, RenderFollowButtonOptions } from './render';

/**
 * TODO:
 *  * To have a text attribute. Default value being "Follow me on Nostr"
 */
export default class NostrFollowButton extends NostrBaseComponent {

  private isFollowed: boolean = false;
  private boundHandleClick: (() => Promise<void>) | null = null;

  connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      this.connectToNostr();
      this.render();
      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return [...super.observedAttributes, 'npub', 'pubkey', 'nip05'];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null
  ) {
    super.attributeChangedCallback(name, _oldValue, _newValue);
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
      await this.connectToNostr();

      const userToFollow = await this.resolveNDKUser();

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
      } else {
        this.errorMessage = 'Could not resolve user to follow.';
        this.isError = true;
        this.isLoading = false;
        this.render();
        return;
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
