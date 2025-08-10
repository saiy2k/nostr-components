/**
 * <nostr-live-chat>
 * Attributes:
 *  - recipient-npub   (optional) : pre-set npub of recipient
 *  - nip05            (optional) : user@domain nip-05 identifier (alternative to recipient-npub)
 *  - relays           (optional) : comma-separated relay URLs (defaults to common public set)
 *  - theme            (optional) : "light" | "dark" (default "light")
 *
 * Behaviour:
 *  • If neither recipient-npub nor nip05 is supplied the component shows an input + Find button.
 *  • Entering an npub then clicking Find performs profile lookup; during lookup the Find button shows
 *    spinner/“Finding…”. On success the UI switches to the chat view.
 *  • If nip05 attribute is provided we first resolve it to a pubkey via nip05 well-known file then look
 *    up the profile as usual.
 *  • The component will subscribe to incoming DMs and display the chat history.
 */
import { NDKNip07Signer, NDKEvent, NDKKind, NDKFilter, NDKSubscription } from "@nostr-dev-kit/ndk";
import { DEFAULT_RELAYS } from "../common/constants";
import { Theme } from "../common/types";
import { getLiveChatStyles, renderLiveChatInner, RenderLiveChatOptions } from "./render";
import { nip19 } from "nostr-tools";
import { NostrService } from "../common/nostr-service";
import { resolveNip05 } from "../common/nip05-utils";

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
}

// Using shared resolveNip05 utility from common/nip05-utils

export default class NostrLiveChat extends HTMLElement {
  private rendered: boolean = false;
  private nostrService: NostrService = NostrService.getInstance();
  private dmSubscription: NDKSubscription | null = null;

  private theme: Theme = "light";
  private recipientNpub: string | null = null;
  private recipientNip05: string | null = null;
  private recipientName: string | null = null;
  private recipientPicture: string | null = null;
  private recipientPubkey: string | null = null;
  private message: string = "";
  private messages: Message[] = [];
  
  // Current user (signer) info for "Logged in as" UI
  private currentUserPubkey: string | null = null;
  private currentUserNpub: string | null = null;
  private currentUserName: string | null = null;
  private currentUserPicture: string | null = null;

  // Display controls
  private displayType: 'fab' | 'bottom-bar' | 'full' | 'embed' = 'embed';
  private isOpen: boolean = false; // For floating modes
  private showWelcome: boolean = false; // Show welcome screen before starting chat
  private welcomeText: string = "Welcome! How can we help you today?";
  private startChatText: string = "Start chat";
  private readonly MESSAGE_MAX_LENGTH = 1000;

  // isLoading -> sending DM, isFinding -> looking up recipient
  private isLoading: boolean = false;
  private isFinding: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = "";

  // Event handlers
  private boundHandleFind: (() => void) | null = null;
  private boundHandleSend: (() => void) | null = null;
  private boundHandleTextareaChange: ((e: Event) => void) | null = null;
  private boundHandleLauncherClick: (() => void) | null = null;
  private boundHandleCloseClick: (() => void) | null = null;
  private boundHandleStartChat: (() => void) | null = null;

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

  private async getCurrentUserInfo() {
    try {
      const ndk = this.nostrService.getNDK();
      let pubkey: string | null = null;

      if (typeof window !== 'undefined' && (window as any).nostr && (window as any).nostr.getPublicKey) {
        try {
          const signer = new NDKNip07Signer();
          const u = await signer.user();
          pubkey = u.pubkey;
        } catch {
          // ignore extension errors
        }
      }

      if (!pubkey && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('nostr_nsec');
        if (stored) {
          try {
            const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
            let sk = stored;
            if (stored.startsWith('nsec')) {
              const decoded = nip19.decode(stored);
              sk = decoded.data as string;
            }
            const signer = new NDKPrivateKeySigner(sk);
            const u = await signer.user();
            pubkey = u.pubkey;
          } catch {
            // ignore
          }
        }
      }

      if (pubkey) {
        this.currentUserPubkey = pubkey;
        this.currentUserNpub = nip19.npubEncode(pubkey);
        try {
          const user = ndk.getUser({ pubkey });
          await user.fetchProfile();
          this.currentUserName = user.profile?.displayName || user.profile?.name || this.currentUserNpub?.substring(0, 10) || null;
          this.currentUserPicture = user.profile?.image || null;
        } catch {
          // ignore profile fetch errors
        }
        this.render();
      }
    } catch {
      // ignore global errors
    }
  }

  private getDisplayType() {
    // Support both kebab and camel attributes
    const attr = this.getAttribute('display-type') || this.getAttribute('displayType');
    const allowed = ['fab', 'bottom-bar', 'full', 'embed'];
    const raw = attr ? String(attr) : '';
    const lower = raw.toLowerCase();
    const normalized = allowed.includes(lower) ? lower : 'embed';
    this.displayType = normalized as any;
    // Initialize open state
    if (this.displayType === 'full') {
      this.isOpen = true;
    } else if (this.displayType === 'fab' || this.displayType === 'bottom-bar') {
      if (this.isOpen === undefined || this.isOpen === null) this.isOpen = false;
    } else {
      this.isOpen = false;
    }
    // Reflect attribute for :host([display-type=...]) CSS to apply
    const current = this.getAttribute('display-type');
    if (current !== normalized) {
      this.setAttribute('display-type', normalized);
    }
  }

  getTheme = () => {
    const attr = this.getAttribute("theme");
    const value = (attr || "").toLowerCase();
    if (value === "light" || value === "dark") {
      this.theme = value as Theme;
    } else {
      if (attr) {
        console.warn(`Invalid theme '${attr}'. Accepted values are 'light', 'dark'. Falling back to 'light'.`);
      }
      this.theme = "light";
    }
  };

  getRecipient = () => {
    const recipientPub = this.getAttribute("recipient-pubkey") || this.getAttribute("recipientPubkey");
    if (recipientPub) {
      try {
        this.recipientPubkey = recipientPub;
        this.recipientNpub = nip19.npubEncode(recipientPub);
        this.lookupRecipient(this.recipientNpub);
        return;
      } catch (e) {
        // Fallback to other methods if encoding fails
      }
    }
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
      this.getTheme();
      this.getDisplayType();
      // Apply initial textual attributes before first render
      const welcomeAttr = this.getAttribute('welcome-text');
      if (welcomeAttr) this.welcomeText = welcomeAttr;
      const startAttr = this.getAttribute('start-chat-text');
      if (startAttr) this.startChatText = startAttr;
      this.getRecipient();
      this.nostrService.connectToNostr(this.getRelays());
      this.getCurrentUserInfo();
      this.render();
      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return [
      "recipient-npub",
      "recipient-pubkey",
      "recipientPubkey",
      "nip05",
      "relays",
      "theme",
      "display-type",
      "displayType",
      "welcome-text",
      "start-chat-text"
    ];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ) {
    if (!this.rendered) return;

    if (name === "recipient-npub" && newValue) {
      this.recipientNpub = newValue;
      this.lookupRecipient();
    } else if ((name === 'recipient-pubkey' || name === 'recipientPubkey') && newValue) {
      try {
        this.recipientPubkey = newValue;
        this.recipientNpub = nip19.npubEncode(newValue);
        this.lookupRecipient(this.recipientNpub);
      } catch {
        // ignore
      }
    } else if (name === "nip05" && newValue) {
      this.recipientNip05 = newValue;
      this.lookupRecipientByNip05();
    } else if (name === "relays") {
      this.nostrService.connectToNostr(this.getRelays());
    } else if (name === "theme") {
      this.getTheme();
      this.render();
    } else if (name === 'display-type' || name === 'displayType') {
      this.getDisplayType();
      this.render();
    } else if (name === 'welcome-text') {
      this.welcomeText = newValue || this.welcomeText;
      this.render();
    } else if (name === 'start-chat-text') {
      this.startChatText = newValue || this.startChatText;
      this.render();
    }
  }

  private async lookupRecipient(npub?: string) {
    this.isFinding = true;
    this.render();

    try {
      const recipientNpub = npub || this.recipientNpub;
      if (!recipientNpub) return;

      const { type, data } = nip19.decode(recipientNpub);
      if (type !== "npub") throw new Error("Invalid npub");
      this.recipientPubkey = data as string;

      const user = this.nostrService.getNDK().getUser({ pubkey: this.recipientPubkey });
      await user.fetchProfile();

      this.recipientName = user.profile?.displayName || user.profile?.name || recipientNpub.substring(0, 10);
      this.recipientPicture = user.profile?.image || null;
      // Prepare welcome screen; user starts chat to subscribe
      this.showWelcome = true;
      this.messages = [];
      // Clear any previous error state on successful lookup
      this.isError = false;
      this.errorMessage = "";
      this.render(); // Re-render to show profile info & welcome view

    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e.message;
    } finally {
      this.isFinding = false;
      this.render();
    }
  }

  // Resolve nip05 -> pubkey -> npub then delegate to lookupRecipient
  private async lookupRecipientByNip05(nip05?: string) {
    this.isFinding = true;
    this.render();

    try {
      const recipientNip05 = nip05 || this.recipientNip05;
      if (!recipientNip05) return;

      const pubkey = await resolveNip05(recipientNip05);
      const npub = nip19.npubEncode(pubkey);
      this.recipientNpub = npub;
      // Clear any previous error state on successful nip05 resolution
      this.isError = false;
      this.errorMessage = "";
      await this.lookupRecipient(npub);

    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e.message;
    } finally {
      this.isFinding = false;
      this.render();
    }
  }

  private handleFindClick() {
    const input = this.shadowRoot!.querySelector(".nostr-chat-npub-input") as HTMLInputElement;
    const value = input.value.trim();
    // Reset previous error state when starting a new find
    this.isError = false;
    this.errorMessage = "";
    this.render();
    if (!value) return;

    if (value.startsWith("npub")) {
      this.recipientNpub = value;
      this.lookupRecipient();
    } else if (value.includes("@")) {
      this.recipientNip05 = value;
      this.lookupRecipientByNip05();
    } else {
      this.isError = true;
      this.errorMessage = "Invalid input. Please provide an npub or nip05 address.";
      this.render();
    }
  }

  private async handleSendClick() {
    if (!this.message.trim() || !this.recipientPubkey) return;
    if (this.message.length > this.MESSAGE_MAX_LENGTH) {
      this.isError = true;
      this.errorMessage = `Message is too long (max ${this.MESSAGE_MAX_LENGTH} characters).`;
      this.render();
      return;
    }

    this.isLoading = true;
    this.render();

    let tempId: string | null = null;

    try {
      const ndk = this.nostrService.getNDK();
      let signer;
      
      // Enhanced check for NIP-07 extension - verify if fully available with required methods
      if (typeof window !== 'undefined' && 
          (window as any).nostr && 
          (window as any).nostr.getPublicKey && 
          (window as any).nostr.signEvent) {
        try {
          signer = new NDKNip07Signer();
        } catch (err) {
          console.error("Error creating NIP-07 signer:", err);
          this.isError = true;
          this.errorMessage = `Error connecting to Nostr extension: ${(err as Error).message}`;
          this.isLoading = false;
          this.render();
          return;
        }
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem("nostr_nsec");
        if (stored) {
          const { NDKPrivateKeySigner } = await import("@nostr-dev-kit/ndk");
          const { nip19 } = await import("nostr-tools");
          let sk = stored;
          if (stored.startsWith("nsec")) {
            const decoded = nip19.decode(stored);
            sk = decoded.data as string;
          }
          signer = new NDKPrivateKeySigner(sk);
        }
      }

      if (!signer) {
        throw new Error("No signer available. Please install a NIP-07 extension or set a private key.");
      }
      ndk.signer = signer;

      const { nip04 } = await import("nostr-tools");

      const event = new NDKEvent(ndk, {
        kind: NDKKind.EncryptedDirectMessage,
        tags: [["p", this.recipientPubkey!]],
        created_at: Math.floor(Date.now() / 1000),
      });

      if ((window as any).nostr) {
        event.content = await (window as any).nostr.nip04.encrypt(
          this.recipientPubkey!,
          this.message.trim()
        );
      } else {
        const privateKeyHex = localStorage.getItem("nostr_nsec");
        if (!privateKeyHex) throw new Error("No private key available");

        const { nip19 } = await import("nostr-tools");
        let privateKey = privateKeyHex;
        if (privateKeyHex.startsWith("nsec")) {
          const decoded = nip19.decode(privateKeyHex);
          privateKey = decoded.data as string;
        }

        event.content = await nip04.encrypt(
          privateKey,
          this.recipientPubkey!,
          this.message.trim()
        );
      }

      tempId = `temp_${Date.now()}`;
      this.messages.push({
        id: tempId,
        text: this.message,
        sender: 'me',
        timestamp: event.created_at!,
        status: 'sending'
      });
      this.message = ""; // Clear input
      this.render();

      await event.publish();

      const sentMessage = this.messages.find(m => m.id === tempId);
      if (sentMessage) {
        sentMessage.id = event.id; // Update with real event id
        sentMessage.status = 'sent';
        this.render();
      }

    } catch (e: any) {
      this.isError = true;
      this.errorMessage = e.message;
      // If publish failed, mark the optimistic message as failed
      if (tempId) {
        const msg = this.messages.find(m => m.id === tempId);
        if (msg) {
          msg.status = 'failed';
        }
        this.render();
      }
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private handleTextareaChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea.value.length > this.MESSAGE_MAX_LENGTH) {
      textarea.value = textarea.value.slice(0, this.MESSAGE_MAX_LENGTH);
      this.isError = true;
      this.errorMessage = `Maximum length is ${this.MESSAGE_MAX_LENGTH} characters.`;
    } else {
      this.isError = false;
      this.errorMessage = "";
    }
    this.message = textarea.value;

    // Live update character counter without full re-render
    const counterEl = this.shadowRoot?.querySelector('.nostr-chat-char-counter') as HTMLElement | null;
    if (counterEl) {
      const typed = textarea.value.length;
      const remaining = Math.max(0, this.MESSAGE_MAX_LENGTH - typed);
      counterEl.textContent = `${typed}/${this.MESSAGE_MAX_LENGTH} • ${remaining} left`;
      counterEl.classList.toggle('warn', remaining <= 100);
    }
  }

  private handleStartChat() {
    this.showWelcome = false;
    this.subscribeToDms();
    this.render();
  }

  private async subscribeToDms() {
    if (this.dmSubscription) {
      this.dmSubscription.stop();
    }
    if (!this.recipientPubkey) return;
    
    // Determine current user using available signer (extension or local key)
    let currentUser: { pubkey: string } | null = null;
    try {
      if (typeof window !== 'undefined' && (window as any).nostr && (window as any).nostr.getPublicKey && (window as any).nostr.signEvent) {
        const signer = new NDKNip07Signer();
        currentUser = await signer.user();
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('nostr_nsec');
        if (stored) {
          const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
          let sk = stored;
          if (stored.startsWith('nsec')) {
            const decoded = nip19.decode(stored);
            sk = decoded.data as string;
          }
          const signer = new NDKPrivateKeySigner(sk);
          currentUser = await signer.user();
        }
      }
    } catch (err) {
      console.error('Failed to determine current user for subscription', err);
    }

    if (!currentUser) {
      this.isError = true;
      this.errorMessage = 'No signer available. Please install a NIP-07 extension or set a private key to start the chat.';
      this.render();
      return;
    }

    // Reset messages for new recipient
    this.messages = [];

    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Filter for messages sent by the recipient to the current user
    const filter1: NDKFilter = {
      kinds: [NDKKind.EncryptedDirectMessage],
      '#p': [currentUser.pubkey],
      authors: [this.recipientPubkey],
      since,
    };

    // Filter for messages sent by the current user to the recipient
    const filter2: NDKFilter = {
      kinds: [NDKKind.EncryptedDirectMessage],
      '#p': [this.recipientPubkey],
      authors: [currentUser.pubkey],
      since,
    };

    this.dmSubscription = this.nostrService.getNDK().subscribe([filter1, filter2], { 
      closeOnEose: false, 
      groupable: false 
    });

    this.dmSubscription.on('event', async (event: NDKEvent) => {
      try {
        // Update current user info if missing
        if (!this.currentUserPubkey) {
          try {
            const signerUser = await new NDKNip07Signer().user();
            this.currentUserPubkey = signerUser.pubkey;
            this.currentUserNpub = nip19.npubEncode(signerUser.pubkey);
          } catch {}
        }
        // Determine if we are the sender or receiver of the event
        const isSender = event.pubkey === currentUser.pubkey;
        const peer = isSender ? event.tags.find(t => t[0] === 'p')?.[1] : event.pubkey;

        // Validate that this message is between the current user and the recipient
        if (peer !== this.recipientPubkey) {
            // not for me
            return;
        }

        // For messages sent by current user, skip if we already have an optimistic version
        // This prevents duplicate display of sent messages
        if (isSender) {
          const existingMessage = this.messages.find(m => m.id === event.id);
          if (existingMessage) {
            // Message already exists (optimistic version), just update status if needed
            if (existingMessage.status === 'sending') {
              existingMessage.status = 'sent';
              this.render();
            }
            return;
          }
        }

        let decryptedText = "";
        const { nip04 } = await import("nostr-tools");

        if ((window as any).nostr) {
            decryptedText = await (window as any).nostr.nip04.decrypt(
                peer,
                event.content
            );
        } else {
            const privateKeyHex = localStorage.getItem("nostr_nsec");
            if (!privateKeyHex) throw new Error("No private key available for decryption");

            const { nip19 } = await import("nostr-tools");
            let privateKey = privateKeyHex;
            if (privateKeyHex.startsWith("nsec")) {
                const decoded = nip19.decode(privateKeyHex);
                privateKey = decoded.data as string;
            }

            decryptedText = await nip04.decrypt(
                privateKey,
                peer!,
                event.content!
            );
        }

        const message: Message = {
          id: event.id,
          text: decryptedText,
          sender: isSender ? 'me' : 'them',
          timestamp: event.created_at!,
          status: 'sent'
        };
        
        // Check for duplicates by ID, content, and timestamp to handle edge cases
        const isDuplicate = this.messages.find(m => 
          m.id === message.id || 
          (m.text === message.text && m.sender === message.sender && Math.abs(m.timestamp - message.timestamp) < 2)
        );
        
        if (!isDuplicate) {
          this.messages.push(message);
          this.messages.sort((a, b) => a.timestamp - b.timestamp);
          this.render();
        }  
      } catch (e: any) {
        console.error("Failed to decrypt DM content:", e);
      }
    });
  }

  private attachEventListeners() {
    // Floating launchers
    const launcher = this.shadowRoot!.querySelector('.nostr-chat-launcher');
    if (launcher) {
      if (this.boundHandleLauncherClick) launcher.removeEventListener('click', this.boundHandleLauncherClick);
      this.boundHandleLauncherClick = () => { this.isOpen = true; this.render(); };
      launcher.addEventListener('click', this.boundHandleLauncherClick);
    }
    const closeBtn = this.shadowRoot!.querySelector('.nostr-chat-close-btn');
    if (closeBtn && (this.displayType === 'fab' || this.displayType === 'bottom-bar')) {
      if (this.boundHandleCloseClick) closeBtn.removeEventListener('click', this.boundHandleCloseClick);
      this.boundHandleCloseClick = (e?: Event) => { e?.stopPropagation(); this.isOpen = false; this.render(); };
      closeBtn.addEventListener('click', this.boundHandleCloseClick);
    }

    const findButton = this.shadowRoot!.querySelector(".nostr-chat-find-btn");
    if (findButton) {
      if (this.boundHandleFind) findButton.removeEventListener("click", this.boundHandleFind);
      this.boundHandleFind = this.handleFindClick.bind(this);
      findButton.addEventListener("click", this.boundHandleFind);
    }

    const sendButton = this.shadowRoot!.querySelector(".nostr-chat-send-btn");
    if (sendButton) {
      if (this.boundHandleSend) sendButton.removeEventListener("click", this.boundHandleSend);
      this.boundHandleSend = this.handleSendClick.bind(this);
      sendButton.addEventListener("click", this.boundHandleSend);
    }

    const startBtn = this.shadowRoot!.querySelector('.nostr-chat-start-btn');
    if (startBtn) {
      if (this.boundHandleStartChat) startBtn.removeEventListener('click', this.boundHandleStartChat);
      this.boundHandleStartChat = this.handleStartChat.bind(this);
      startBtn.addEventListener('click', this.boundHandleStartChat);
    }

    const textarea = this.shadowRoot!.querySelector(".nostr-chat-textarea");
    if (textarea) {
      if (this.boundHandleTextareaChange) textarea.removeEventListener("input", this.boundHandleTextareaChange);
      this.boundHandleTextareaChange = this.handleTextareaChange.bind(this);
      textarea.addEventListener("input", this.boundHandleTextareaChange);
    }

    const npubInput = this.shadowRoot!.querySelector(".nostr-chat-npub-input");
    if (npubInput) {
      npubInput.addEventListener("keydown", (e: Event) => {
        if ((e as KeyboardEvent).key === "Enter") this.handleFindClick();
      });
    }
  }

  disconnectedCallback() {
    if (this.dmSubscription) {
      this.dmSubscription.stop();
    }
    // Clean up event listeners
    const launcher = this.shadowRoot?.querySelector('.nostr-chat-launcher');
    if (launcher && this.boundHandleLauncherClick) launcher.removeEventListener('click', this.boundHandleLauncherClick);
    const closeBtn = this.shadowRoot?.querySelector('.nostr-chat-close-btn');
    if (closeBtn && this.boundHandleCloseClick) closeBtn.removeEventListener('click', this.boundHandleCloseClick);
    const findButton = this.shadowRoot?.querySelector(".nostr-chat-find-btn");
    if (findButton && this.boundHandleFind) findButton.removeEventListener("click", this.boundHandleFind);

    const sendButton = this.shadowRoot?.querySelector(".nostr-chat-send-btn");
    if (sendButton && this.boundHandleSend) sendButton.removeEventListener("click", this.boundHandleSend);

    const textarea = this.shadowRoot?.querySelector(".nostr-chat-textarea");
    if (textarea && this.boundHandleTextareaChange) textarea.removeEventListener("input", this.boundHandleTextareaChange);
  }

  private render() {
    const renderOptions: RenderLiveChatOptions = {
      theme: this.theme,
      recipientNpub: this.recipientNpub,
      recipientName: this.recipientName,
      recipientPicture: this.recipientPicture,
      message: this.message,
      messages: this.messages,
      isLoading: this.isLoading,
      isFinding: this.isFinding,
      isError: this.isError,
      errorMessage: this.errorMessage,
      currentUserName: this.currentUserName,
      currentUserPicture: this.currentUserPicture,
      showWelcome: this.showWelcome,
      welcomeText: this.welcomeText,
      startChatText: this.startChatText,
      maxMessageLength: this.MESSAGE_MAX_LENGTH,
    };

    const styles = getLiveChatStyles(this.theme);
    const inner = renderLiveChatInner(renderOptions);

    let html = styles;
    if (this.displayType === 'embed') {
      html += inner;
    } else if (this.displayType === 'full') {
      html += `
        <div class="nostr-chat-float-panel open">${inner}</div>
      `;
    } else if (this.displayType === 'fab') {
      html += `
        ${this.isOpen ? '' : `
          <div class="nostr-chat-launcher fab" role="button" aria-label="Open live chat">
            <div class="bubble">
              <div class="title">We're Online!</div>
              <div class="subtitle">How may I help you today?</div>
            </div>
            <button class="fab-btn" aria-label="Open chat">💬</button>
          </div>
        `}
        <div class="nostr-chat-float-panel ${this.isOpen ? 'open' : ''}">
          <button class="nostr-chat-close-btn" title="Minimize">×</button>
          ${inner}
        </div>
      `;
    } else if (this.displayType === 'bottom-bar') {
      html += `
        ${this.isOpen ? '' : `
          <div class="nostr-chat-launcher bottom-bar" role="button" aria-label="Open live chat">
            <button class="bar-btn">Live chat</button>
          </div>
        `}
        <div class="nostr-chat-float-panel ${this.isOpen ? 'open' : ''}">
          <button class="nostr-chat-close-btn" title="Minimize">×</button>
          ${inner}
        </div>
      `;
    }

    this.shadowRoot!.innerHTML = html;
    this.attachEventListeners();

    // Scroll to bottom after render
    setTimeout(() => {
      const chatHistory = this.shadowRoot?.querySelector('.nostr-chat-history');
      if (chatHistory) {
        (chatHistory as HTMLElement).scrollTop = (chatHistory as HTMLElement).scrollHeight;
      }
    }, 0);
  }
}

customElements.define("nostr-live-chat", NostrLiveChat);
