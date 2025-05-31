import { NDKUser, NDKNip07Signer, NDKZapper } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderFollowButton, RenderFollowButtonOptions } from './render';
import { NostrService } from '../common/nostr-service';

export default class NostrZapButton extends HTMLElement {
  private nostrService: NostrService = NostrService.getInstance();
  private boundHandleClick: (() => void) | null = null;

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


  async connectedCallback() {
    await this.nostrService.connectToNostr(this.getRelays());
 
    this.render();
  }


  private async handleZapClick() {

    const nip07signer = new NDKNip07Signer();
    var ndk = this.nostrService.getNDK();
    ndk.signer = nip07signer;

    var lnurl = "dergigi@npub.cash";
    let userToFollow: NDKUser | null = null;
    console.log(`zapping to ${lnurl}`);

    const userFromNip05 = await ndk.getUserFromNip05(lnurl);

    if (userFromNip05) {
      userToFollow = ndk.getUser({
        npub: userFromNip05.npub,
      });
      // await userToFollow.fetch();
    }

    const lnPay = async ({ pr }) => {
      // debugger;
      console.log("please pay to complete the zap", pr);
      return {
        preimage: "00".repeat(32), // Mock preimage
      };
    };

    if (userToFollow != null) {
      const signedUser = await nip07signer.user();
      debugger;
      const zapper = new NDKZapper(userToFollow, 1000, "msat", { lnPay });
      const zapResponse = await zapper.zap();

    }
  }

  attachEventListeners() {
    const button = this.shadowRoot!.querySelector('.nostr-zap-button');
    if (!button) return;

    // Remove any existing listener
    if (this.boundHandleClick) {
      button.removeEventListener('click', this.boundHandleClick);
    }

    // Create and store a new bound handler
    this.boundHandleClick = this.handleZapClick.bind(this);
    button.addEventListener('click', this.boundHandleClick);
  }

  disconnectedCallback() {
    const button = this.shadowRoot?.querySelector('.nostr-zap-button');
    if (button && this.boundHandleClick) {
      button.removeEventListener('click', this.boundHandleClick);
      this.boundHandleClick = null;
    }
  }

  render() {
    this.shadowRoot!.innerHTML = `
        <button class="nostr-zap-button">
          Zap
        </button>
    `;
    this.attachEventListeners();
  }
}

customElements.define('nostr-zap-button', NostrZapButton);
