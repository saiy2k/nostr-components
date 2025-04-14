import NDK, { NDKNip07Signer, NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "./constants";
import { getLoadingNostrich, getNostrLogo, getSuccessAnimation } from "./utils";
import { Theme } from "./types";

export default class NostrFollowButton extends HTMLElement {
  private rendered: boolean = false;
  private ndk: NDK = new NDK();

  private theme: Theme = "light";

  private isLoading: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = '';

  private isFollowed: boolean = false;

  connectToNostr = async () => {
    await this.ndk.connect();
  };

  getRelays = () => {
    const userRelays = this.getAttribute("relays");

    if (userRelays) {
      return userRelays.split(",");
    }

    return DEFAULT_RELAYS;
  };

  getTheme = async () => {
    this.theme = "light";

    const userTheme = this.getAttribute("theme");

    if (userTheme) {
      const isValidTheme = ["light", "dark"].includes(userTheme);

      if (!isValidTheme) {
        throw new Error(
          `Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`
        );
      }

      this.theme = userTheme as Theme;
    }
  };

  connectedCallback() {
    if (!this.rendered) {
      this.ndk = new NDK({
        explicitRelayUrls: this.getRelays(),
      });

      this.getTheme();

      this.connectToNostr();

      this.render();

      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ["relays", "npub", "theme"];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === "relays") {
      this.ndk.explicitRelayUrls = this.getRelays();
      this.connectToNostr();
    }

    if (name === "theme") {
      this.getTheme();
    }
  
    this.render();
  }

  attachEventListeners() {
    this.querySelector('.nostr-follow-button')?.addEventListener('click', async () => {
      this.isError = false;
      
      if(typeof window=== 'undefined'  ||!(window as any).nostr) {
        this.isLoading=false;
        this.isError = true;
        this.errorMessage = `
        Are you new to nostr?
        <ul>
        <li>Signup with nostr at <a href="https://nstart.me/" target="_blank">https://nstart.me/</a></li>
          <li>Install nip-07 extension at [Chrome, Firefox]</li>
          </ul>
          `;
          this.render();
          return;
      }
      if((window as any).nostr=== null){
        this.isLoading=false;
        this.isError = true;
        this.errorMessage = `
        It seems like you don't have the nip-07 extension installed.
        Please follow the instructions above to get started.
        `;
        this.render();
        return;
      }

      const nip07signer = new NDKNip07Signer();

      this.isLoading = true;
      this.render();
      
      try {
        this.ndk.signer = nip07signer;
        await this.connectToNostr();

        const userToFollowNpub = this.getAttribute('npub');
        const userToFollowNip05 = this.getAttribute('nip05');
        const userToFollowPubkey = this.getAttribute('pubkey');

        if(!userToFollowNpub && !userToFollowNip05 && !userToFollowPubkey) {
          this.errorMessage = 'Provide npub, nip05 or pubkey';
          this.isError = true;
        } else {
          let userToFollow: NDKUser | null = null;
  
          if(userToFollowPubkey) {
            userToFollow = this.ndk.getUser({
              pubkey: userToFollowPubkey,
            });
          } else if(userToFollowNpub) {
            userToFollow = this.ndk.getUser({
              npub: userToFollowNpub,
            });
          } else if(userToFollowNip05) {
            const userFromNip05 = await this.ndk.getUserFromNip05(userToFollowNip05)
  
            if(userFromNip05) {
              userToFollow = this.ndk.getUser({
                npub: userFromNip05.npub,
              });
            }
          }
  
          if(userToFollow != null) {
            const signedUser = await this.ndk.signer.user();
            await signedUser.follow(userToFollow)
  
            this.isFollowed = true;
          }
        }


      } catch(err) {
        this.isError = true;

        if(err.message && err.message.includes('NIP-07')) {
          this.errorMessage = `Looks like you don't have any nostr signing browser extension.
                                Please checkout the following video to setup a signer extension - <a href="https://youtu.be/8thRYn14nB0?t=310" target="_blank">Video</a>`;
        } else {
          this.errorMessage = 'Please authorize, click the button to try again!';
        }

        if( typeof(window as any).nostr === 'undefined') {
          alert("Are you new to nostr?\n1.signup with nostr at https://nstart.me/\n2. Install nip-07 extension at [Chrome, Firefox]"); 
          return;
}

      } finally {
        this.isLoading = false;
      }

      this.render();
    });
  }

  getStyles() {
    let variables = ``;

    if (this.theme === "dark") {
      variables = `
          --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-dark);
          --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-dark);
    
          --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-dark);
          --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-dark);
      `;
    } else {
      variables = `
          --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-light);
          --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-light);
    
          --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-light);
          --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-light);
      `;
    }

    return `
        <style>
          :root {
            ${variables}

            --nstrc-follow-btn-padding: 10px 16px;
            --nstrc-follow-btn-font-size: 16px;
            --nstrc-follow-btn-background-dark: #000000;
            --nstrc-follow-btn-background-light: #FFFFFF;
            --nstrc-follow-btn-hover-background-dark: #222222;
            --nstrc-follow-btn-hover-background-light: #F9F9F9;
            --nstrc-follow-btn-border-dark: none;
            --nstrc-follow-btn-border-light: 1px solid #DDDDDD;
            --nstrc-follow-btn-text-color-dark: #FFFFFF;
            --nstrc-follow-btn-text-color-light: #000000;
            --nstrc-follow-btn-border-radius: 8px;
            --nstrc-follow-btn-error-font-size: 12px;
            --nstrc-follow-btn-error-line-height: 1em;
            --nstrc-follow-btn-error-max-width: 250px;
            --nstrc-follow-btn-horizontal-alignment: start;
            --nstrc-follow-btn-min-height: 47px;
          }

          .nostr-follow-button-container {
            display: flex;
            flex-direction: column;
            font-family: Inter,sans-serif;
            flex-direction: column;
            gap: 8px;
            width: fit-content;
          }

          .nostr-follow-button-wrapper {
            display: flex;
            justify-content: var(--nstrc-follow-btn-horizontal-alignment);
          }
    
          .nostr-follow-button {
            display: flex;
            align-items: center;
            gap: 12px;
            border-radius: var(--nstrc-follow-btn-border-radius);
            background-color: var(--nstrc-follow-btn-background);
            cursor: pointer;

            min-height: var(--nstrc-follow-btn-min-height);

            border: var(--nstrc-follow-btn-border);

            padding: var(--nstrc-follow-btn-padding);
            font-size: var(--nstrc-follow-btn-font-size);
            color: var(--nstrc-follow-btn-text-color);

            ${
              this.isLoading
              ? 'pointer-events: none; user-select: none; background-color: var(--nstrc-follow-btn-hover-background);'
              : ''
            }
          }

          .nostr-follow-button:hover {
            background-color: var(--nstrc-follow-btn-hover-background);
          }

          .nostr-follow-button-error small {
            justify-content: flex-end;
            color: red;
            font-size: var(--nstrc-follow-btn-error-font-size);
            line-height: var(--nstrc-follow-btn-error-line-height);
            max-width: var(--nstrc-follow-btn-error-max-width);
          }
        </style>
    `;
  }

  render() {
    const iconWidthAttribute = this.getAttribute('icon-width');
    const iconHeightAttribute = this.getAttribute('icon-height');

    const iconWidth = iconWidthAttribute !== null ? Number(iconWidthAttribute): 25;
    const iconHeight = iconHeightAttribute !== null ? Number(iconHeightAttribute): 25;

    this.innerHTML = this.getStyles();

    this.innerHTML += `
      <div class="nostr-follow-button-container ${this.isError ? 'nostr-follow-button-error': ''}">
        <div class="nostr-follow-button-wrapper">
          <button class="nostr-follow-button">
            ${
              this.isLoading
              ? `${getLoadingNostrich(this.theme, iconWidth, iconHeight)} <span>Following...</span>`
              : this.isFollowed
                ? `${getSuccessAnimation(this.theme, iconWidth, iconHeight)} Followed!`
                : `${getNostrLogo(this.theme, iconWidth, iconHeight)} <span>Follow me on Nostr</span>`
            }
          </button>
        </div>

        ${
          this.isError
          ? `<small>${this.errorMessage}</small>`
          : ''
        }
      </div>
    `;

    this.attachEventListeners();
  }
}

customElements.define("nostr-follow-button", NostrFollowButton);