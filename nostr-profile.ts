import NDK, { NDKKind, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './constants';
import { maskNPub } from './utils';
import dayjs from 'dayjs';

type Theme = 'light' | 'dark';

export default class NostrProfile extends HTMLElement {
  private rendered: boolean = false;

  private ndk: NDK = new NDK();

  private userProfile: NDKUserProfile = {
    name: '',
    image: '',
    nip05: '',
  };

  private theme: Theme = 'light';

  private isLoading: boolean = true;
  private isStatsLoading: boolean = true;

  private isStatsFollowsLoading: boolean = true;
  private isStatsFollowersLoading: boolean = true;
  private isStatsNotesLoading: boolean = true;
  private isStatsRepliesLoading: boolean = true;
  private isStatsZapsLoading: boolean = true;
  private isStatsRelaysLoading: boolean = true;

  private isError: boolean = false; 
  private isStatsError: boolean = false; 

  private stats = {
    follows: 0,
    followers: 0,
    notes: 0,
    replies: 0,
    zaps: 0,
    relays: 0,
  };

  private onClick: Function | null = null;

  private ndkUser: NDKUser;

  connectToNostr = async () => {
    await this.ndk.connect();
  }

  getRelays = () => {
    const userRelays = this.getAttribute('relays');

    if(userRelays) {
      return userRelays.split(',');
    }

    return DEFAULT_RELAYS;
  }

  getNDKUser = async () => {
    const npub = this.getAttribute('npub');
    const nip05 = this.getAttribute('nip05');
    const pubkey = this.getAttribute('pubkey');

    if(npub) {
      return this.ndk.getUser({
        npub: npub as string,
      });
    } else if(nip05) {
      return this.ndk.getUserFromNip05(nip05 as string);
    } else if(pubkey) {
      return this.ndk.getUser({
        pubkey: pubkey,
      });
    }

    return null;
  }

  getUserProfile = async () => {
    try {
      this.isLoading = true;

      this.render();

      const user = await this.getNDKUser();

      if(user?.npub) {
        this.ndkUser = user;

        await user.fetchProfile();

        this.userProfile = user.profile as NDKUserProfile;

        if(this.userProfile) {
          // const stats = await this.getProfileStats();
          this.getProfileStats()
          .then((stats) => {
            this.isStatsError = false;
            this.stats = stats;
          })
          .catch((err) => {
            console.log(err);
            this.isStatsError = true;
          })
          .finally(() => {
            this.isStatsLoading = false;
            this.render();
          });
        }

        if(!this.userProfile.image) {
          this.userProfile.image = './assets/default_dp.png'
        }
        this.isError = false;
      } else {
        throw new Error('Either npub or nip05 should be provided');
      }

    } catch(err) {
      this.isError = true;
      throw err;
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  getProfileStats = async (): Promise<any> => {
    try {
      this.isStatsFollowsLoading = true;
      this.isStatsFollowersLoading = true;
      this.isStatsNotesLoading = true;
      const userHex = this.ndkUser.pubkey as string;
 
      // Get follows
      this.ndkUser.follows()
        .then((follows) => {
          this.stats.follows = follows.size;
          this.isStatsFollowsLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching follows:', err);
        });
  
      // Get followers
      this.ndk.fetchEvents({
        kinds: [NDKKind.Contacts],
        '#p': [userHex || ''],
      })
        .then((followers) => {
          this.stats.followers = followers.size;
          this.isStatsFollowersLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching followers:', err);
        });

      // Get notes and replies
      this.ndk.fetchEvents({
        kinds: [NDKKind.Text],
        authors: [userHex],
      })
        .then((notes) => {
          let replies = 0;
          notes.forEach(note => {
            if(note.hasTag('e')) {
              replies += 1;
            }
          });
          this.stats.replies = replies;
          this.stats.notes = notes.size - replies;
          this.isStatsNotesLoading = false;
          this.render();
        })
        .catch((err) => {
          console.log('Error fetching notes:', err);
        });

      // Zaps (placeholder for now)
      this.stats.zaps = 0;
      this.render();

      // Relays (placeholder for now)
      this.stats.relays = 0;
      this.render();

      return this.stats;

    } catch(err) {
      console.log('getProfileStats', err);
      throw new Error('Error fetching stats');
    }
  }

  getTheme = async () => {
    this.theme = 'light';

    const userTheme = this.getAttribute('theme');

    if(userTheme) {
      const isValidTheme = ['light', 'dark'].includes(userTheme);

      if(!isValidTheme) {
        throw new Error(`Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`);
      }

      this.theme = userTheme as Theme;
    }
  }

  connectedCallback() {

    if(this.getAttribute("onClick") !== null) {
      this.onClick = window['onClick'];
    }

    if (!this.rendered) {
      this.ndk = new NDK({
        explicitRelayUrls: this.getRelays(),
      });

      this.getTheme();

      this.connectToNostr();

      this.getUserProfile();

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ['relays', 'pubkey', 'nip05', 'theme', 'show-npub', 'show-follow', 'onClick'];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if(name === 'relays') {
      this.ndk.explicitRelayUrls = this.getRelays();
      this.connectToNostr();
    }

    if(['relays', 'npub', 'nip05'].includes(name)) {
      // Possible property changes - relays, npub, nip05
      // For all these changes, we have to fetch profile anyways
      // TODO: Validate npub
      this.getUserProfile();
    }

    if(name === "onClick") {
      this.onClick = window[newValue];
    }

    if(name === 'theme') {
      this.getTheme();
      this.render();
    }

    if(['show-npub', 'show-follow'].includes(name)) {
      this.render();
    }
  }

  disconnectedCallback() {
    // TODO: Check for cleanup method
  }

  getStyles() {
    let variables = ``;

    if(this.theme === 'dark') {
      variables = `
      --nstrc-profile-background: var(--nstrc-profile-background-dark);
      --nstrc-profile-skeleton-min-hsl: var(--nstrc-profile-skeleton-min-hsl-dark);
      --nstrc-profile-skeleton-max-hsl: var(--nstrc-profile-skeleton-max-hsl-dark);
      --nstrc-profile-text-primary: var(--nstrc-profile-text-primary-dark);
      --nstrc-profile-text-grey: var(--nstrc-profile-text-grey-dark);
      --nstrc-profile-banner-placeholder-color: var(--nstrc-profile-banner-placeholder-color-dark);
      --nstrc-profile-copy-foreground-color: var(--nstrc-profile-copy-foreground-color-dark);
      `;
    } else {
      variables = `
      --nstrc-profile-background: var(--nstrc-profile-background-light);
      --nstrc-profile-skeleton-min-hsl: var(--nstrc-profile-skeleton-min-hsl-light);
      --nstrc-profile-skeleton-max-hsl: var(--nstrc-profile-skeleton-max-hsl-light);
      --nstrc-profile-text-primary: var(--nstrc-profile-text-primary-light);
      --nstrc-profile-text-grey: var(--nstrc-profile-text-grey-light);
      --nstrc-profile-banner-placeholder-color: var(--nstrc-profile-banner-placeholder-color-light);
      --nstrc-profile-copy-foreground-color: var(--nstrc-profile-copy-foreground-color-light);
      `;
    }


    return `
    <style>
    :root {
        --nstrc-profile-background-light: #f5f5f5;
        --nstrc-profile-background-dark: #000000;
        --nstrc-profile-skeleton-min-hsl-light: 200, 20%, 80%;
        --nstrc-profile-skeleton-min-hsl-dark: 200, 20%, 20%;
        --nstrc-profile-skeleton-max-hsl-light: 200, 20%, 95%;
        --nstrc-profile-skeleton-max-hsl-dark: 200, 20%, 30%;
        --nstrc-profile-text-primary-light: #111111;
        --nstrc-profile-text-primary-dark: #ffffff;
        --nstrc-profile-text-grey-light: #808080;
        --nstrc-profile-text-grey-dark: #666666;
        --nstrc-profile-banner-placeholder-color-light: #e5e5e5;
        --nstrc-profile-banner-placeholder-color-dark: #222222;
        --nstrc-profile-copy-foreground-color-light: #222;
        --nstrc-profile-copy-foreground-color-dark: #CCC;

        ${variables}

        --nstrc-profile-accent: #ca077c;

        --nstrc-follow-btn-padding: 5px 8px !important;
        --nstrc-follow-btn-font-size: 14px !important;
        --nstrc-follow-btn-border-radius: 12px !important;
        --nstrc-follow-btn-border-dark: 1px solid #DDDDDD !important;
        --nstrc-follow-btn-border-light: 1px solid #DDDDDD !important;
        --nstrc-follow-btn-horizontal-alignment: end !important;
      }

        .nostr-profile .skeleton {
            animation: profile-skeleton-loading 0.5s linear infinite alternate;
        }

        @keyframes profile-skeleton-loading {
            0% {
                background-color: hsl(var(--nstrc-profile-skeleton-min-hsl));
            }
            100% {
                background-color: hsl(var(--nstrc-profile-skeleton-max-hsl));
            }
        }

      .nostr-profile {
        -webkit-tap-highlight-color: transparent;
        text-size-adjust: 100%;
        font-weight: 400;
        font-size: 18px;
        line-height: 1.5;
        text-rendering: optimizeLegibility;
        overflow-wrap: break-word;
        font-family: Nacelle, sans-serif;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
        background-repeat: no-repeat;
        min-height: 500px;
        border: 1px solid #CCC;
        border-radius: 5px;
        background-color: var(--nstrc-profile-background);
        cursor: pointer;
      }

      #profile {
        position: relative;
        background-color: var(--nstrc-profile-background);
        padding-bottom: 4px;
      }

      #profile_banner {
        width: 100%;
        height: 214px;
        overflow: hidden;
      }

      #profile_banner a {
        outline: none;
        color: var(--nstrc-profile-accent);
      }

      #profile_banner a img {
        color: var(--nstrc-profile-accent);
        max-width: 100%;
        border-style: none;
        display: block;
        z-index: 22;
        width: 100%;
        height: 214px;
        object-fit: cover;
      }

      #profile_banner .banner-placeholder {
        width: 100%;
        height: 214px;
        background-color: var(--nstrc-profile-banner-placeholder-color);
      }

      .dp_container {
        position: absolute;
        top: 140px;
        left: 15px;
        overflow: hidden;
      }

      .avatar_container {
        border: solid 4px var(--nstrc-profile-background);
        border-radius: 50%;
        background-color: var(--nstrc-profile-background);
      }

      .avatar_wrapper {
        display: block;
        min-height: 142px;
      }

      .xxl_avatar {
        position: relative;
        background-color: var(--nstrc-profile-background);
        border-radius: 50%;
        width: 142px;
        height: 142px;
      }

      .backfill {
        background-color: var(--nstrc-profile-background);
        border-radius: 50%;
        width: 142px;
        height: 142px;
      }

      .backfill a {
        outline: none;
      }

      .backfill a img {
        max-width: 100%;
        border-style: none;
        display: block;
        z-index: 22;
        border-radius: 50%;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .profile_actions {
        height: 76px;
        display: flex;
        justify-content: end;
        align-items: center;
        padding: 0 18px;
      }

      .profile_data {
        display: block;
        margin-inline: 20px;
        min-height: 52px;
        margin-top: 14px;
      }

      .basic_info {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .name {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        max-width: 60%;
        height: 100%;
      }

      .name-text {
        color: var(--nstrc-profile-text-primary);
        font-size: 20px;
        line-height: 1;
        font-weight: 700;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        vertical-align: baseline;
      }

      .verification-check {
        width: 20px;
        height: 20px;
      }

      .verification-icon {
        width: 20px;
        height: 20px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-inline: 4px;
      }

      ._whiteCheckL_lfbpc_49 {
        width: 12px;
        height: 12px;
        top: 4px;
        left: 4px;
        border-radius: 50%;
        background-color: #fff;
        position: absolute;
      }

      ._verifiedIconPrimal_lfbpc_30 {
        width: 100%;
        height: 100%;
        background: var(--nstrc-profile-accent);
        mask: url(https://primal.net/assets/verified-84f47cd3.svg) no-repeat 0/100%;
      }

      .joined {
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;
        text-align: right;
        color: var(--nstrc-profile-text-grey);
      }

      .nip05-wrapper {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        color: var(--nstrc-profile-text-grey);
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;
        margin-top: 2px;
        margin-bottom: 16px;
      }

      .nip05-container {
        color: var(--nstrc-profile-text-grey);
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;
        display: flex;
        align-items: center;
      }

      .nip05 {
        color: var(--nstrc-profile-text-grey);
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;
        width: 100%;
        overflow: hidden;
      }

      .about {
        margin-inline: 20px;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--nstrc-profile-text-primary);
      }

      .links {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-inline: 20px;
        margin-block: 12px;
      }

      .website {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        display: flex;
        align-items: center;
      }

      .website a {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        outline: none;
        color: var(--nstrc-profile-accent);
        max-width: 350px;
        overflow: hidden;
        text-overflow: ellipsis;
        word-wrap: normal;
      }

      .stats {
        position: relative;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        padding-inline: 8px;
        border-radius: 0;
        padding-top: 22px;
        border-top: none;
        background-color: var(--nstrc-profile-background);
      }

      .stat {
        position: relative;
        display: inline-block;
        padding-inline: 14px;
        padding-block: 2px;
        border: none;
        background: none;
        width: fit-content;
        height: 40px;
        margin: 0 0 12px;
      }

      .stat-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .stat-inner .stat-value {
        font-weight: 400;
        font-size: 24px;
        line-height: 24px;
        color: var(--nstrc-profile-text-primary);
      }

      .stat-inner .stat-name {
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;
        color: var(--nstrc-profile-text-grey);
        text-transform: lowercase;
      }

      .error-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        min-height: 500px;
      }

      .error {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        background-color: red;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 20px;
        color: #FFF;
      }

      .error-text {
        color: red;
        font-weight: bold;
      }

      .npub-container {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
      }

      .npub-container .npub {
        color: #a2a2a2;
      }

      .npub.full {
        display: inline !important;
      }

      .npub.masked {
        display: none !important;
      }

      .copy-button {
        display: flex;
        font-size: 16px;
        min-width: 15px;
        min-height: 15px;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        color: var(--nstrc-profile-copy-foreground-color);
      }
        
      .nip05 {
        display: flex;
        gap: 5px;
      }

      @media only screen and (max-width: 600px) {
        button.stat .stat-value {
          font-size: 18px !important;
        }

        .npub.full {
          display: none !important;
        }

        .npub.masked {
          display: inline !important;
        }
      }

      @media only screen and (max-width: 600px) {
        :root {
          --nstrc-follow-btn-padding: 5px 8px !important;
          --nstrc-follow-btn-font-size: 12px !important;
          --nstrc-follow-btn-min-height: auto !important;
          --nstrc-follow-btn-border-radius: 8px !important;
          --nstrc-follow-btn-error-max-width: 150px !important;
        }
      }

    </style>
    `;
  }

  renderNpub() {
    const npubAttribute = this.getAttribute('npub');
    const showNpub = this.getAttribute('show-npub');

    if(showNpub === 'false') {
      return '';
    }

    if(showNpub === null && this.userProfile.nip05) {
      return '';
    }

    if (this.ndkUser == null) {
      return '';
    }

    if(!npubAttribute && !this.ndkUser.npub) {
      console.warn('Cannot use showNpub without providing a nPub');
      return '';
    }

    let npub = npubAttribute;

    if(!npub && this.ndkUser && this.ndkUser.npub) {
      npub = this.ndkUser.npub;
    }

    if(!npub) {
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

    if(this.isError) {
        return;
    }

    if(this.onClick !== null && typeof this.onClick === 'function')  {
      this.onClick(this.userProfile);
      return;
    }

    let key = '';

    const nip05 = this.getAttribute('nip05');
    const npub = this.getAttribute('npub');

    if(nip05) {
      key = nip05
    } else if(npub) {
      key = npub;
    } else {
      return;
    }

    window.open(`https://njump.me/${key}`, '_blank');
  }

  attachEventListeners() {
    this.querySelector('.nostr-profile')?.addEventListener('click', (e) => {
      if(!(e.target as HTMLElement).closest('.nostr-follow-button-container')) {
        this.onProfileClick()
      }
    });

    this.querySelector('#npub-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.getAttribute('npub') || this.ndkUser.npub || '')
    });

    this.querySelector('#nip05-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.getAttribute('nip05') || this.userProfile.nip05 || '')
    });
  }

  render() {
    this.innerHTML = this.getStyles();

    if(this.userProfile === undefined || this.userProfile.image === undefined || (this.userProfile.displayName === undefined && this.userProfile.name === undefined)) {
      this.isError = true;
    }

    let date = '';
    if(this.userProfile && this.userProfile.created_at) {
        date = dayjs(this.userProfile.created_at * 1000).format('MMM D, YYYY');
    }

    const showFollow = this.getAttribute('show-follow') === "true";

    if(!this.isLoading && this.isError) {
        this.innerHTML += 
            `<div class="nostr-profile">
                <div class='error-container'>
                    <div class="error">&#9888;</div>
                    <span class="error-text">
                      Unable to load profile
                      <br/>
                      <small style="font-weight: normal">Please check console for more information</small>
                      </span>
                    </div>
            </div>
        `;
    } else {
        this.innerHTML += `
            <div class="nostr-profile">
                <div id="profile">
                    <div id="profile_banner">
                    ${
                        this.isLoading
                        ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
                        : this.userProfile.banner
                        ? `
                                <a
                                    target="_blank"
                                    data-cropped="true"
                                    class="profile_image"
                                    href="#"
                                    data-pswp-width="991"
                                    data-pswp-height="330.3333333333333"
                                    >
                                        <img
                                        id="4075d846142df0a70fde5fd340e774697c4a7b4f2fce3635b02e061afcd16139"
                                        src="${this.userProfile.banner}"
                                        width="524px"/>
                                    </a>
                            `
                        : '<div class="banner-placeholder"></div>'
                    }
                    </div>
                    <div class="dp_container">
                    <div class="avatar_container">
                        <div class="avatar_wrapper">
                        <div class="xxl_avatar">
                            <div class="backfill">
                            ${
                                this.isLoading
                                ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
                                : `
                                    <a
                                        target="_blank"
                                        data-cropped="true"
                                        class="profile_image roundedImage"
                                        href="#"
                                        data-pswp-width="991"
                                        data-pswp-height="989.6777851901267"
                                        ><img
                                        id="70f547f7e6e31ae6952f41d75d50a4ac13b9290d5d8e9e9eb89801501de242fd"
                                        src="${this.userProfile.image}"
                                        width="524px"
                                    /></a>
                                `
                            }
                            </div>
                        </div>
                        </div>
                    </div>
                    </div>
                    <div class="profile_actions">
                      ${
                        this.ndkUser && this.ndkUser.npub && showFollow
                        ? `
                          <nostr-follow-button
                            npub="${this.ndkUser.npub}"
                            theme="${this.theme}"
                          ></nostr-follow-button>
                        `: ''
                      }
                    </div>
                    <div class="profile_data">
                    <div class="basic_info">
                        <div class="name">
                        ${
                            this.isLoading
                            ? '<div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>'
                            : `
                                <div class="name-text">${this.userProfile.displayName || this.userProfile.name}</div>
                            `
                        }
                        </div>
                    </div>
                    <div class="nip05-wrapper">
                        <div class="nip05-container">
                        ${
                            this.isLoading
                            ? '<div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>'
                            :
                              this.userProfile.nip05
                              ? `<div class="nip05">
                                  <span>${this.userProfile.nip05}</span>
                                  <span id="nip05-copy" class="copy-button">&#x2398;</span>
                                </div>`
                              : ''
                        }
                        </div>

                        ${this.renderNpub()}
                    </div>
                    </div>
                    
                    <div class="about">
                        ${
                            this.isLoading
                            ? `
                                <div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
                                <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>
                            `
                            : this.userProfile.about || ''
                        }
                    </div>
                    <div class="links">
                    ${
                        this.isLoading
                        ? '<div style="width: 150px; height: 12px; border-radius: 20px" class="skeleton"></div>'
                        : this.userProfile.website
                            ? `
                                <div class="website">
                                    <a target="_blank" href="${this.userProfile.website}"
                                    >${this.userProfile.website}</a
                                    >
                                </div>
                            `
                            : ''
                    }
                    </div>
                </div>
                <div class="stats" data-orientation="horizontal">
                    ${
                      this.isStatsError
                      ? `<p class="error-text">Error loading stats</p>`
                      : `
                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsNotesLoading
                                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.notes
                                    }
                                </div>
                                <div class="stat-name">Notes</div>
                            </div>
                        </button>
                        
                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsNotesLoading
                                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.replies
                                    }
                                </div>
                                <div class="stat-name">Replies</div>
                            </div></button>
                        
                        <!-- TODO: Add zaps after resolving the doubts
                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsLoading
                                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.zaps
                                    }
                                </div>
                                <div class="stat-name">Zaps</div>
                            </div>
                        </button>
                        -->
                        
                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsFollowsLoading
                                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.follows
                                    }
                                </div>
                                <div class="stat-name">Following</div>
                            </div>
                        </button>

                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsFollowersLoading
                                        ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.followers
                                    }
                                </div>
                                <div class="stat-name">Followers</div>
                            </div>
                        </button>
                        
                        <!--
                        <button class="stat" data-orientation="horizontal">
                            <div class="stat-inner">
                                <div class="stat-value">
                                    ${
                                        this.isStatsRelaysLoading
                                        ? '<div style="width: 20px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                                        : this.stats.relays
                                    }
                                </div>
                                <div class="stat-name">Relays</div>
                            </div>
                        </button>
                        -->
                      `
                    }
                </div>
            </div>
        `;
    }

    this.attachEventListeners();

  }
}

customElements.define("nostr-profile", NostrProfile);
