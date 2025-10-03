// SPDX-License-Identifier: MIT

import { NCStatus } from '../base/base-component/nostr-base-component';
import { NostrUserComponent } from '../base/user-component/nostr-user-component';
import { renderProfile, RenderProfileOptions } from './render';
import { getProfileStyles } from './style';
import { attachCopyDelegation } from '../base/copy-delegation';

const EVT_PROFILE = 'nc:profile';

export default class NostrProfile extends NostrUserComponent {

  protected profileStatus = this.channel('profile');

  // Stats loading states
  private isStatsLoading: boolean = true;
  private isStatsFollowsLoading: boolean = true;
  private isStatsFollowersLoading: boolean = true;
  private isZapsLoading: boolean = true;

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
    attachCopyDelegation({
      addDelegatedListener: this.addDelegatedListener.bind(this),
    });
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
      this.isZapsLoading = true;

      // Fetch follows
      this.nostrService
        .fetchFollows(this.user!)
        .then((follows) => {
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
        .fetchFollowers(this.user!)
        .then((followers) => {
          this.stats = { ...this.stats, followers };
          this.isStatsFollowersLoading = false;
          this.render();
        })
        .catch(err => {
          console.error('Error loading followers:', err);
          this.isStatsFollowersLoading = false;
          this.render();
        });

      // Fetch notes and replies
      this.nostrService
        .fetchNotesAndReplies(this.user!)
        .then(([ notes, replies ]) => {
          this.stats = { ...this.stats, notes, replies };
          this.isStatsLoading = false;
          this.render();
        })
        .catch(err => {
          console.error('Error loading notes and replies', err);
          this.isStatsLoading = false;
          this.render();
        });

      // Fetch zaps
      this.nostrService
        .fetchZaps(this.user!)
        .then((zaps) => {
          this.stats = { ...this.stats, zaps };
          this.isZapsLoading = false;
          this.render();
        })
        .catch(err => {
          console.error('Error loading Zaps:', err);
          this.isZapsLoading = false;
          this.render();
        });


    } catch (err) {
      this.profileStatus.set(NCStatus.Error);
      console.error('getUserStats failed:', err);
    } finally {
      this.render();
    }
  };

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
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

      if (key) window.open(`https://njump.me/${encodeURIComponent(key)}`, '_blank');
    }
  }

  private attachDelegatedListeners() {

    // Click anywhere on the profile badge (except follow button, copy buttons)
    this.delegateEvent('click', '.profile-banner', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nc-copy-btn, .nostr-follow-button-container, nostr-follow-button')) {
        this.onProfileClick();
      }
    });

  }

  protected renderContent() {
    const isLoading     = this.computeOverall() === NCStatus.Loading;
    const isError       = this.computeOverall() === NCStatus.Error;
    const showNpub      = this.getAttribute('show-npub') !== 'false';
    const showFollow    = this.getAttribute('show-follow') === 'true';

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
      isZapsLoading: this.isZapsLoading,
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
