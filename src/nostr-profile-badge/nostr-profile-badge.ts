import { parseBooleanAttribute } from '../common/utils';
import { renderProfileBadge } from './render';
import { getProfileBadgeStyles } from './style';
import { NostrUserComponent } from '../nostr-user-component';

/**
 * TODO: Improve Follow button placement
 */
export default class NostrProfileBadge extends NostrUserComponent {

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-npub',
      'show-follow',
    ];
  }

  async connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      this.connectToNostr();
      this.getUserProfileAndRender();
      this.rendered = true;
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  getUserProfileAndRender = async () => {
    try {
      this.isLoading = true;
      this.render();

      await this.resolveNDKUser();

      if (this.user) {

        await this.getProfile();

        if (this.profile == null) {
          throw new Error(`Could not fetch profile initially for user ${this.user.npub}`);
        } else {
          this.isError = false;
        }
      }
    } catch (err) {
      console.error("Error while rendering nostr-profile-badge", err);
      this.isError = true;
    } finally {
      this.isLoading = false;
      this.render();
    }
  };

  copy(string: string) {
    navigator.clipboard.writeText(string);
  }

  onProfileClick() {
    if (this.isError) return;

    const event = new CustomEvent('profileClick', {
      detail: this.profile,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    const notPrevented = this.dispatchEvent(event);

    if (notPrevented) {
      // Default behavior: open profile in new tab
      let key = this.profile?.nip05 || this.getAttribute('nip05') ||
                this.user?.npub || this.getAttribute('npub');
      if (key) {
        window.open(`https://njump.me/${key}`, '_blank');
      }
    }
  }

  attachEventListeners() {
    // Find elements within the shadow DOM
    const profileBadge = this.shadow?.querySelector(
      '.nostr-profile-badge-container'
    );
    const npubCopy = this.shadow?.querySelector('#npub-copy');
    const nip05Copy = this.shadow?.querySelector('#nip05-copy');

    // Add click handler for the profile badge
    profileBadge?.addEventListener('click', (e: Event) => {
      if (
        !(e.target as HTMLElement).closest('.nostr-follow-button-container')
      ) {
        this.onProfileClick();
      }
    });

    // Add click handler for NPUB copy button
    npubCopy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copy(this.getAttribute('npub') || this.user?.npub || '');
    });

    // Add click handler for NIP-05 copy button
    nip05Copy?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      this.copy(this.getAttribute('nip05') || this.profile?.nip05 || '');
    });
  }

  render() {

    // Update theme class on host element
    this.classList.toggle('dark', this.theme === 'dark');
    this.classList.toggle('loading', this.isLoading);
    this.classList.toggle('error-container', this.isError);

    // Get attribute values
    const showFollow = parseBooleanAttribute(this.getAttribute('show-follow'));
    const showNpub = parseBooleanAttribute(this.getAttribute('show-npub'));
    const npubAttribute = this.getAttribute('npub');

    // Generate the HTML content
    const contentHTML = renderProfileBadge(
      this.isLoading,
      this.isError,
      this.profile,
      this.user,
      npubAttribute,
      showNpub,
      showFollow
    );

    // Combine styles and content for shadow DOM
    this.shadow!.innerHTML = `
      ${getProfileBadgeStyles(this.theme)}
      <div class="nostr-profile-badge-wrapper">
        ${contentHTML}
      </div>
    `;

    this.attachEventListeners();
  }
}

customElements.define('nostr-profile-badge', NostrProfileBadge);
