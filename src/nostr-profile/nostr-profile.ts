// SPDX-License-Identifier: MIT

import { copyToClipboard } from '../common/utils';
import { NCStatus } from '../base/base-component/nostr-base-component';
import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { renderProfile, RenderProfileOptions } from './render';
import { getProfileStyles } from './style';

const EVT_PROFILE = 'nc:profile';

export default class NostrProfile extends NostrUserComponent {

  protected profileStatus = this.channel('profile');

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

  /** Base class functions */
  protected onStatusChange(_status: NCStatus) {
    // console.log("onStatusChange: ", _status);
    this.render();
  }

  protected onUserReady(_user: any, _profile: any) {
    this.getUserStats();
    this.render();
  }

  getUserStats = async () => {
    try {
      this.isStatsLoading = true;
      this.isStatsFollowsLoading = true;
      this.isStatsFollowersLoading = true;

      // Create a local copy of the current stats
      const currentStats = { ...this.stats };

      // Fetch follows
      this.nostrService
        .getProfileStats(this.user!, ['follows'])
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
        .getProfileStats(this.user!, ['followers'])
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
        .getProfileStats(this.user!, ['notes', 'replies', 'zaps'])
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

    } catch (err) {
      this.profileStatus.set(NCStatus.Error);
      throw err;
    } finally {
      this.render();
    }
  };

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    super.attributeChangedCallback?.(name, oldValue, newValue);

    if (name === 'show-npub' || name === 'show-follow') {
      this.render();
    }
  }
  /** Private functions */
  private onProfileClick() {
    if (this.profileStatus.get() === NCStatus.Error) return;

    const event = new CustomEvent(EVT_PROFILE, {
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
    this.delegateEvent('click', '.profile-banner', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nc-copy-btn, .nostr-follow-button-container')) {
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

  private render() {
    const isLoading     = this.computeOverall() == NCStatus.Loading;
    const isError       = this.computeOverall() === NCStatus.Error;
    const showNpub      = this.getAttribute('show-npub') !== 'false';
    const showFollow    = this.getAttribute('show-follow') !== 'false';

    const renderOptions: RenderProfileOptions = {
      theme: this.theme,
      isLoading: isLoading,
      isError: isError,
      errorMessage: this.errorMessage,
      npub: this.user?.npub || '',
      userProfile: this.profile!,
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
      showFollow: showFollow && this.user?.npub ? this.user.npub : '',
      showNpub: showNpub,
    };

    this.shadowRoot!.innerHTML = `
      ${getProfileStyles(this.theme)}
      ${renderProfile(renderOptions)}
    `;

  }
}

customElements.define('nostr-profile', NostrProfile);
