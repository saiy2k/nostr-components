import NDK, { NDKNip07Signer, NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "../common/constants";
import { getLoadingNostrich, getNostrLogo, getSuccessAnimation, getFollowButtonStyles } from "../common/theme";
import { Theme } from "../common/types";

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

      } finally {
        this.isLoading = false;
      }

      this.render();
    });
  }

  render() {
    const iconWidthAttribute = this.getAttribute('icon-width');
    const iconHeightAttribute = this.getAttribute('icon-height');

    const iconWidth = iconWidthAttribute !== null ? Number(iconWidthAttribute): 25;
    const iconHeight = iconHeightAttribute !== null ? Number(iconHeightAttribute): 25;

    const buttonText = this.isFollowed ? 'Followed' : 'Follow';

    this.innerHTML = getFollowButtonStyles(this.theme, this.isLoading);
 
    this.innerHTML += `
      <div class="nostr-follow-button-container ${this.isError ? 'nostr-follow-button-error': ''}">
        <div class="nostr-follow-button-wrapper">
          <button class="nostr-follow-button">
            ${
              this.isLoading
              ? `${getLoadingNostrich(this.theme, iconWidth, iconHeight)} <span>Following...</span>`
              : this.isFollowed
                ? `${getSuccessAnimation(this.theme, iconWidth, iconHeight)} ${buttonText}`
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