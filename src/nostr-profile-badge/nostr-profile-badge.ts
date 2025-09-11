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
 * Note: Follow button placement could be improved in future versions
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

  // No cleanup needed: shadowRoot listeners die with the component.
  // Only global targets (window, document, timers) require removal.
  // disconnectedCallback() intentionally empty - no cleanup required

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
    if (this.computeOverall() !== NCStatus.Ready) return;

    const event = new CustomEvent(EVT_BADGE, {
      detail: this.profile,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open profile in new tab
      const key =
        this.profile?.nip05 ||
        this.getAttribute('nip05') ||
        this.user?.npub ||
        this.getAttribute('npub');

      if (key) {
        window.open(`https://njump.me/${key}`, '_blank');
      }
    }
  }

  private attachDelegatedListeners() {

    // Click anywhere on the profile badge (except follow button, copy buttons)
    this.delegateEvent('click', '.nostr-profile-badge-container', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nc-copy-btn, .nostr-follow-button-container')) {
        this.onProfileClick();
      }
    });

    // Copy is handled via attachCopyDelegation() using `.nc-copy-btn`
  }

  protected renderContent() {
    const isLoading     = this.computeOverall() === NCStatus.Loading;
    const isError       = this.computeOverall() === NCStatus.Error;

    // Get attribute values
    const showFollow    = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub      = parseBooleanAttribute(this.getAttribute('show-npub'));
    const errorMessage  = super.renderError(this.errorMessage);

    const renderOptions: RenderProfileBadgeOptions = {
      theme       : this.theme,
      isLoading   : isLoading,
      isError     : isError,
      errorMessage: errorMessage,
      userProfile : this.profile,
      ndkUser     : this.user,
      showNpub    : showNpub,
      showFollow  : showFollow
    };

    this.shadowRoot!.innerHTML = `
      ${getProfileBadgeStyles(this.theme)}
      ${renderProfileBadge(renderOptions)}
    `;
  }
}

customElements.define('nostr-profile-badge', NostrProfileBadge);
