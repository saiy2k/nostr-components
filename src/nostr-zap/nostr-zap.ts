import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { injectCSS, init as openZapModal } from './dialog';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { nip19 } from 'nostr-tools';

/**
 * <nostr-zap>
 * Attributes:
 *   - npub | pubkey  (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - button-text     (optional) : custom text (default "⚡️")
 *   - button-color    (optional) : background color for button
 *   - amount          (optional) : sats (default 1000)
 */
export default class NostrZap extends HTMLElement {
  private rendered = false;

  private theme: Theme = 'light';

  private isLoading = false;
  private isError = false;
  private isSuccess = false;
  private errorMessage = '';

  private boundHandleClick: (() => void) | null = null;
  private static cssInjected = false;
  private cachedAmountDialog: any = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  private getRelays(): string[] {
    const relaysAttr = this.getAttribute('relays');
    if (relaysAttr) return relaysAttr.split(',');
    return DEFAULT_RELAYS;
  }

  private getTheme() {
    this.theme = 'light';
    const th = this.getAttribute('theme');
    if (th) {
      if (!['light', 'dark'].includes(th)) {
        console.warn(`Invalid theme '${th}', defaulting to light`);
      } else {
        this.theme = th as Theme;
      }
    }
  }

  connectedCallback() {
    if (!this.rendered) {
      this.getTheme();
      if (!NostrZap.cssInjected) {
        injectCSS();
        NostrZap.cssInjected = true;
      }
      this.render();
      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ['relays', 'npub', 'pubkey', 'theme', 'button-text', 'button-color', 'amount'];
  }

  attributeChangedCallback(name: string, _oldVal: string | null, _newVal: string | null) {
    if (name === 'theme') this.getTheme();
    this.render();
  }

  disconnectedCallback() {
    const btn = this.shadowRoot?.querySelector('.nostr-zap-button');
    if (btn && this.boundHandleClick) {
      btn.removeEventListener('click', this.boundHandleClick);
    }
    if (this.cachedAmountDialog && (this.cachedAmountDialog as any).close) {
      (this.cachedAmountDialog as any).close();
    }
  }

  private async handleZapClick() {
    const relays = this.getRelays().join(',');
    let npub = this.getAttribute('npub');
    const pubkey = this.getAttribute('pubkey');
    if (!npub && pubkey) npub = nip19.npubEncode(pubkey);
    if (!npub) {
      this.isError = true;
      this.errorMessage = 'Provide npub or pubkey attribute';
      this.render();
      return;
    }
    try {
      this.cachedAmountDialog = await openZapModal({
        npub,
        relays,
        cachedAmountDialog: this.cachedAmountDialog,
        buttonColor: this.getAttribute('button-color') || undefined,
        anon: false,
        initialAmount: (() => {
          const amtAttr = this.getAttribute('amount');
          if (!amtAttr) return undefined;
          const num = Number(amtAttr);
          return isNaN(num) || num <= 0 ? undefined : num;
        })(),
      });
    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e?.message || 'Unable to zap';
      this.render();
    }
  }

  private attachEventListeners() {
    const btn = this.shadowRoot!.querySelector('.nostr-zap-button');
    if (!btn) return;
    if (this.boundHandleClick) {
      btn.removeEventListener('click', this.boundHandleClick);
    }
    this.boundHandleClick = this.handleZapClick.bind(this);
    btn.addEventListener('click', this.boundHandleClick);
  }

  private render() {
    const buttonTextAttr = this.getAttribute('button-text');
    const buttonColorAttr = this.getAttribute('button-color');
    const iconWidthAttr = this.getAttribute('icon-width');
    const iconHeightAttr = this.getAttribute('icon-height');

    const options: RenderZapButtonOptions = {
      theme: this.theme,
      isLoading: this.isLoading,
      isError: this.isError,
      isSuccess: this.isSuccess,
      errorMessage: this.errorMessage,
      buttonText: buttonTextAttr || '⚡️',
      buttonColor: buttonColorAttr,
      iconWidth: iconWidthAttr ? Number(iconWidthAttr) : 25,
      iconHeight: iconHeightAttr ? Number(iconHeightAttr) : 25,
    };

    this.shadowRoot!.innerHTML = renderZapButton(options);
    this.attachEventListeners();
  }
}

customElements.define('nostr-zap', NostrZap);
