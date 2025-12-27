/**
 * <nostr-dm>
 * Attributes:
 *  - recipient-npub   (optional) : pre-set npub of recipient
 *  - nip05            (optional) : user@domain nip-05 identifier (alternative to recipient-npub)
 *  - relays           (optional) : comma-separated relay URLs (defaults to common public set)
 *  - theme            (optional) : "light" | "dark" (default "light")
 *  - debug            (optional) : "true" | "false" - whether to log debug messages (default "false")
 *
 * Behaviour:
 *  • If neither recipient-npub nor nip05 is supplied the component shows an input + Find button.
 *  • Entering an npub then clicking Find performs profile lookup; during lookup the Find button shows
 *    spinner/“Finding…”. On success the UI switches to DM compose view.
 *  • If nip05 attribute is provided we first resolve it to a pubkey via nip05 well-known file then look
 *    up the profile as usual.
 */
import { NDKNip07Signer, NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "../common/constants";
import { Theme } from "../common/types";
import { renderDm, RenderDmOptions } from "./render";
import { nip19 } from "nostr-tools";
import { NostrService } from "../common/nostr-service";

// ---------------------------------------------------------------------------
// nip05 resolution helper – very lightweight fetch to /.well-known/nostr.json
// ---------------------------------------------------------------------------
// Import the resolveNip05 function from our common utils
import { resolveNip05 } from '../common/nip05-utils';

/**
 * Debug utility that only logs in development mode or when debug attribute is set
 * @param message The message to log
 * @param data Additional data to log
 */
function debug(component: NostrDm, message: string, data?: any) {
  // Check if we're in development environment or debug attribute is true
  const isDev = process.env.NODE_ENV === 'development';
  const isDebug = component.getAttribute('debug') === 'true';
  
  if (isDev || isDebug) {
    if (data) {
      console.log(`[NostrDm] ${message}`, data);
    } else {
      console.log(`[NostrDm] ${message}`);
    }
  }
}


export default class NostrDm extends HTMLElement {
  private rendered: boolean = false;
  private nostrService: NostrService = NostrService.getInstance();

  private theme: Theme = "light";
  private recipientNpub: string | null = null;
  private recipientNip05: string | null = null;
  private recipientName: string | null = null;
  private recipientPicture: string | null = null;
  private recipientPubkey: string | null = null;
  private message: string = "";

  // isLoading -> sending DM, isFinding -> looking up recipient
  private isLoading: boolean = false;
  private isFinding: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = "";
  private isSent: boolean = false;

  // Event handlers
  private boundHandleFind: (() => void) | null = null;
  private boundHandleSend: (() => void) | null = null;
  private boundHandleTextareaChange: ((e: Event) => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

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

  getRecipient = () => {
    const nip05Attr = this.getAttribute("nip05");
    if (nip05Attr) {
      this.recipientNip05 = nip05Attr;
      this.lookupRecipientByNip05();
      return;
    }

    const recipientNpub = this.getAttribute("recipient-npub");
    if (recipientNpub) {
      this.recipientNpub = recipientNpub;
      this.lookupRecipient();
    }
  };

  connectedCallback() {
    if (!this.rendered) {
      this.rendered = true;
      
      // Initialize the component
      this.getTheme();
      this.getRecipient();
      this.nostrService.connectToNostr(this.getRelays());
      this.render();
    }
  }

  static get observedAttributes() {
    return ["relays", "recipient-npub", "nip05", "theme", "debug"];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ) {
    if (name === "relays") {
      this.nostrService.connectToNostr(this.getRelays());
    }

    if (name === "theme") {
      this.getTheme();
    }

    if (name === "nip05" && newValue) {
      this.recipientNip05 = newValue;
      this.lookupRecipientByNip05();
    }

    if (name === "recipient-npub" && newValue) {
      this.recipientNpub = newValue;
      this.lookupRecipient();
    }

    this.render();
  }

  private async lookupRecipient(npub?: string) {
    const targetNpub = npub || this.recipientNpub;
    if (!targetNpub) return;

    this.isFinding = true;
    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      const user = ndk.getUser({ npub: targetNpub });

      await user.fetchProfile();

      if (user.profile) {
        this.recipientName =
          user.profile.displayName || user.profile.name || "Unknown";
        this.recipientPicture = user.profile.image || null;
        this.recipientPubkey = user.pubkey;
        // set actual recipient npub only after successful lookup
        this.recipientNpub = targetNpub;
      } else {
        this.recipientName = "Unknown";
        this.recipientPicture = null;
        this.recipientPubkey = user.pubkey;
        this.recipientNpub = targetNpub;
      }
    } catch (err) {
      this.isError = true;
      this.errorMessage = `Failed to find recipient: ${(err as Error).message}`;
    } finally {
      this.isFinding = false;
      this.render();
    }
  }

  // Resolve nip05 -> pubkey -> npub then delegate to lookupRecipient
  private async lookupRecipientByNip05(nip05?: string) {
    const targetNip05 = nip05 || this.recipientNip05;
    if (!targetNip05) return;

    this.isFinding = true;
    this.render();

    try {
      const pubkeyHex = await resolveNip05(targetNip05);
      if (!pubkeyHex) throw new Error("Failed to resolve nip05");
      const npub = nip19.npubEncode(pubkeyHex);
      await this.lookupRecipient(npub);
    } catch (err) {
      this.isError = true;
      this.errorMessage = `Failed to resolve nip05: ${(err as Error).message}`;
    } finally {
      this.isFinding = false;
      this.render();
    }
  }

  private async handleFindClick() {
    // Determine if user entered nip05 (has '@') or npub

    const npubInput = this.shadowRoot!.querySelector(
      ".nostr-dm-npub-input"
    ) as HTMLInputElement;
    if (!npubInput || !npubInput.value) {
      this.isError = true;
      this.errorMessage = "Please enter a valid npub";
      this.render();
      return;
    }

    const entered = npubInput.value.trim();
    if (entered.includes("@")) {
      await this.lookupRecipientByNip05(entered);
    } else {
      await this.lookupRecipient(entered);
    }
  }

  private async handleSendClick() {
    debug(this, "Send button clicked!");
    
    if (!this.recipientPubkey || !this.message.trim()) {
      this.isError = true;
      this.errorMessage = !this.recipientPubkey
        ? "Recipient not found"
        : "Please enter a message";
      this.render();
      return;
    }

    this.isError = false;
    this.isSent = false;
    this.isLoading = true;
    this.render();

    // Check for signer availability using NostrService's hasSigner method
    if (!this.nostrService.hasSigner()) {
      this.isError = true;
      this.errorMessage = "No Nostr signer available. Please ensure your Nostr extension is installed or provide a private key.";
      this.isLoading = false;
      this.render();
      return;
    }
    
    // Create appropriate signer based on what's available
    let signer = null;
    if (typeof window !== 'undefined' && (window as any).nostr) {
      signer = new NDKNip07Signer();
    } else if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem("nostr_nsec");
      if (stored) {
        const { NDKPrivateKeySigner } = await import("@nostr-dev-kit/ndk");
        signer = new NDKPrivateKeySigner(stored);
      }
    }

    if (!signer) {
      this.isError = true;
      this.errorMessage = "Failed to create signer. Please ensure your Nostr signer (extension or private key) is configured.";
      this.render();
      return;
    }

    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      ndk.signer = signer;

      // Important: Use nostr-tools directly for encryption to ensure compatibility
      const { nip04 } = await import("nostr-tools");

      // Create a basic event with the correct kind and target pubkey
      const event = new NDKEvent(ndk, {
        kind: NDKKind.EncryptedDirectMessage,
        tags: [["p", this.recipientPubkey!]],
        created_at: Math.floor(Date.now() / 1000),
      });

      // For extension-based signers (NIP-07), use the extension's encryption
      if (typeof window !== 'undefined' && (window as any).nostr) {
        // Here we encrypt through the extension using nip04
        const encryptedContent = await (window as any).nostr.nip04.encrypt(
          this.recipientPubkey!,
          this.message.trim()
        );
        event.content = encryptedContent;
      } else if (typeof localStorage !== 'undefined') {
        // For private key signers
        const privateKeyHex = localStorage.getItem("nostr_nsec");
        if (!privateKeyHex) throw new Error("No private key available");

        // Import the relevant libraries
        const { nip19 } = await import("nostr-tools");

        // Handle both hex and bech32 formats
        let privateKey = privateKeyHex;
        if (privateKeyHex.startsWith("nsec")) {
          try {
            const decoded = nip19.decode(privateKeyHex);
            privateKey = decoded.data as string;
          } catch (e) {
            console.error("Failed to decode nsec:", e);
            throw new Error("Invalid private key format");
          }
        }

        // Use nostr-tools to encrypt the message
        try {
          event.content = await nip04.encrypt(
            privateKey,
            this.recipientPubkey!,
            this.message.trim()
          );
        } catch (encErr) {
          console.error("Encryption error:", encErr);
          throw new Error(`Encryption failed: ${(encErr as Error).message}`);
        }
      }

      debug(this, "Sending encrypted DM:", {
        to: this.recipientPubkey!,
        encryptedContent: event.content,
      });

      // Publish the event with the encrypted content
      await event.publish();
      debug(this, "DM sent with encrypted content:", event);

      this.isSent = true;
      this.message = "";

      // Clear textarea
      const textarea = this.shadowRoot!.querySelector(
        ".nostr-dm-textarea"
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = "";
      }
    } catch (err) {
      this.isError = true;
      this.errorMessage = `Failed to send message: ${(err as Error).message}`;
      this.isSent = false; // Reset sent state on error
    } finally {
      this.isLoading = false; // Reset loading state
      this.isFinding = false;
      this.render();
    }
  }

  private handleTextareaChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.message = textarea.value;
  }

  attachEventListeners() {
    // Find button
    const findButton = this.shadowRoot!.querySelector(".nostr-dm-find-btn");
    if (findButton) {
      // Remove any existing listener
      if (this.boundHandleFind) {
        findButton.removeEventListener("click", this.boundHandleFind);
      }

      // Create and store a new bound handler
      this.boundHandleFind = this.handleFindClick.bind(this);
      findButton.addEventListener("click", this.boundHandleFind);
      debug(this, "Find button event listener attached");
    } else {
      debug(this, "Find button not found in DOM");
    }

    // Send button
    const sendButton = this.shadowRoot!.querySelector(".nostr-dm-send-btn");
    if (sendButton) {
      debug(this, "Send button found, disabled:", sendButton.hasAttribute("disabled"));
      
      // Remove any existing listener
      if (this.boundHandleSend) {
        sendButton.removeEventListener("click", this.boundHandleSend);
      }

      // Create and store a new bound handler
      this.boundHandleSend = this.handleSendClick.bind(this);
      sendButton.addEventListener("click", this.boundHandleSend);
      
      // Force enable the button if we have a recipient and we're not loading
      if (this.recipientPubkey && !this.isLoading) {
        sendButton.removeAttribute("disabled");
      }
      
      debug(this, "Send button event listener attached");
    } else {
      debug(this, "Send button not found in DOM");
    }

    // Textarea
    const textarea = this.shadowRoot!.querySelector(".nostr-dm-textarea");
    if (textarea) {
      // Remove any existing listener
      if (this.boundHandleTextareaChange) {
        textarea.removeEventListener("input", this.boundHandleTextareaChange);
      }

      // Create and store a new bound handler
      this.boundHandleTextareaChange = this.handleTextareaChange.bind(this);
      textarea.addEventListener("input", this.boundHandleTextareaChange);
    }

    // Npub input
    const npubInput = this.shadowRoot!.querySelector(".nostr-dm-npub-input");
    if (npubInput) {
      // Add keydown event listener for Enter key
      npubInput.addEventListener("keydown", (e: Event) => {
        if ((e as KeyboardEvent).key === "Enter") {
          this.handleFindClick();
        }
      });
    }
  }

  disconnectedCallback() {
    // Clean up event listeners
    const findButton = this.shadowRoot?.querySelector(".nostr-dm-find-btn");
    if (findButton && this.boundHandleFind) {
      findButton.removeEventListener("click", this.boundHandleFind);
    }

    const sendButton = this.shadowRoot?.querySelector(".nostr-dm-send-btn");
    if (sendButton && this.boundHandleSend) {
      sendButton.removeEventListener("click", this.boundHandleSend);
    }

    const textarea = this.shadowRoot?.querySelector(".nostr-dm-textarea");
    if (textarea && this.boundHandleTextareaChange) {
      textarea.removeEventListener("input", this.boundHandleTextareaChange);
    }
  }

  private render() {
    debug(this, "Rendering with state:", {
      recipientNpub: this.recipientNpub,
      recipientPubkey: this.recipientPubkey,
      message: this.message ? "[message content]" : "[empty]",
      isLoading: this.isLoading,
      isFinding: this.isFinding,
      isError: this.isError,
      isSent: this.isSent
    });
    
    const renderOptions: RenderDmOptions = {
      theme: this.theme,
      recipientNpub: this.recipientNpub,
      recipientName: this.recipientName,
      recipientPicture: this.recipientPicture,
      message: this.message,
      isLoading: this.isLoading,
      isFinding: this.isFinding,
      isError: this.isError,
      errorMessage: this.errorMessage,
      isSent: this.isSent,
    };

    this.shadowRoot!.innerHTML = renderDm(renderOptions);
    this.attachEventListeners();
  }
}

if (!customElements.get('nostr-dm')) {
  customElements.define('nostr-dm', NostrDm);
}
