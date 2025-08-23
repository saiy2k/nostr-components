/**
 * <nostr-live-chat>
 * Attributes:
 *  - recipient-npub     (optional): pre-set npub of recipient
 *  - recipient-pubkey   (optional): hex recipient pubkey (alias: recipientPubkey)
 *  - nip05              (optional): user@domain nip-05 identifier (alternative to recipient-npub)
 *  - relays             (optional): comma-separated relay URLs (defaults to common public set)
 *  - theme              (optional): "light" | "dark" (default "light")
 *  - display-type       (optional): "fab" | "bottom-bar" | "full" | "embed" (default "embed") (alias: displayType)
 *  - welcome-text       (optional): custom text for the welcome screen
 *  - start-chat-text    (optional): label for the Start button on the welcome screen
 *  - history-days       (optional): positive integer N to load last N days; "all" or <=0 or omitted -> full history
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
  private static readonly DEFAULT_WELCOME_TEXT = "Welcome! How can we help you today?";
  private static readonly DEFAULT_START_CHAT_TEXT = "Start chat";
  private static readonly DEFAULT_ONLINE_TEXT = "We're Online!";
  private static readonly DEFAULT_HELP_TEXT = "How may I help you today?";
  private displayType: 'fab' | 'bottom-bar' | 'full' | 'embed' = 'embed';
  private isOpen: boolean = false; // For floating modes
  private showWelcome: boolean = false; // Show welcome screen before starting chat
  private welcomeText: string = NostrLiveChat.DEFAULT_WELCOME_TEXT;
  private startChatText: string = NostrLiveChat.DEFAULT_START_CHAT_TEXT;
  private onlineText: string = NostrLiveChat.DEFAULT_ONLINE_TEXT;
  private helpText: string = NostrLiveChat.DEFAULT_HELP_TEXT;
  private readonly MESSAGE_MAX_LENGTH = 1000;

  // isLoading -> sending DM, isFinding -> looking up recipient
  private isLoading: boolean = false;
  private isFinding: boolean = false;
  private isError: boolean = false;
  private errorMessage: string = "";
  private recipientError: string = "";

  // Key management options
  private persistKey: boolean = false;
  private keySupplier: (() => string | Promise<string>) | null = null;

  // Event handlers
  private boundHandleFind: (() => void) | null = null;
  private boundHandleSend: (() => void) | null = null;
  private boundHandleTextareaChange: ((e: Event) => void) | null = null;
  private boundHandleLauncherClick: (() => void) | null = null;
  private boundHandleCloseClick: (() => void) | null = null;
  private boundHandleStartChat: (() => void) | null = null;
  private boundHandleNpubKeydown: ((e: Event) => void) | null = null;
  private resubscribeTimer: number | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  getRelays = () => {
    const userRelays = this.getAttribute("relays");
    if (userRelays) {
      return userRelays
        .split(",")
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .filter((r, i, arr) => arr.indexOf(r) === i);
    }
    return DEFAULT_RELAYS;
  };

  private async getCurrentUserInfo(): Promise<void> {
    try {
      const ndk = this.nostrService.getNDK();
      let pubkey: string | null = null;

      if (typeof window !== 'undefined' && (window as any).nostr) {
        const nostr = (window as any).nostr;
        console.log('Nostr extension found, checking for public key...');

        try {
          // Special handling for nos2x extension
          // Check if this is nos2x by looking for specific patterns in the API
          const isNos2x = !!(nostr.enable && typeof nostr.enable === 'function' &&
            nostr.getPublicKey && typeof nostr.getPublicKey === 'function');

          console.log('Is this nos2x extension?', isNos2x);

          if (isNos2x) {
            console.log('Using nos2x specific flow');
            try {
              // First enable the extension
              await nostr.enable();
              console.log('nos2x extension enabled');

              // Use a timeout to ensure extension is ready
              await new Promise(resolve => setTimeout(resolve, 100));

              // Get public key from nos2x
              const nos2xResult = await nostr.getPublicKey();
              console.log('nos2x returned pubkey:', nos2xResult);
              if (nos2xResult && typeof nos2xResult === 'string' && nos2xResult.length === 64) {
                pubkey = nos2xResult;
                console.log('Successfully got pubkey from nos2x:', pubkey);
              }
            } catch (nos2xError) {
              console.error('Error with nos2x extension:', nos2xError);
            }
          } else {
            // Generic extension handling
            // First try to enable the extension if it supports it
            if (typeof nostr.enable === 'function') {
              console.log('Attempting to enable generic extension...');
              try {
                await nostr.enable();
                console.log('Extension enabled successfully');
              } catch (enableError) {
                console.warn('Extension enable failed, continuing anyway:', enableError);
              }
            }

            // Try to get public key
            if (typeof nostr.getPublicKey === 'function') {
              console.log('Calling getPublicKey()...');
              try {
                const result = await nostr.getPublicKey();
                pubkey = result;
                console.log('Got pubkey from extension:', pubkey);
              } catch (getKeyError) {
                console.error('Error getting public key:', getKeyError);
              }
            } else if (nostr.getPublicKey) {
              console.log('Found getPublicKey property, resolving...');
              try {
                pubkey = await Promise.resolve(nostr.getPublicKey);
                console.log('Got pubkey from extension (property):', pubkey);
              } catch (getKeyError) {
                console.error('Error resolving public key:', getKeyError);
              }
            }
          }
        } catch (error) {
          console.error('Error in extension interaction:', error);
          // Don't re-throw, we'll continue with null pubkey
        }
      }

      if (!pubkey) {
        let privateKey: string | null = null;

        // Try in-memory key supplier first
        if (this.keySupplier) {
          try {
            privateKey = await this.keySupplier();
          } catch {
            // ignore key supplier errors
          }
        }

        // Try sessionStorage next (preferred for security)
        if (!privateKey && typeof sessionStorage !== 'undefined') {
          privateKey = sessionStorage.getItem('nostr_nsec');
        }

        // Fall back to localStorage only if persistence is explicitly enabled
        if (!privateKey && this.persistKey && typeof localStorage !== 'undefined') {
          privateKey = localStorage.getItem('nostr_nsec');
          if (privateKey) {
            console.warn('nostr-live-chat: Using persistent private key from localStorage. Consider using sessionStorage or in-memory key supplier for better security.');
          }
        }

        if (privateKey) {
          try {
            const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
            let sk = privateKey;
            if (privateKey.startsWith('nsec')) {
              const decoded = nip19.decode(privateKey);
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
        console.log('Got pubkey from extension and will use it:', pubkey);

        try {
          const user = ndk.getUser({ pubkey });
          console.log('Fetching profile for user:', pubkey);
          await user.fetchProfile();
          console.log('Fetched profile:', user.profile);

          this.currentUserName = user.profile?.displayName || user.profile?.name || this.currentUserNpub?.substring(0, 10) || null;
          this.currentUserPicture = user.profile?.image || null;

          if (!this.currentUserName) {
            console.warn('No username found in profile');
          }
          if (!this.currentUserPicture) {
            console.warn('No profile picture found');
          }

          console.log('Profile info set:', {
            name: this.currentUserName,
            picture: this.currentUserPicture,
            npub: this.currentUserNpub
          });
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Fallback to just showing the npub if we can't fetch the profile
          this.currentUserName = this.currentUserNpub?.substring(0, 10) || null;
        }
        this.render();
      } else {
        console.log('Checking for direct nos2x logs in console...');

        // Try to detect the pubkey from window level objects that nos2x might set
        try {
          // Wait a bit for the extension to initialize
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try again once more with direct extension call
          if (typeof window !== 'undefined' && (window as any).nostr) {
            console.log('Trying direct call to extension again...');
            try {
              const directPubkey = await (window as any).nostr.getPublicKey();
              if (directPubkey && typeof directPubkey === 'string') {
                console.log('Got pubkey on second try:', directPubkey);
                // Call ourselves recursively with the pubkey we found
                this.currentUserPubkey = directPubkey;
                this.currentUserNpub = nip19.npubEncode(directPubkey);

                // Get user profile
                try {
                  const user = ndk.getUser({ pubkey: directPubkey });
                  console.log('Fetching profile for user on second try:', directPubkey);
                  await user.fetchProfile();
                  console.log('Fetched profile on second try:', user.profile);

                  this.currentUserName = user.profile?.displayName || user.profile?.name || this.currentUserNpub?.substring(0, 10) || null;
                  this.currentUserPicture = user.profile?.image || null;

                  this.render();
                  return;
                } catch (profileError) {
                  console.error('Error fetching profile on second try:', profileError);
                  this.currentUserName = this.currentUserNpub?.substring(0, 10) || null;
                  this.render();
                  return;
                }
              }
            } catch (directError) {
              console.error('Error getting pubkey on direct second try:', directError);
            }
          }
        } catch (fallbackError) {
          console.error('Error in fallback pubkey detection:', fallbackError);
        }
        console.warn('No pubkey available from extension - trying fallback method');
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
        const errorMsg = `Invalid recipient pubkey "${recipientPub}": ${e instanceof Error ? e.message : String(e)}`;
        this.recipientError = errorMsg;
        this.isError = true;
        this.errorMessage = errorMsg;
        console.error('nostr-live-chat:', errorMsg, e);
        this.render();
        return; // Stop fallback flow
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
      const onlineAttr = this.getAttribute('online-text');
      if (onlineAttr) this.onlineText = onlineAttr;
      const helpAttr = this.getAttribute('help-text');
      if (helpAttr) this.helpText = helpAttr;
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
      "recipientPubkey", // Alias for recipient-pubkey
      "nip05",
      "relays",
      "theme",
      "display-type",
      "displayType", // Alias for display-type
      "welcome-text",
      "start-chat-text",
      "online-text",      // New: FAB online text
      "help-text",       // New: FAB help text
      "history-days",
    ];
  }

  // Stop any active DM subscription and clear debounce timer
  private unsubscribeFromDms() {
    if (this.dmSubscription) {
      try { this.dmSubscription.stop(); } catch { }
      this.dmSubscription = null;
    }
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
  }

  // Clear all recipient-related and chat UI state
  private clearRecipientAndChatState() {
    this.recipientPubkey = null;
    this.recipientNpub = null;
    this.recipientNip05 = null;
    this.recipientName = null;
    this.recipientPicture = null;
    this.messages = [];
    this.message = "";
    this.showWelcome = false; // reset start chat flag
    this.isLoading = false;
    this.isFinding = false;
    this.isError = false;
    this.errorMessage = "";
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ) {
    if (!this.rendered) return;

    if (name === "recipient-npub") {
      if (newValue === null) {
        // Attribute removed: stop subscription and clear state
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        this.render();
        return;
      }
      if (newValue !== _oldValue) {
        // Changed: stop subscription, clear state, then lookup new recipient
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        this.recipientNpub = newValue!;
        this.lookupRecipient();
      }
      return;
    } else if (name === 'recipient-pubkey' || name === 'recipientPubkey') {
      if (newValue === null) {
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        this.render();
        return;
      }
      if (newValue !== _oldValue) {
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        try {
          this.recipientPubkey = newValue!;
          this.recipientNpub = nip19.npubEncode(newValue!);
          this.lookupRecipient(this.recipientNpub);
        } catch {
          // ignore invalid value
        }
      }
      return;
    } else if (name === "nip05") {
      if (newValue === null) {
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        this.render();
        return;
      }
      if (newValue !== _oldValue) {
        this.unsubscribeFromDms();
        this.clearRecipientAndChatState();
        this.recipientNip05 = newValue!;
        this.lookupRecipientByNip05();
      }
      return;
    } else if (name === "relays") {
      if (newValue !== _oldValue) {
        const relays = this.getRelays();
        const chatActive = this.recipientPubkey && !this.showWelcome;
        if (chatActive) {
          if (this.resubscribeTimer) {
            clearTimeout(this.resubscribeTimer);
          }
          this.resubscribeTimer = window.setTimeout(() => {
            // Unsubscribe from current DMs, reconnect to new relays, then resubscribe
            this.unsubscribeFromDms();
            this.nostrService.connectToNostr(relays);
            this.subscribeToDms();
          }, 300);
        } else {
          this.nostrService.connectToNostr(relays);
        }
      }
    } else if (name === "theme") {
      this.getTheme();
      this.render();
    } else if (name === 'display-type' || name === 'displayType') {
      this.getDisplayType();
      this.render();
    } else if (name === 'welcome-text') {
      // Reset to default when attribute is removed (newValue === null)
      this.welcomeText = newValue !== null ? newValue : NostrLiveChat.DEFAULT_WELCOME_TEXT;
      this.render();
    } else if (name === 'start-chat-text') {
      // Reset to default when attribute is removed (newValue === null)
      this.startChatText = newValue !== null ? newValue : NostrLiveChat.DEFAULT_START_CHAT_TEXT;
      this.render();
    } else if (name === 'online-text') {
      // Reset to default when attribute is removed (newValue === null)
      this.onlineText = newValue !== null ? newValue : NostrLiveChat.DEFAULT_ONLINE_TEXT;
      this.render();
    } else if (name === 'help-text') {
      // Reset to default when attribute is removed (newValue === null)
      this.helpText = newValue !== null ? newValue : NostrLiveChat.DEFAULT_HELP_TEXT;
      this.render();
    } else if (name === 'history-days') {
      // If history window changes while a chat is active, resubscribe to reload history (debounced)
      if (newValue !== _oldValue && this.recipientPubkey && !this.showWelcome) {
        if (this.resubscribeTimer) {
          clearTimeout(this.resubscribeTimer);
        }
        this.resubscribeTimer = window.setTimeout(() => {
          this.subscribeToDms();
        }, 250);
      }
    }
  }

  private async lookupRecipient(npub?: string) {
    // Stop any existing DM subscription and reset chat state before new lookup
    this.unsubscribeFromDms();
    this.messages = [];
    this.showWelcome = false;

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

      let encryptionSucceeded = false;

      // Try NIP-07 encryption first if available
      if (typeof (window as any).nostr?.nip04?.encrypt === 'function') {
        try {
          event.content = await (window as any).nostr.nip04.encrypt(
            this.recipientPubkey!,
            this.message.trim()
          );
          encryptionSucceeded = true;
        } catch (e: any) {
          console.error("NIP-07 encryption failed, falling back to local encryption:", e);
        }
      }

      // Fall back to local encryption if NIP-07 failed or unavailable
      if (!encryptionSucceeded) {
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
    this.message = textarea.value;

    // Update character counter
    const remaining = Math.max(0, this.MESSAGE_MAX_LENGTH - this.message.length);
    const counterEl = this.shadowRoot?.querySelector('.nostr-chat-char-counter');
    if (counterEl) {
      counterEl.textContent = `${remaining} chars left`;
      counterEl.classList.toggle('warn', remaining <= 10);
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
      if (typeof window !== 'undefined' && (window as any).nostr && (window as any).nostr.getPublicKey) {
        const pubkey = await (window as any).nostr.getPublicKey();
        currentUser = { pubkey };
      } else {
        let privateKey: string | null = null;

        // Try in-memory key supplier first
        if (this.keySupplier) {
          try {
            privateKey = await this.keySupplier();
          } catch {
            // ignore key supplier errors
          }
        }

        // Try sessionStorage next (preferred for security)
        if (!privateKey && typeof sessionStorage !== 'undefined') {
          privateKey = sessionStorage.getItem('nostr_nsec');
        }

        // Fall back to localStorage only if persistence is explicitly enabled
        if (!privateKey && this.persistKey && typeof localStorage !== 'undefined') {
          privateKey = localStorage.getItem('nostr_nsec');
          if (privateKey) {
            console.warn('nostr-live-chat: Using persistent private key from localStorage for DM subscription. Consider using sessionStorage or in-memory key supplier for better security.');
          }
        }

        if (privateKey) {
          const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
          let sk = privateKey;
          if (privateKey.startsWith('nsec')) {
            const decoded = nip19.decode(privateKey);
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

    // Determine history window from attribute: default full history when unset; numeric days > 0 => limit; 'all' or <=0 => full
    const historyDaysAttr = this.getAttribute('history-days');
    let since: number | undefined;
    if (!historyDaysAttr) {
      since = undefined; // attribute not set -> full history
    } else if (historyDaysAttr.toLowerCase() === 'all' || parseInt(historyDaysAttr, 10) <= 0) {
      since = undefined; // omit since -> full history
    } else {
      const historyDays = Math.max(1, parseInt(historyDaysAttr, 10) || 30);
      since = Math.floor((Date.now() - historyDays * 24 * 60 * 60 * 1000) / 1000);
    }

    // Base filters
    const baseFilter1: NDKFilter = {
      kinds: [NDKKind.EncryptedDirectMessage],
      '#p': [currentUser.pubkey],
      authors: [this.recipientPubkey!],
    };
    const baseFilter2: NDKFilter = {
      kinds: [NDKKind.EncryptedDirectMessage],
      '#p': [this.recipientPubkey!],
      authors: [currentUser.pubkey],
    };

    // Conditionally include since
    const filter1: NDKFilter = since !== undefined ? { ...baseFilter1, since } : baseFilter1;
    const filter2: NDKFilter = since !== undefined ? { ...baseFilter2, since } : baseFilter2;

    this.dmSubscription = this.nostrService.getNDK().subscribe([filter1, filter2], {
      closeOnEose: false,
      groupable: false
    });

    this.dmSubscription.on('event', async (event: NDKEvent) => {
      try {
        // Update current user info if missing
        if (!this.currentUserPubkey && currentUser) {
          this.currentUserPubkey = currentUser.pubkey;
          this.currentUserNpub = nip19.npubEncode(currentUser.pubkey);
        }
        // Determine if we are the sender or receiver of the event
        const isSender = event.pubkey === currentUser.pubkey;
        const peer = isSender ? event.tags.find(t => t[0] === 'p')?.[1] : event.pubkey;

        // Guard: malformed event without a peer (missing 'p' tag or pubkey)
        if (!peer) {
          try { console.debug('nostr-live-chat: skipping event with missing peer', event.id); } catch { }
          return;
        }

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

        // Guard again before any decryption — never decrypt with a missing peer
        if (!peer) {
          try { console.debug('nostr-live-chat: missing peer prior to decrypt, skipping', event.id); } catch { }
          return;
        }

        // Guard against missing or empty content before decryption
        if (!event.content || event.content.trim() === '') {
          try { console.debug('nostr-live-chat: missing or empty content prior to decrypt, skipping', event.id); } catch { }
          return;
        }

        if ((window as any).nostr && (window as any).nostr.nip04 && typeof (window as any).nostr.nip04.decrypt === "function") {
          try {
            decryptedText = await (window as any).nostr.nip04.decrypt(
              peer,
              event.content
            );
          } catch (e: any) {
            console.error("Failed to decrypt DM content:", e);
            return;
          }
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
            peer,
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
    if (closeBtn) {
      if (this.boundHandleCloseClick) closeBtn.removeEventListener('click', this.boundHandleCloseClick);
      this.boundHandleCloseClick = (e?: Event) => {
        e?.stopPropagation();
        if (this.displayType === 'fab' || this.displayType === 'bottom-bar') {
          this.isOpen = false;
        }
        this.render();
      };
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

    const npubInput = this.shadowRoot!.querySelector(".nostr-chat-npub-input") as HTMLElement | null;
    if (npubInput) {
      if (this.boundHandleNpubKeydown) npubInput.removeEventListener("keydown", this.boundHandleNpubKeydown);
      this.boundHandleNpubKeydown = (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Enter") this.handleFindClick();
      };
      npubInput.addEventListener("keydown", this.boundHandleNpubKeydown as EventListener);
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

    const startBtn = this.shadowRoot?.querySelector('.nostr-chat-start-btn');
    if (startBtn && this.boundHandleStartChat) startBtn.removeEventListener('click', this.boundHandleStartChat);

    const textarea = this.shadowRoot?.querySelector(".nostr-chat-textarea");
    if (textarea && this.boundHandleTextareaChange) textarea.removeEventListener("input", this.boundHandleTextareaChange);
    const npubInput = this.shadowRoot?.querySelector('.nostr-chat-npub-input') as HTMLElement | null;
    if (npubInput && this.boundHandleNpubKeydown) npubInput.removeEventListener('keydown', this.boundHandleNpubKeydown as EventListener);
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
  }

  // Public methods for key management configuration
  public setPersistKey(persist: boolean): void {
    this.persistKey = persist;
  }

  public setKeySupplier(supplier: (() => string | Promise<string>) | null): void {
    this.keySupplier = supplier;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      onlineText: this.onlineText,
      helpText: this.helpText,
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
              <div class="title">${this.escapeHtml(this.onlineText)}</div>
              <div class="subtitle">${this.escapeHtml(this.helpText)}</div>
            </div>
            <button class="fab-btn" aria-label="Open chat">💬</button>
          </div>
        `}
        <div class="nostr-chat-float-panel ${this.isOpen ? 'open' : ''}">
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
