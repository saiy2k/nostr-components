// SPDX-License-Identifier: MIT

import { NCStatus } from '../base/base-component/nostr-base-component';
import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { parseBooleanAttribute } from '../common/utils';
import { renderProfileBadge, RenderProfileBadgeOptions } from './render';
import { getProfileBadgeStyles } from './style';
import { attachCopyDelegation } from '../base/copy-delegation';
import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';

const EVT_BADGE = 'nc:profile_badge';

/**
 * NostrProfileBadge
 * =================
 * UI component (extends `NostrUserComponent`) that renders a compact user badge
 * with avatar/name/nip05 and optional npub + follow button.
 *
 * Observed attributes
 * - `show-npub`   — boolean-like attribute to display the masked npub + copy
 * - `show-follow` — boolean-like attribute to display the follow button
 *
 * Events
 * - `nc:status`         — (from base) status changes for connection/user
 * - `nc:user`           — emitted when user & profile are ready (from parent)
 * - `nc:profile_badge`  — fired on badge click (detail: `NDKUserProfile | null`);
 *                         default action opens `https://njump.me/<nip05|npub>`
 *
 * Note: Follow button placement to be improved in future versions
 */
export default class NostrProfileBadge extends NostrUserComponent {

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-npub',
      'show-follow',
    ];
  }

  connectedCallback() {
    super.connectedCallback?.();
    
    this.attachDelegatedListeners();
    attachCopyDelegation({
      addDelegatedListener: this.addDelegatedListener.bind(this),
    });
    this.render();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);

    if (name === 'show-npub' || name === 'show-follow') {
      this.render();
    }
  }

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    this.render();
  }

  protected onUserReady(_user: NDKUser, _profile: NDKUserProfile | null) {
    this.render();
  }

  /** Private functions */
  private onProfileClick() {
    const key =
      this.user?.npub ||
      this.getAttribute('npub') ||
      this.profile?.nip05 ||
      this.getAttribute('nip05');

    if (key) {
      this.handleNjumpClick(EVT_BADGE, this.profile, encodeURIComponent(key));
    }
  }

  private attachDelegatedListeners() {

    // Click anywhere on the profile badge (except follow button, copy buttons)
    this.delegateEvent('click', '.nostr-profile-badge-container', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nc-copy-btn, .nostr-follow-button-container, nostr-follow-button')) {
        this.onProfileClick();
      }
    });

    // Copy is handled via attachCopyDelegation() using `.nc-copy-btn`
  }

  protected renderContent() {
    const overall       = this.computeOverall();
    const isLoading     = overall === NCStatus.Loading;
    const isError       = overall === NCStatus.Error;

    // Get attribute values
    const showFollow    = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub      = parseBooleanAttribute(this.getAttribute('show-npub'));
    const errorMessage  = isError ? super.renderError(this.errorMessage) : '';

    const renderOptions: RenderProfileBadgeOptions = {
      isLoading   : isLoading,
      isError     : isError,
      errorMessage: errorMessage,
      userProfile : this.profile,
      ndkUser     : this.user,
      showNpub    : showNpub,
      showFollow  : showFollow
    };

    this.shadowRoot!.innerHTML = `
      ${getProfileBadgeStyles()}
      ${renderProfileBadge(renderOptions)}
    `;
  }
}

if (!customElements.get('nostr-profile-badge')) {
  customElements.define('nostr-profile-badge', NostrProfileBadge);
}
