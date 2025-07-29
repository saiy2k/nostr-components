import { parseRelays, parseTheme } from './common/utils';
import { Theme } from './common/types';
import { NostrService } from './common/nostr-service';

export class NostrBaseComponent extends HTMLElement {
  protected nostrService: NostrService = NostrService.getInstance();

  protected shadow: ShadowRoot | null = null;
  protected theme: Theme = 'light';
  protected isLoading: boolean = false;
  protected isError: boolean = false;
  protected rendered: boolean = false;
  protected errorMessage: string = '';

  constructor(shadow: boolean = true) {
    super();
    if (shadow) {
      this.shadow = this.attachShadow({ mode: 'open' });
    }
  }

  protected getRelays() {
    return parseRelays(this.getAttribute('relays'));
  }

  protected getTheme() {
    this.theme = parseTheme(this.getAttribute('theme'));
  }

  protected async connectToNostr() {
    return this.nostrService.connectToNostr(this.getRelays());
  }

  static get observedAttributes() {
    return ['theme', 'relays'];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null
  ) {
    if (name === 'relays') {
      this.connectToNostr().catch(error => {
        console.error('Failed to connect to Nostr relays:', error);
        this.isError = true;
        this.errorMessage = 'Failed to connect to relays';
      });
    }

    if (name === 'theme') {
      this.getTheme();
    }
  }

}
