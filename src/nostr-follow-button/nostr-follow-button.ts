// SPDX-License-Identifier: MIT

import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { getFollowButtonStyles } from './style';
import { ensureInitialized } from '../common/nostr-login-service';

export default class NostrFollowButton extends NostrUserComponent {
  protected followStatus = this.channel('follow');
  private isFollowed = false;

  static get observedAttributes() {
    return [...super.observedAttributes, 'show-avatar', 'text', 'disabled'];
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.addEventListener('click', this.onClick);
    this.render();
  }

  protected onStatusChange() {
    this.render();
  }

  protected onUserReady() {
    this.render();
  }

  /** Event delegation (required by BaseComponent design) */
  private attachDelegatedListeners() {
    // Mouse click
    this.delegateEvent(
      'click',
      '.nostr-follow-button-container',
      (e) => {
        if (this.hasAttribute('disabled')) return;
        e.preventDefault();
        e.stopPropagation();
        void this.handleFollowClick();
      }
    );

    // Keyboard support (Enter / Space)
    this.delegateEvent(
      'keydown',
      '.nostr-follow-button-container',
      (e: KeyboardEvent) => {
        if (this.hasAttribute('disabled')) return;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          void this.handleFollowClick();
        }
      }
    );
  }

  private async handleFollowClick() {
    if (this.hasAttribute('disabled')) return;
    if (this.computeOverall() !== NCStatus.Ready) return;

    const nip07signer = new NDKNip07Signer();
    this.followStatus.set(NCStatus.Loading);
    this.render();

    try {
      // Ensure NostrLogin is initialized
      await ensureInitialized();

      const signer = new NDKNip07Signer();
      const ndk = this.nostrService.getNDK();
      ndk.signer = signer;

      if (!this.user) {
        this.followStatus.set(
          NCStatus.Error,
          'Could not resolve user to follow.'
        );
        return;
      }

      const signedUser = await signer.user();
      if (signedUser) {
        await signedUser.follow(this.user);
      }

      this.isFollowed = true;
      this.followStatus.set(NCStatus.Ready);
    } catch (err) {
      const error = err as Error;
      this.followStatus.set(
        NCStatus.Error,
        error.message || 'Please authorize, click the button to try again!'
      );
    } finally {
      this.render();
    }
  }

  protected renderContent() {
    const isDisabled = this.hasAttribute('disabled');

    const renderOptions: RenderFollowButtonOptions = {
      isLoading: this.computeOverall() === NCStatus.Loading,
      isError: this.computeOverall() === NCStatus.Error,
      errorMessage: super.renderError(this.errorMessage),
      isFollowed: this.isFollowed,
      isFollowing: this.followStatus.get() === NCStatus.Loading,
      showAvatar: this.hasAttribute('show-avatar'),
      user: this.user,
      profile: this.profile,
      customText: this.getAttribute('text') || 'Follow me on nostr',
    };

    this.shadowRoot!.innerHTML = `
      ${getFollowButtonStyles()}
      ${renderFollowButton(renderOptions)}
    `;

    // Accessibility (profile-badge pattern)
    this.setAttribute('role', 'button');
    this.setAttribute('aria-pressed', String(this.isFollowed));

    if (isDisabled) {
      this.setAttribute('aria-disabled', 'true');
      this.removeAttribute('tabindex');
    } else {
      this.removeAttribute('aria-disabled');
      this.setAttribute('tabindex', '0');
    }
  }
}

if (!customElements.get('nostr-follow-button')) {
  customElements.define('nostr-follow-button', NostrFollowButton);
}
