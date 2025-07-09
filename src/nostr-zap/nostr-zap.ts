import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { injectCSS, init as openZapModal } from './dialog';
import { renderZapButton, RenderZapButtonOptions } from './render';
import { nip19 } from 'nostr-tools';
import { resolveNip05 } from './zap-utils';

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
    return ['relays', 'npub', 'pubkey', 'nip05', 'theme', 'button-text', 'button-color', 'amount', 'default-amount'];
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
    // show loader and disable the button immediately
    this.isLoading = true;
    this.render();

    const relays = this.getRelays().join(',');
    let npub = this.getAttribute('npub');
    const pubkeyAttr = this.getAttribute('pubkey');
    const nip05Attr = this.getAttribute('nip05');

    try {
      if (!npub) {
        if (pubkeyAttr) {
          npub = nip19.npubEncode(pubkeyAttr);
        } else if (nip05Attr) {
          const resolvedPubkey = await resolveNip05(nip05Attr);
          npub = nip19.npubEncode(resolvedPubkey);
        }
      }

      if (!npub) throw new Error('Provide npub, nip05 or pubkey attribute');

      
      this.cachedAmountDialog = await openZapModal({
        npub,
        relays,
        buttonColor: this.getAttribute('button-color') || undefined,
        cachedAmountDialog: this.cachedAmountDialog,
        theme: this.theme,
        fixedAmount: (() => {
          const amtAttr = this.getAttribute('amount');
          if (!amtAttr) return undefined;
          const num = Number(amtAttr);
          return isNaN(num) || num <= 0 ? undefined : num;
        })(),
        defaultAmount: (() => {
          const defAttr = this.getAttribute('default-amount');
          if (!defAttr) return undefined;
          const num = Number(defAttr);
          return isNaN(num) || num <= 0 ? undefined : num;
        })(),
        anon: false,
      });
      this.isError = false;
      this.errorMessage = '';
    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e?.message || 'Unable to zap';
    } finally {
      this.isLoading = false;
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
      buttonText: buttonTextAttr || 'Zap',
      buttonColor: buttonColorAttr,
      iconWidth: iconWidthAttr ? Number(iconWidthAttr) : 25,
      iconHeight: iconHeightAttr ? Number(iconHeightAttr) : 25,
    };

    this.shadowRoot!.innerHTML = renderZapButton(options);
    this.attachEventListeners();
  }
}

customElements.define('nostr-zap', NostrZap);
