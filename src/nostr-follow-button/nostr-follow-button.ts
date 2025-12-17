// SPDX-License-Identifier: MIT

import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { getFollowButtonStyles } from './style';

/**
 * TODO:
 *  1. To have a text attribute. Default value being "Follow me on Nostr"
 *  2. show-avatar attribute to show the avatar of the user, instead of nostr logo.
 */
export default class NostrFollowButton extends NostrUserComponent {

  protected followStatus = this.channel('follow');
  private isFollowed: boolean = false;

  static get observedAttributes() {
    return [...super.observedAttributes, 'show-avatar', 'text'];
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
    if (this.hasAttribute('disabled')) return;

    if (this.computeOverall() !== NCStatus.Ready) return;
    const nip07signer = new NDKNip07Signer();

    this.followStatus.set(NCStatus.Loading);
    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      ndk.signer = nip07signer;

      if (!this.user) {
        this.followStatus.set(NCStatus.Error, "Could not resolve user to follow.");
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
      this.followStatus.set(NCStatus.Ready);
    } catch (err) {

      const error = err as Error;
      let errorMessage;
      if (error.message?.includes('NIP-07')) {
        errorMessage = `Looks like you don't have any nostr signing browser extension.
                          Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`;
      } else {
        errorMessage = 'Please authorize, click the button to try again!';
      }
      this.followStatus.set(NCStatus.Error, errorMessage);
    } finally {
      this.render();
    }
  }

  private attachDelegatedListeners() {
    this.delegateEvent('click', '.nostr-follow-button-container', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      void this.handleFollowClick();
    });
  }

  protected renderContent() {
  const isLoading           = this.computeOverall() == NCStatus.Loading;
  const isFollowing         = this.followStatus.get() == NCStatus.Loading;
  const isError             = this.computeOverall() === NCStatus.Error;
  const errorMessage        = super.renderError(this.errorMessage);
  const showAvatar          = this.hasAttribute('show-avatar');
  const customText          = this.getAttribute('text') || 'Follow me on nostr';
  const isDisabled          = this.hasAttribute('disabled');

  const renderOptions: RenderFollowButtonOptions = {
    isLoading   : isLoading,
    isError     : isError,
    errorMessage: errorMessage,
    isFollowed  : this.isFollowed,
    isFollowing : isFollowing,
    showAvatar  : showAvatar,
    user        : this.user,
    profile     : this.profile,
    customText  : customText,
  };

  this.shadowRoot!.innerHTML = `
    ${getFollowButtonStyles()}
    ${renderFollowButton(renderOptions)}
  `;

  // Accessibility + disabled handling
  const container = this.shadowRoot?.querySelector(
    '.nostr-follow-button-container'
  ) as HTMLElement | null;

  if (container) {
    container.setAttribute('role', 'button');
    container.setAttribute('aria-pressed', String(this.isFollowed));

    if (isDisabled) {
      container.setAttribute('aria-disabled', 'true');
      container.setAttribute('tabindex', '-1');
    } else {
      container.removeAttribute('aria-disabled');
      container.setAttribute('tabindex', '0');
    }
  }
}

 
}

customElements.define('nostr-follow-button', NostrFollowButton);
