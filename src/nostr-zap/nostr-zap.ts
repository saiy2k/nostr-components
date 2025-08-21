import { DEFAULT_RELAYS } from "../common/constants";
import { Theme } from "../common/types";
import { injectCSS, init as openZapModal } from "./dialog";
import { renderZapButton, RenderZapButtonOptions } from "./render";
import { nip19 } from "nostr-tools";
import { resolveNip05, decodeNpub } from "./zap-utils";
import { NostrService } from "../common/nostr-service";
import { onboardingService } from '../onboarding/onboarding-service';
import '../onboarding/onboarding-modal';

/**
 * <nostr-zap>
 * Attributes:
 *   - npub | pubkey | nip05   (required) : Nostr user to zap
 *   - relays          (optional) : comma-separated relay URLs
 *   - theme           (optional) : "light" | "dark" (default light)
 *   - button-text     (optional) : custom text (default "⚡️")
 *   - button-color    (optional) : background color for button
 *   - amount          (optional) : pre-defined zap amount in sats
 *   - default-amount  (optional) : default zap amount in sats (default 1000)
 *   - icon-width      (optional) : width of the zap icon (default 24)
 *   - icon-height     (optional) : height of the zap icon (default 24)
 */
export default class NostrZap extends HTMLElement {
  private rendered = false;

  private theme: Theme = "light";

  private isLoading = false;
  private isError = false;
  private isSuccess = false;
  private errorMessage = "";
  private totalZapAmount: number | null = null;
  private isAmountLoading = false;

  private boundHandleClick: (() => void) | null = null;
  private static cssInjected = false;
  private cachedAmountDialog: any = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  private getRelays(): string[] {
    const relaysAttr = this.getAttribute("relays");
    if (relaysAttr) return relaysAttr.split(",");
    return DEFAULT_RELAYS;
  }

  private getTheme() {
    this.theme = "light";
    const th = this.getAttribute("theme");
    if (th) {
      if (!["light", "dark"].includes(th)) {
        console.error(`Nostr-Components: Zap button: Invalid theme '${th}', defaulting to light`);
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
      const isValid = this.validateInputs();
      this.render();
      this.rendered = true;
      if (isValid == true) {
        this.updateZapCount();
      }
    }
  }

  static get observedAttributes() {
    return [
      "relays",
      "npub",
      "pubkey",
      "nip05",
      "theme",
      "button-text",
      "button-color",
      "amount",
      "default-amount",
    ];
  }

  attributeChangedCallback(
    name: string,
    _oldVal: string | null,
    _newVal: string | null
  ) {
    if (name === "theme") this.getTheme();
    this.render();
  }

  disconnectedCallback() {
    const btn = this.shadowRoot?.querySelector(".nostr-zap-button");
    if (btn && this.boundHandleClick) {
      btn.removeEventListener("click", this.boundHandleClick);
    }
    if (
      this.cachedAmountDialog &&
      typeof this.cachedAmountDialog.close === "function"
    ) {
      this.cachedAmountDialog.close();
    }
  }

  private validateInputs(): boolean {

    const npub = this.getAttribute("npub");
    const pubkeyAttr = this.getAttribute("pubkey");
    const nip05Attr = this.getAttribute("nip05");
    const buttonTextAttr = this.getAttribute("button-text");
    const amtAttr = this.getAttribute("amount");
    const defaultAmtAttr = this.getAttribute("default-amount");

    if (npub == null && pubkeyAttr == null && nip05Attr == null) {
      console.error("Nostr-Components: Zap button: Provide npub, nip05 or pubkey attribute");
      this.isError = true;
      this.errorMessage = "Provide npub, nip05 or pubkey attribute";
      return false;
    }

    if (pubkeyAttr && !this.isValidHex(pubkeyAttr)) {
      console.error("Nostr-Components: Zap button: pubkey is in invalid format");
      this.isError = true;
      this.errorMessage = "ERR: Invalid Pubkey";
      return false;
    } else if (nip05Attr && !this.validateNip05(nip05Attr)) {
      console.error("Nostr-Components: Zap button: nip05 is in invalid format");
      this.isError = true;
      this.errorMessage = "ERR: Invalid Nip05";
      return false;
    } else if (npub && !this.validateNpub(npub)) {
      console.error("Nostr-Components: Zap button: npub is in invalid format");
      this.isError = true;
      this.errorMessage = "ERR: Invalid Npub";
      return false;
    } else if (buttonTextAttr && buttonTextAttr.length > 128) {
      console.error("Nostr-Components: Zap button: Max button-text length: 128 characters");
      this.isError = true;
      this.errorMessage = "ERR: Text length too long";
      return false;
    } else if (amtAttr) {
      const num = Number(amtAttr);
      if (isNaN(num) || num <= 0) {
        console.error("Nostr-Components: Zap button: Zap amount: Invalid amount");
        this.isError = true;
        this.errorMessage = "ERR: Invalid Amount";
        return false;
      } else if (num > 210000) {
        console.error("Nostr-Components: Zap button: Zap amount: 210 000 sats");
        this.isError = true;
        this.errorMessage = "ERR: Amount too high";
        return false;
      }
    } else if (defaultAmtAttr) {
      const num = Number(defaultAmtAttr);
      if (isNaN(num) || num <= 0) {
        console.error("Nostr-Components: Zap button: Default zap amount: Invalid amount");
        this.isError = true;
        this.errorMessage = "ERR: Invalid default-amount";
        return false;
      } else if (num > 210000) {
        console.error("Nostr-Components: Zap button: Default zap amount: 210 000 sats");
        this.isError = true;
        this.errorMessage = "ERR: default-amount too high";
        return false;
      }
    }

    this.isError = false;
    this.errorMessage = "";
    return true;

  }

  private isValidHex(hex: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64;
  }

  private validateNpub(npub: string): boolean {
    try {
      nip19.decode(npub);
      return true;
    } catch (e) {
      return false;
    }
  }

  private validateNip05(nip05: string): boolean {
    const nip05Regex = /^[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}$/;
    return nip05Regex.test(nip05);
  }

  private _showOnboardingModal() {
    let modal = document.body.querySelector('nostr-onboarding-modal');
    if (!modal) {
      modal = document.createElement('nostr-onboarding-modal');
      document.body.appendChild(modal);
    }
    modal.setAttribute('open', 'true');
  }

  private async handleZapClick() {
    // Show loading state immediately
    this.isLoading = true;
    this.render();

    try {
      // Wait for authentication to be ready (handles async reconnection)
      const hasAuth = await onboardingService.waitForAuthentication();

      if (!hasAuth) {
        this.isLoading = false;
        this.render();
        this._showOnboardingModal();
        return;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      this.isLoading = false;
      this.render();
      this._showOnboardingModal();
      return;
    }

    // Authentication successful, continue with zap (loading state already set above)

    const relays = this.getRelays().join(",");
    let npub = this.getAttribute("npub");
    const pubkeyAttr = this.getAttribute("pubkey");
    const nip05Attr = this.getAttribute("nip05");

    try {
      if (!npub) {
        if (pubkeyAttr) {
          if (!this.isValidHex(pubkeyAttr)) {
            console.error("Nostr-Components: Zap button: pubkey is in invalid format");
            this.isError = true;
            this.errorMessage = "ERROR";
            this.render();
            return;
          }
          npub = nip19.npubEncode(pubkeyAttr);
        } else if (nip05Attr) {
          if (!this.validateNip05(nip05Attr)) {
            console.error("Nostr-Components: Zap button: nip05 is in invalid format");
            this.isError = true;
            this.errorMessage = "ERROR";
            this.render();
            return;
          }
          const resolvedPubkey = await resolveNip05(nip05Attr);
          if (resolvedPubkey) {
            npub = nip19.npubEncode(resolvedPubkey);
          } else {
            throw new Error(`Failed to resolve NIP-05: ${nip05Attr}`);
          }
        }
      } else {
        if (!this.validateNpub(npub)) {
          console.error("Nostr-Components: Zap button: npub is in invalid format");
          this.isError = true;
          this.errorMessage = "ERR: Invalid Npub";
          this.render();
          return;
        }
      }

      if (!npub) throw new Error("Provide npub, nip05 or pubkey attribute");

      this.cachedAmountDialog = await openZapModal({
        npub,
        relays,
        buttonColor: this.getAttribute("button-color") || undefined,
        cachedAmountDialog: this.cachedAmountDialog,
        theme: this.theme,
        fixedAmount: (() => {
          const amtAttr = this.getAttribute("amount");
          if (!amtAttr) return undefined;
          const num = Number(amtAttr);
          if (isNaN(num) || num <= 0 || num > 210000) {
            console.error("Nostr-Components: Zap button: Max zap amount/default-amount: 210 000 sats");
            return undefined;
          }
          return num;
        })(),
        defaultAmount: (() => {
          const defAttr = this.getAttribute("default-amount");
          if (!defAttr) return undefined;
          const num = Number(defAttr);
          if (isNaN(num) || num <= 0 || num > 210000) {
            console.error("Nostr-Components: Zap button: Max zap amount/default-amount: 210 000 sats");
            return undefined;
          }
          return num;
        })(),
        anon: false,
      });
      this.isError = false;
      this.errorMessage = "";
    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e?.message || "Unable to zap";
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private attachEventListeners() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.querySelector(".nostr-zap-button");
    if (!btn) return;
    if (this.boundHandleClick) {
      btn.removeEventListener("click", this.boundHandleClick);
    }
    this.boundHandleClick = this.handleZapClick.bind(this);
    btn.addEventListener("click", this.boundHandleClick);
  }

  private async updateZapCount() {
    const npub = this.getAttribute("npub");
    const pubkey = this.getAttribute("pubkey");
    const nip05 = this.getAttribute("nip05");
    const relays = this.getRelays();

    let hexPubkey: string | null = null;

    if (pubkey) {
      hexPubkey = pubkey;
    } else if (npub) {
      const decoded = decodeNpub(npub);
      if (decoded) hexPubkey = decoded;
    } else if (nip05) {
      // Resolve nip05 to pubkey
      try {
        const resolved = await resolveNip05(nip05);
        if (resolved) hexPubkey = resolved;
      } catch (e) {
        console.warn("Nostr-Components: Zap button: nip05 resolution failed", e);
      }
    }

    if (hexPubkey) {
      try {
        this.isAmountLoading = true;
        this.render();
        const service = NostrService.getInstance();
        await service.connectToNostr(relays);
        const count = await service.getZapCount({ pubkey: hexPubkey });
        this.totalZapAmount = count;
      } catch (e) {
        console.error("Nostr-Components: Zap button: Failed to fetch zap count", e);
        this.totalZapAmount = null;
      } finally {
        this.isAmountLoading = false;
        this.render();
      }
    }
  }

  private getTextColor(bgColor: string): string {
    const color = bgColor.startsWith('#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#ffffff';
  }

  private render() {
    const buttonTextAttr = this.getAttribute("button-text");
    const buttonColorAttr = this.getAttribute("button-color");
    const iconWidthAttr = this.getAttribute("icon-width");
    const iconHeightAttr = this.getAttribute("icon-height");

    if (buttonColorAttr) {
      const textColor = this.getTextColor(buttonColorAttr);
      this.style.setProperty('--nstrc-zap-btn-bg', buttonColorAttr);
      this.style.setProperty('--nstrc-zap-btn-color', textColor);
    }

    const renderOptions: RenderZapButtonOptions = {
      theme: this.theme,
      isLoading: this.isLoading,
      isError: this.isError,
      isSuccess: this.isSuccess,
      errorMessage: this.errorMessage,
      buttonText: buttonTextAttr || "Zap",
      iconWidth: iconWidthAttr ? Number(iconWidthAttr) : 25,
      iconHeight: iconHeightAttr ? Number(iconHeightAttr) : 25,
      totalZapAmount: this.totalZapAmount,
      isAmountLoading: this.isAmountLoading,
    };

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = renderZapButton(renderOptions);
      this.attachEventListeners();
    }
  }
}

customElements.define("nostr-zap", NostrZap);
