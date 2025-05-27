import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { maskNPub } from '../common/utils';
import { Theme } from '../common/types';
import { renderProfile, renderLoadingState, renderErrorState } from './render';
import { NostrService } from '../common/nostr-service';

export default class NostrProfile extends HTMLElement {
  private rendered: boolean = false;
  private nostrService: NostrService = NostrService.getInstance();
  private userProfile: NDKUserProfile = {
    name: '',
    image: '',
    nip05: '',
  };

  private theme: Theme = 'light';

  private isLoading: boolean = true;

  // Stats loading states
  private isStatsLoading: boolean = true;
  private isStatsFollowsLoading: boolean = true;
  private isStatsFollowersLoading: boolean = true;

  private isError: boolean = false;

  private stats = {
    follows: 0,
    followers: 0,
    notes: 0,
    replies: 0,
    zaps: 0,
    relays: 0,
  };

  private onClick: ((profile: NDKUserProfile) => void) | null = null;

  private ndkUser: NDKUser | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getRelays = () => {
    const userRelays = this.getAttribute('relays');
    if (userRelays) {
      return userRelays.split(',');
    }
    return DEFAULT_RELAYS;
  };

  getNDKUser = async () => {
    const npub = this.getAttribute('npub');
    const nip05 = this.getAttribute('nip05');
    const pubkey = this.getAttribute('pubkey');

    if (npub) {
      return this.nostrService.getNDK().getUser({
        npub: npub as string,
      });
    } else if (nip05) {
      return this.nostrService.getNDK().getUserFromNip05(nip05 as string);
    } else if (pubkey) {
      return this.nostrService.getNDK().getUser({
        pubkey: pubkey,
      });
    }

    return null;
  };

  getUserProfile = async () => {
    try {
      this.isLoading = true;
      this.render();

      const user = await this.getNDKUser();

      if (user?.npub) {
        this.ndkUser = user;

        const profile = await this.nostrService.getProfile({
          npub: user.npub,
          nip05: this.getAttribute('nip05') || undefined,
          pubkey: this.getAttribute('pubkey') || undefined,
        });

        if (profile) {
          this.userProfile = profile;

          // Fetch stats only if profile exists
          this.isStatsLoading = true;
          this.isStatsFollowsLoading = true;
          this.isStatsFollowersLoading = true;

          // Create a local copy of the current stats
          const currentStats = { ...this.stats };

          // Fetch follows
          this.nostrService
            .getProfileStats(user, ['follows'])
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
            .getProfileStats(user, ['followers'])
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
            .getProfileStats(user, ['notes', 'replies', 'zaps'])
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

          // Set default image only if profile exists but image is missing
          if (!this.userProfile.image) {
            this.userProfile.image = './assets/default_dp.png';
          }
          this.isError = false;
        } else {
          // Profile not found or fetch failed, use default image and clear stats
          console.warn(`Could not fetch profile for user ${user.npub}`);
          this.userProfile.image = './assets/default_dp.png';
          this.userProfile.name = '';
          this.userProfile.nip05 = '';
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
      } else {
        throw new Error('Either npub or nip05 should be provided');
      }
    } catch (err) {
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  };

  getTheme = async () => {
    this.theme = 'light';

    const userTheme = this.getAttribute('theme');

    if (userTheme) {
      const isValidTheme = ['light', 'dark'].includes(userTheme);

      if (!isValidTheme) {
        throw new Error(
          `Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`
        );
      }

      this.theme = userTheme as Theme;
    }
  };

  async connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      await this.nostrService.connectToNostr(this.getRelays());
      this.getUserProfile();

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return [
      'relays',
      'pubkey',
      'nip05',
      'theme',
      'show-npub',
      'show-follow',
      'onClick',
    ];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'relays') {
      this.nostrService.connectToNostr(this.getRelays());
    }

    if (['relays', 'npub', 'nip05'].includes(name)) {
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
      this.getTheme();
      this.render();
    }

    if (['show-npub', 'show-follow'].includes(name)) {
      this.render();
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  getStyles() {
    return ``;
  }

  renderNpub() {
    const npubAttribute = this.getAttribute('npub');
    const showNpub = this.getAttribute('show-npub');

    if (showNpub === 'false') {
      return '';
    }

    if (showNpub === null && this.userProfile.nip05) {
      return '';
    }

    if (this.ndkUser == null) {
      return '';
    }

    if (!npubAttribute && !this.ndkUser.npub) {
      console.warn('Cannot use showNpub without providing a nPub');
      return '';
    }

    let npub = npubAttribute;

    if (!npub && this.ndkUser && this.ndkUser.npub) {
      npub = this.ndkUser.npub;
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
      this.onClick(this.userProfile);
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
        this.copy(this.getAttribute('npub') || this.ndkUser?.npub || '');
        break;
      case 'copy-nip05':
        this.copy(this.userProfile.nip05 || '');
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
      npub: this.ndkUser?.npub || '',
      userProfile: this.userProfile,
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
      showFollow: showFollow && this.ndkUser?.npub ? this.ndkUser.npub : '',
      showNpub: showNpub,
    };

    this.shadowRoot!.innerHTML = renderProfile(renderOptions);
    this.attachEventListeners();
  }
}

customElements.define('nostr-profile', NostrProfile);
