import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { NostrUserComponent } from '../nostr-user-component';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NCStatus } from '../nostr-base-component';
import { getFollowButtonStyles } from './style';

/**
 * TODO:
 *  * To have a text attribute. Default value being "Follow me on Nostr"
 *  * iconWidth, iconHeight should be customized via CSS4 vars
 *  * Need to have separate loading and following states
 */
export default class NostrFollowButton extends NostrUserComponent {

  private isFollowed: boolean = false;

  static get observedAttributes() {
    return [...super.observedAttributes];
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback(name, oldValue, newValue);
    this.render();
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onUserReady(_user: any, _profile: any) {
    this.render();
  }

  /** Private functions */
  private async handleFollowClick() {
    const nip07signer = new NDKNip07Signer();

    this.setStatus(NCStatus.Loading);
    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      ndk.signer = nip07signer;

      if (!this.user) {
        this.setStatus(NCStatus.Error, "Could not resolve user to follow.");
        this.render();
        return;

      }

      const signer = ndk.signer;
      if (!signer) {
        throw new Error('No signer available');
      }
      const signedUser = await signer.user();
      if (signedUser) {
        await signedUser.follow(this.user);
      }

      this.isFollowed = true;
      this.setStatus(NCStatus.Ready);
    } catch (err) {

      const error = err as Error;
      let errorMessage;
      if (error.message?.includes('NIP-07')) {
        errorMessage = `Looks like you don't have any nostr signing browser extension.
                          Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`;
      } else {
        errorMessage = 'Please authorize, click the button to try again!';
      }
      this.setStatus(NCStatus.Error, errorMessage);
    } finally {
      this.render();
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-follow-button-container', (e) => {
      // If you render a disabled state while loading, guard it:
      if (this.status === NCStatus.Loading) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleFollowClick();
    });
  }

  render() {
    const isLoading           = this.status === NCStatus.Loading;
    const isError             = this.status === NCStatus.Error;
    const iconWidthAttribute  = this.getAttribute('icon-width');
    const iconHeightAttribute = this.getAttribute('icon-height');
    const errorMessage        = super.renderError(this.errorMessage);
    const iconWidth =
      iconWidthAttribute !== null ? Number(iconWidthAttribute) : 25;
    const iconHeight =
      iconHeightAttribute !== null ? Number(iconHeightAttribute) : 25;

    const renderOptions: RenderFollowButtonOptions = {
      theme: this.theme,
      isLoading: isLoading,
      isError: isError,
      isFollowed: this.isFollowed,
      isFollowing: false,
      errorMessage: errorMessage,
      iconWidth,
      iconHeight,
    };

    this.shadowRoot!.innerHTML = `
      ${getFollowButtonStyles(this.theme)}
      ${renderFollowButton(renderOptions)}
    `
  }
}

customElements.define('nostr-follow-button', NostrFollowButton);
