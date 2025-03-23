import NDK, { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './constants';
import { maskNPub } from './utils';

type Theme = 'light' | 'dark';

export default class NostrProfileBadge extends HTMLElement {
  private rendered: boolean = false;

  private ndk: NDK = new NDK();

  private userProfile: NDKUserProfile = {
    name: '',
    image: '',
    nip05: '',
  };

  private theme: Theme = 'light';

  private isLoading: boolean = true;
  private isError: boolean = false;

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

    const onClick = this.getAttribute("onClick");
    if(onClick !== null) {
      this.onClick = window[onClick];
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
    return ['relays', 'npub', 'pubkey', 'nip05', 'theme', 'show-npub', 'show-follow', 'onClick'];
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
      --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-dark);
      --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-dark);
      --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-dark);
      --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-dark);
      --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-dark);
      --nstrc-profile-badge-copy-foreground-color: var(--nstrc-profile-badge-copy-foreground-color-dark);
      `;
    } else {
      variables = `
      --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-light);
      --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-light);
      --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-light);
      --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-light);
      --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-light);
      --nstrc-profile-badge-copy-foreground-color: var(--nstrc-profile-badge-copy-foreground-color-light);
      `;
    }


    return `
    <style>
      :root {

        --nstrc-profile-badge-background-light: #f5f5f5;
        --nstrc-profile-badge-background-dark: #121212;
        --nstrc-profile-badge-name-color-light: #444;
        --nstrc-profile-badge-name-color-dark: #CCC;
        --nstrc-profile-badge-nip05-color-light: #808080;
        --nstrc-profile-badge-nip05-color-dark: #757575;
        --nstrc-profile-badge-skeleton-min-hsl-light: 200, 20%, 80%;
        --nstrc-profile-badge-skeleton-min-hsl-dark: 200, 20%, 20%;
        --nstrc-profile-badge-skeleton-max-hsl-light: 200, 20%, 95%;
        --nstrc-profile-badge-skeleton-max-hsl-dark: 200, 20%, 30%;
        --nstrc-profile-badge-copy-foreground-color-light: #222;
        --nstrc-profile-badge-copy-foreground-color-dark: #CCC;
        --nstrc-profile-badge-name-font-weight: 700;
        --nstrc-profile-badge-nip05-font-weight: 400;

        ${variables}

        --nstrc-follow-btn-padding: 4px 10px !important;
        --nstrc-follow-btn-font-size: 10px !important;
        --nstrc-follow-btn-border-radius: 8px !important;
        --nstrc-follow-btn-error-font-size: 8px !important;
        --nstrc-follow-btn-error-line-height: 1em !important;
        --nstrc-follow-btn-horizontal-alignment: start !important;
        --nstrc-follow-btn-min-height: auto !important;
      }

    .nostr-profile-badge-container {
      display: flex;
      align-items: center;
      border-radius: 100px;
      background-color: var(--nstrc-profile-badge-background);
      gap: 10px;
      font-size: 12px;
      min-height: 48px;
      padding: 8px 10px;
      font-family: Nacelle,sans-serif;
      cursor: pointer;
    }

    .nostr-profile-badge-container:has(.npub-container) {
      padding: 10px 12px;
    }

    .nostr-profile-badge-left-container {
      border-radius: 50%;
    }

    .nostr-profile-badge-left-container img {
      width: 35px;
      height: 35px;
      border-radius: 50%;
    }

    .nostr-profile-badge-container:has(.npub-container) .nostr-profile-badge-left-container img {
      width: 64px !important;
      height: 64px !important;
    }

    .nostr-profile-badge-right-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }

    .nostr-profile-badge-right-container .nostr-profile-badge-name {
      color: var(--nstrc-profile-badge-name-color);
      font-weight: var(--nstrc-profile-badge-name-font-weight);
    }

    .nostr-profile-badge-right-container .nostr-profile-badge-nip05 {
      color: var(--nstrc-profile-badge-nip05-color);
      font-weight: var(--nstrc-profile-badge-nip05-font-weight);
    }

    .skeleton {
      animation: profile-badge-skeleton-loading 0.5s linear infinite alternate;
    }

    @keyframes profile-badge-skeleton-loading {
      0% {
        background-color: hsl(var(--nstrc-profile-badge-skeleton-min-hsl));
      }
      100% {
        background-color: hsl(var(--nstrc-profile-badge-skeleton-max-hsl));
      }
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
      color: var(--nstrc-profile-badge-copy-foreground-color);
    }

    .npub-container, .nip05-container {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .npub-container .npub {
      color: #a2a2a2;
    }
    
    .npub-container .nostr-profile-badge-nip05 {
      word-break: break-all;
    }

    .name-container {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 3px 0; // To equalize flex height with other items
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

    if(!npubAttribute && !this.ndkUser.npub) {
      console.warn('Cannot use showNpub without providing a nPub');
      return '';
    }

    return `
      <div class="npub-container">
        <span class="npub">${maskNPub(npubAttribute || this.ndkUser.npub)}</span>
        <span id="npub-copy" class="copy-button">&#x2398;</span>
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
    this.querySelector('.nostr-profile-badge-container')?.addEventListener('click', () => this.onProfileClick());

    this.querySelector('#npub-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.getAttribute('npub') || '')
    });

    this.querySelector('#nip05-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copy(this.userProfile.nip05 || '')
    });
  }

  render() {
    this.innerHTML = this.getStyles();

    if(this.userProfile === undefined || this.userProfile.image === undefined || (this.userProfile.displayName === undefined && this.userProfile.name === undefined)) {
      this.isError = true;
    }

    const showFollow = this.getAttribute('show-follow') === "true";

    this.innerHTML += `
    <div class='nostr-profile-badge-container'>
      <div class='nostr-profile-badge-left-container'>
      ${
        this.isLoading
          ? '<div style="width: 35px; height: 35px; border-radius: 50%;" class="skeleton"></div>'
          : this.isError
            ? '<div class="error">&#9888;</div>'
            : `<img src='${this.userProfile.image}' alt='Nostr profile image of ${this.userProfile.displayName || this.userProfile.name}'/>`
      }
      </div>

      <div class='nostr-profile-badge-right-container'>
      ${
        this.isLoading
          ? `
          <div style="width: 70%; height: 10px; border-radius: 10px;" class="skeleton"></div>
          <div style="width: 80%; height: 8px; border-radius: 10px; margin-top: 5px;" class="skeleton"></div>
          `
            : this.isError
              ? `
                <div class='error-container'>
                  <span class="error-text">Unable to load</span>
                </div>
                <div>
                  <small class="error-text" style="font-weight: normal">Please check console for more information</small>
                </div>
              `
              : `
              <div class="name-container">
                <span class='nostr-profile-badge-name'>${this.userProfile.displayName || this.userProfile.name}</span>
                ${
                  showFollow
                  ? `
                    <nostr-follow-button
                      npub="${this.ndkUser.npub}"
                      icon-width="15"
                      icon-height="15"
                      theme="${this.theme}"
                    ></nostr-follow-button>
                  `: ''
                }
              </div>
              ${
                Boolean(this.userProfile.nip05)
                  ? `
                      <div class="nip05-container">
                        <span class='nostr-profile-badge-nip05'>${this.userProfile.nip05}</span>
                        <span id="nip05-copy" class="copy-button">&#x2398;</span>
                      </div>
                    `
                  : ''
              }

              ${this.renderNpub()}
              `
      }
      </div>
    </div>
    `;

    this.attachEventListeners();

  }
}

customElements.define("nostr-profile-badge", NostrProfileBadge);
