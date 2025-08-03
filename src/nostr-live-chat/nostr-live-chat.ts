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
import { renderLiveChat, RenderLiveChatOptions } from "./render";
import { nip19 } from "nostr-tools";
import { NostrService } from "../common/nostr-service";

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  status: 'sending' | 'sent';
}

// ---------------------------------------------------------------------------
// nip05 resolution helper – very lightweight fetch to /.well-known/nostr.json
// ---------------------------------------------------------------------------
async function resolveNip05(nip05: string): Promise<string> {
  const [name, domain] = nip05.split("@");
  if (!domain) throw new Error("Invalid nip05");
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Unable to resolve nip05");
  const json = await res.json();
  const pubkey = json.names?.[name];
  if (!pubkey) throw new Error("nip05 not found");
  return pubkey as string;
}

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

  // isLoading -> sending DM, isFinding -> looking up recipient
  private isLoading: boolean = false;
  private isFinding: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = "";

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
      this.getTheme();
      this.getRecipient();
      this.nostrService.connectToNostr(this.getRelays());
      this.render();
      this.rendered = true;
    }
  }

  static get observedAttributes() {
    return ["recipient-npub", "nip05", "relays", "theme"];
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
    } else if (name === "nip05" && newValue) {
      this.recipientNip05 = newValue;
      this.lookupRecipientByNip05();
    } else if (name === "relays") {
      this.nostrService.connectToNostr(this.getRelays());
    } else if (name === "theme") {
      this.getTheme();
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
      this.render(); // Re-render to show profile info
      
      this.subscribeToDms();
      
      this.subscribeToDms();

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

    this.isLoading = true;
    this.render();

    try {
      const ndk = this.nostrService.getNDK();
      let signer;
      if ((window as any).nostr) {
        signer = new NDKNip07Signer();
      } else {
        const stored = localStorage.getItem("nostr_nsec");
        if (stored) {
          const { NDKPrivateKeySigner } = await import("@nostr-dev-kit/ndk");
          signer = new NDKPrivateKeySigner(stored);
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

      const tempId = `temp_${Date.now()}`;
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
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private handleTextareaChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.message = textarea.value;
  }

  private async subscribeToDms() {
    if (this.dmSubscription) {
      this.dmSubscription.stop();
    }
    if (!this.recipientPubkey) return;

    const signer = new NDKNip07Signer();
    const currentUser = await signer.user();

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
    };

    this.shadowRoot!.innerHTML = renderLiveChat(renderOptions);
    this.attachEventListeners();

    // Scroll to bottom after render
    setTimeout(() => {
      const chatHistory = this.shadowRoot?.querySelector('.nostr-chat-history');
      if (chatHistory) {
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }
    }, 0);
  }
}

customElements.define("nostr-live-chat", NostrLiveChat);
