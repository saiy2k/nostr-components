import { NCStatus } from '../nostr-base-component';
import { NostrUserComponent } from '../nostr-user-component';
import { parseBooleanAttribute } from '../common/utils';
import { renderProfileBadge } from './render';
import { getProfileBadgeStyles } from './style';

const EVT_BADGE = 'nc:profile_badge';

/**
 * TODO: Improve Follow button placement
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

  async connectedCallback() {
    super.connectedCallback?.();
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
  private copyToClipboard(text: string) {
    // ignore promise – we don’t need to block UI
    navigator.clipboard.writeText(text).catch(() => {/* no-op */});
  }

  private onProfileClick() {
    if (this.status === NCStatus.Error) return;

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

  private attachEventListeners() {
    const root = this.shadowRoot;
    if (!root) return;

    const profileBadge = root.querySelector('.nostr-profile-badge-container');
    const npubCopy     = root.querySelector('#npub-copy');
    const nip05Copy    = root.querySelector('#nip05-copy');

    // Click on the badge (except follow-button area)
    profileBadge?.addEventListener('click', (e: Event) => {
      if (!(e.target as HTMLElement).closest('.nostr-follow-button-container')) {
        this.onProfileClick();
      }
    });

    // NPUB copy
    npubCopy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copyToClipboard(this.getAttribute('npub') || this.user?.npub || '');
    });

    // NIP-05 copy
    nip05Copy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copyToClipboard(this.getAttribute('nip05') || this.profile?.nip05 || '');
    });
  }

  render() {
    const root = this.shadowRoot;
    if (!root) return;

    const isLoading = this.status === NCStatus.Loading;
    const isError   = this.status === NCStatus.Error;

    // Update theme class on host element
    this.classList.toggle('dark', this.theme === 'dark');
    this.classList.toggle('loading', isLoading);
    this.classList.toggle('error-container', isError);

    // Get attribute values
    const showFollow    = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub      = parseBooleanAttribute(this.getAttribute('show-npub'));
    const npubAttribute = this.getAttribute('npub') || '';

    // Generate the HTML content
    const contentHTML = renderProfileBadge(
      isLoading,
      isError,
      this.profile,
      this.user,
      npubAttribute,
      showNpub,
      showFollow
    );

    // Combine styles and content for shadow DOM
    root.innerHTML = `
      ${getProfileBadgeStyles(this.theme)}
      <div class="nostr-profile-badge-wrapper">
        ${contentHTML}
      </div>
    `;

    this.attachEventListeners();
  }
}

customElements.define('nostr-profile-badge', NostrProfileBadge);
