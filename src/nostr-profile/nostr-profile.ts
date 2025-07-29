import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { maskNPub } from '../common/utils';
import { NostrUserComponent } from '../nostr-user-component';
import { renderProfile, renderLoadingState, renderErrorState } from './render';

/**
 * 1. Do `CustomEvent for click handler. Refer profile-badge.
 */
export default class NostrProfile extends NostrUserComponent {

  // Stats loading states
  private isStatsLoading: boolean = true;
  private isStatsFollowsLoading: boolean = true;
  private isStatsFollowersLoading: boolean = true;

  private stats = {
    follows: 0,
    followers: 0,
    notes: 0,
    replies: 0,
    zaps: 0,
    relays: 0,
  };

  private onClick: ((profile: NDKUserProfile) => void) | null = null;

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'show-npub',
      'show-follow',
      'onClick',
    ];
  }

  async connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      this.connectToNostr();
      this.getUserProfile();
      this.rendered = true;
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  getUserProfile = async () => {
    try {
      this.isLoading = true;
      this.render();

      await this.resolveNDKUser();

      if (this.user) {

        await this.getProfile();

        if (this.profile != null) {

          // Fetch stats only if profile exists
          this.isStatsLoading = true;
          this.isStatsFollowsLoading = true;
          this.isStatsFollowersLoading = true;

          // Create a local copy of the current stats
          const currentStats = { ...this.stats };

          // Fetch follows
          this.nostrService
            .getProfileStats(this.user, ['follows'])
            .then(({ follows }) => {
              currentStats.follows = follows;
              this.stats = { ...this.stats, follows };
              this.isStatsFollowsLoading = false;
              this.render();
            })
            .catch(err => {
              console.error('Error loading follows:', err);
              this.isStatsFollowsLoading = false;
              this.render();
            });

          // Fetch followers
          this.nostrService
            .getProfileStats(this.user, ['followers'])
            .then(({ followers }) => {
              currentStats.followers = followers;
              this.stats = { ...this.stats, followers };
              this.isStatsFollowersLoading = false;
              this.render();
            })
            .catch(err => {
              console.error('Error loading followers:', err);
              this.isStatsFollowersLoading = false;
              this.render();
            });

          // Fetch other stats
          this.nostrService
            .getProfileStats(this.user, ['notes', 'replies', 'zaps'])
            .then(({ notes, replies, zaps }) => {
              currentStats.notes = notes;
              currentStats.replies = replies;
              currentStats.zaps = zaps;
              this.stats = { ...this.stats, notes, replies, zaps };
              this.isStatsLoading = false;
              this.render();
            })
            .catch(err => {
              console.error('Error loading other stats:', err);
              this.isStatsLoading = false;
              this.render();
            });

          this.isError = false;
        } else {
          // Profile not found or fetch failed, use default image and clear stats
          console.warn(`Could not fetch profile for user ${this.user.npub}`);
          this.stats = {
            follows: 0,
            followers: 0,
            notes: 0,
            replies: 0,
            zaps: 0,
            relays: 0,
          };
          this.isStatsLoading = false;
          this.isError = true;
        }
      }
    } catch (err) {
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  };


  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, _oldValue, newValue);

    if (['relays', 'npub', 'pubkey', 'nip05'].includes(name)) {
      // Possible property changes - relays, npub, nip05
      // For all these changes, we have to fetch profile anyways
      // TODO: Validate npub
      this.getUserProfile();
    }

    if (name === 'onClick' && newValue) {
      const potentialHandler = window[newValue as keyof Window];

      if (typeof potentialHandler === 'function') {
        this.onClick = potentialHandler as (profile: NDKUserProfile) => void;
      } else if (newValue.trim() !== '') {
        console.warn(`Handler '${newValue}' is not a valid function`);
        this.onClick = null;
      } else {
        this.onClick = null;
      }
    }

    if (name === 'theme') {
      this.render();
    }

    if (['show-npub', 'show-follow'].includes(name)) {
      this.render();
    }
  }

  renderNpub() {
    const npubAttribute = this.getAttribute('npub');
    const showNpub = this.getAttribute('show-npub');

    if (showNpub === 'false') {
      return '';
    }

    if (showNpub === null && this.profile.nip05) {
      return '';
    }

    if (this.user == null) {
      return '';
    }

    if (!npubAttribute && !this.user.npub) {
      console.warn('Cannot use showNpub without providing a nPub');
      return '';
    }

    let npub = npubAttribute;

    if (!npub && this.user && this.user.npub) {
      npub = this.user.npub;
    }

    if (!npub) {
      console.warn('Cannot use showNPub without providing a nPub');
      return '';
    }

    return `
      <div class="npub-container">
        ${
          this.isLoading
            ? '<div style="width: 100px; height: 8px; border-radius: 5px" class="skeleton"></div>'
            : `
                <span class="npub full">${npub}</span>
                <span class="npub masked">${maskNPub(npub)}</span>
                <span id="npub-copy" class="copy-button">&#x2398;</span>
            `
        }
      </div>
    `;
  }

  copy(string: string) {
    navigator.clipboard.writeText(string);
  }

  onProfileClick() {
    if (this.isError) {
      return;
    }

    if (this.onClick !== null && typeof this.onClick === 'function') {
      this.onClick(this.profile!);
      return;
    }

    let key = '';

    const nip05 = this.getAttribute('nip05');
    const npub = this.getAttribute('npub');

    if (nip05) {
      key = nip05;
    } else if (npub) {
      key = npub;
    } else {
      return;
    }

    window.open(`https://njump.me/${key}`, '_blank');
  }

  private handleClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const actionElement = target.closest('[data-nostr-action]');

    if (!actionElement) return;

    e.stopPropagation();
    const action = actionElement.getAttribute('data-nostr-action');

    switch (action) {
      case 'npub-click':
      case 'profile-click':
        this.onProfileClick();
        break;
      case 'copy-npub':
        this.copy(this.getAttribute('npub') || this.user?.npub || '');
        break;
      case 'copy-nip05':
        this.copy(this.profile!.nip05 || '');
        break;
    }
  };

  private attachEventListeners() {
    // Remove any existing event listeners to prevent duplicates
    this.shadowRoot?.removeEventListener('click', this.handleClick);
    // Add event delegation for all clicks
    this.shadowRoot?.addEventListener('click', this.handleClick);
  }

  private render() {
    if (!this.shadowRoot) return;

    const showNpub = this.getAttribute('show-npub') !== 'false';
    const showFollow = this.getAttribute('show-follow') !== 'false';

    if (this.isLoading) {
      this.shadowRoot.innerHTML = renderLoadingState(this.theme);
      return;
    }

    if (this.isError) {
      this.shadowRoot.innerHTML = renderErrorState(
        'Error fetching profile. Is the npub/nip05 correct?',
        this.theme
      );
      return;
    }

    const renderOptions = {
      npub: this.user?.npub || '',
      userProfile: this.profile!,
      theme: this.theme,
      isLoading: this.isLoading,
      isStatsLoading: this.isStatsLoading,
      isStatsFollowersLoading: this.isStatsFollowersLoading,
      isStatsFollowsLoading: this.isStatsFollowsLoading,
      stats: {
        notes: this.stats.notes,
        replies: this.stats.replies,
        follows: this.stats.follows,
        followers: this.stats.followers,
        zaps: this.stats.zaps,
        relays: this.stats.relays,
      },
      error: this.isError ? 'Error loading profile' : null,
      onNpubClick: this.onProfileClick.bind(this),
      onProfileClick: this.onProfileClick.bind(this),
      showFollow: showFollow && this.user?.npub ? this.user.npub : '',
      showNpub: showNpub,
    };

    this.shadowRoot!.innerHTML = renderProfile(renderOptions);
    this.attachEventListeners();
  }
}

customElements.define('nostr-profile', NostrProfile);
