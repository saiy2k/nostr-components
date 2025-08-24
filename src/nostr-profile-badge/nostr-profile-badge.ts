import { NCStatus } from '../base-component/nostr-base-component';
import { NostrUserComponent } from '../user-component/nostr-user-component';
import { parseBooleanAttribute, copyToClipboard } from '../common/utils';
import { renderProfileBadge, RenderProfileBadgeOptions } from './render';
import { getProfileBadgeStyles } from './style';

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
 * TODO: Improve Follow button placement
 */
export default class NostrProfileBadge extends NostrUserComponent {

  protected profileStatus = this.channel('profile-badge');

  /** Lifecycle methods */
  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-npub',
      'show-follow',
    ];
  }

  async connectedCallback() {
    super.connectedCallback?.();
    this.attachDelegatedListeners();
    this.render();
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
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

  protected onUserReady(_user: any, _profile: any) {
    this.render();
  }

  /** Private functions */
  private onProfileClick() {
    if (this.profileStatus.get() === NCStatus.Error) return;

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

      if (key) window.open(`https://njump.me/${key}`, '_blank');
    }
  }

  private attachDelegatedListeners() {

    // Click anywhere on the profile badge (except follow button, copy buttons)
    this.delegateEvent('click', '.nostr-profile-badge-container', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.copy-button, .nostr-follow-button-container')) {
        this.onProfileClick();
      }
    });

    // NPUB copy
    this.delegateEvent('click', '#npub-copy', (e: Event) => {
      e.stopPropagation();
      copyToClipboard(this.getAttribute('npub') || this.user?.npub || '');
    });

    // NIP-05 copy
    this.delegateEvent('click', '#nip05-copy', (e: Event) => {
      e.stopPropagation();
      copyToClipboard(this.getAttribute('nip05') || this.profile?.nip05 || '');
    });

  }

  render() {
    const isLoading     = this.computeOverall() == NCStatus.Loading;
    const isError       = this.computeOverall() === NCStatus.Error;

    // Get attribute values
    const showFollow    = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub      = parseBooleanAttribute(this.getAttribute('show-npub'));
    const npub          = this.getAttribute('npub') || '';
    const errorMessage  = super.renderError(this.errorMessage);

    const renderOptions: RenderProfileBadgeOptions = {
      theme       : this.theme,
      isLoading   : isLoading,
      isError     : isError,
      errorMessage: errorMessage,
      userProfile : this.profile,
      ndkUser     : this.user,
      npub        : npub,
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
