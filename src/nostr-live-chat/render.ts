import { Theme } from "../common/types";
import { getLoadingNostrich, getNostrLogo } from "../common/theme";

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return '';
  }
}

/**
 * Format timestamp as relative time (e.g., "2 mins ago", "1 month ago")
 * @param ts Timestamp in seconds
 * @returns Formatted relative time string
 */
function formatRelativeTime(ts: number): string {
  try {
    const now = Date.now();
    const messageTime = ts * 1000;
    const diffMs = now - messageTime;

    // Convert to seconds
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return 'just now';
    }

    // Minutes
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    }

    // Hours
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }

    // Days
    if (diffSec < 2592000) { // ~30 days
      const days = Math.floor(diffSec / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }

    // Months
    if (diffSec < 31536000) { // ~365 days
      const months = Math.floor(diffSec / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }

    // Years
    const years = Math.floor(diffSec / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } catch {
    return '';
  }
}

// Whitelist sender to avoid injecting untrusted values into class names
function safeSenderClass(sender: string): 'me' | 'them' {
  if (sender === 'me' || sender === 'them') return sender;
  // Default to 'them' for unknown values to ensure safe styling
  return 'them';
}

export interface RenderLiveChatOptions {
  theme: Theme;
  recipientNpub: string | null;
  recipientName: string | null;
  recipientPicture: string | null;
  message: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isFinding: boolean;
  isError: boolean;
  errorMessage: string;
  currentUserName?: string | null;
  currentUserPicture?: string | null;
  showWelcome?: boolean;
  welcomeText?: string;
  startChatText?: string;
  onlineText?: string;
  helpText?: string;
  maxMessageLength: number;
}

/**
 * Sanitizes a string to prevent XSS attacks
 * @param input String to sanitize
 * @returns Sanitized string with HTML special characters escaped
 */
function sanitizeHtml(input: string | null | undefined): string {
  if (input === null || input === undefined) {
    return '';
  }
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderLiveChat({
  theme,
  recipientNpub,
  recipientName,
  recipientPicture,
  message,
  messages,
  isLoading,
  isFinding,
  isError,
  errorMessage,
  currentUserName,
  currentUserPicture,
  showWelcome,
  welcomeText,
  startChatText,
  onlineText,
  helpText,
  maxMessageLength,
}: RenderLiveChatOptions): string {
  // Build inner chat UI only
  const { onlineText: _, helpText: __, ...innerOptions } = {
    theme,
    recipientNpub,
    recipientName,
    recipientPicture,
    message,
    messages,
    isLoading,
    isFinding,
    isError,
    errorMessage,
    currentUserName,
    currentUserPicture,
    showWelcome,
    welcomeText,
    startChatText,
    onlineText,
    helpText,
    maxMessageLength,
  };
  const inner = renderLiveChatInner(innerOptions);

  // Include styles + inner UI (legacy behavior)
  return `
    ${getLiveChatStyles(theme)}
    ${inner}
  `;
}

// Returns only the chat UI (no <style>) for composing inside wrappers
export function renderLiveChatInner({
  theme,
  recipientNpub,
  recipientName,
  recipientPicture,
  message,
  messages,
  isLoading,
  isFinding,
  isError,
  errorMessage,
  currentUserName,
  currentUserPicture,
  showWelcome,
  welcomeText,
  startChatText,
  maxMessageLength,
}: Omit<RenderLiveChatOptions, 'onlineText' | 'helpText'>): string {
  const iconSize = 24;
  const maxLen = typeof maxMessageLength === 'number' ? maxMessageLength : 1000;
  const typed = (message || '').length;
  const remaining = Math.max(0, maxLen - typed);
  // Use warn class when remaining characters are <= 10
  const counterClass = remaining <= 10 ? 'nostr-chat-char-counter warn' : 'nostr-chat-char-counter';

  return `
    <div class="nostr-chat-container ${isError ? "nostr-chat-error" : ""}">
      <div class="nostr-chat-header">
        <div class="nostr-chat-header-left">
          ${recipientNpub && recipientName
      ? `
            <div class="nostr-chat-recipient">
              <div class="nostr-chat-recipient-info">
                <img 
                  src="${sanitizeHtml(recipientPicture) || ''}" 
                  alt="${sanitizeHtml(recipientName) || ''}" 
                  class="nostr-chat-recipient-avatar"
                  onerror="this.onerror=null; this.src='https://via.placeholder.com/40';"
                >
                <span class="nostr-chat-recipient-name">${sanitizeHtml(recipientName) || sanitizeHtml(recipientNpub)}</span>
              </div>
            </div>
          `
      : `
            <div class="nostr-chat-recipient-placeholder">
              ${getNostrLogo(iconSize, iconSize)}
              <span>Nostr Live Chat</span>
            </div>
          `
    }
        </div>
        <div class="nostr-chat-header-right">
          ${currentUserName
      ? `
          <div class="nostr-chat-self">
            <img 
              src="${sanitizeHtml(currentUserPicture) || ''}"
              alt="${sanitizeHtml(currentUserName) || 'You'}"
              class="nostr-chat-self-avatar"
              onerror="this.onerror=null; this.src='https://via.placeholder.com/32';"
            >
            <span class="nostr-chat-self-name">${sanitizeHtml(currentUserName)}</span>
          </div>
        ` : ''
    }
          <button class="nostr-chat-close-btn" title="Minimize">×</button>
        </div>
      </div>

      <div class="nostr-chat-content">
        ${!recipientNpub
      ? `
          <div class="nostr-chat-npub-input-container">
            <input type="text" class="nostr-chat-npub-input" placeholder="Enter recipient's npub/nip05 address..." />
            <button class="nostr-chat-find-btn" ${isFinding ? "disabled" : ""}>
              ${isFinding
        ? `${getLoadingNostrich()} <span>Finding...</span>`
        : `<span>Find</span>`
      }
            </button>
          </div>
        `
      : showWelcome
        ? `
          <div class="nostr-chat-welcome">
            <div class="nostr-chat-welcome-text">${sanitizeHtml(welcomeText) || 'Welcome!'}</div>
            <button class="nostr-chat-start-btn">${sanitizeHtml(startChatText) || 'Start chat'}</button>
          </div>
        `
        : `
          <div class="nostr-chat-history">
            ${messages.map(msg => `
              <div class="nostr-chat-message-row nostr-chat-message-${safeSenderClass((msg as any).sender)} ${msg.sender === 'me' && msg.status === 'sending' ? 'sending' : ''} ${msg.sender === 'me' && msg.status === 'failed' ? 'failed' : ''}">
                <div class="nostr-chat-message-bubble">${sanitizeHtml(msg.text)}</div>
                <div class="nostr-chat-message-meta">
                  <span class="nostr-chat-message-timestamp" title="${sanitizeHtml(formatTimestamp(msg.timestamp))}">${sanitizeHtml(formatRelativeTime(msg.timestamp))}</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="nostr-chat-actions">
            <textarea 
              class="nostr-chat-textarea" 
              placeholder="Type your message..."
              maxlength="${maxLen}"
            >${sanitizeHtml(message)}</textarea>
            <div class="${counterClass}" aria-live="polite">${remaining} chars left</div>
            <button class="nostr-chat-send-btn" ${isLoading ? "disabled" : ""}>
              ${isLoading
          ? getLoadingNostrich()
          : `Send`
        }
            </button>
          </div>
        `
    }
      </div>

      ${isError ? `<small class="nostr-chat-error-message">${sanitizeHtml(errorMessage)}</small>` : ""}
    </div>
  `;
}

export function getLiveChatStyles(theme: Theme): string {
  return `
    <style>
      :host {
        --nstrc-chat-background-dark: #222222;
        --nstrc-chat-background-light: #FFFFFF;
        --nstrc-chat-text-color-dark: #FFFFFF;
        --nstrc-chat-text-color-light: #000000;
        --nstrc-chat-border-dark: 1px solid #444444;
        --nstrc-chat-border-light: 1px solid #DDDDDD;
        --nstrc-chat-input-background-dark: #333333;
        --nstrc-chat-input-background-light: #F9F9F9;
        --nstrc-chat-my-message-background-dark: #5A3E85;
        --nstrc-chat-my-message-background-light: #E6DDF4;
        /* Unified accent variables with light/dark variants */
        --nstrc-chat-accent-color-dark: #5A3E85;
        --nstrc-chat-accent-color-light: #7E4FD2;
        --nstrc-chat-accent-text-color-dark: #FFFFFF;
        --nstrc-chat-accent-text-color-light: #FFFFFF;
        --nstrc-chat-their-message-background-dark: #3A3A3A;
        --nstrc-chat-their-message-background-light: #F0F0F0;
        --nstrc-chat-button-background-dark: #5A3E85;
        --nstrc-chat-button-background-light: #7E4FD2;
        --nstrc-chat-button-text-dark: #FFFFFF;
        --nstrc-chat-button-text-light: #FFFFFF;
        --nstrc-chat-error-color: #FF4D4F;
        --nstrc-chat-border-radius: 12px;
        
        --nstrc-chat-background: var(--nstrc-chat-background-${theme});
        --nstrc-chat-text-color: var(--nstrc-chat-text-color-${theme});
        --nstrc-chat-border: var(--nstrc-chat-border-${theme});
        --nstrc-chat-input-background: var(--nstrc-chat-input-background-${theme});
        --nstrc-chat-my-message-background: var(--nstrc-chat-my-message-background-${theme});
        --nstrc-chat-their-message-background: var(--nstrc-chat-their-message-background-${theme});
        --nstrc-chat-button-background: var(--nstrc-chat-button-background-${theme});
        --nstrc-chat-button-text: var(--nstrc-chat-button-text-${theme});
        --nstrc-chat-accent-color: var(--nstrc-chat-accent-color-${theme});
        --nstrc-chat-accent-text-color: var(--nstrc-chat-accent-text-color-${theme});
      }

      /* Floating modes shrink the host so it doesn't affect page layout */
      :host([display-type="fab"]),
      :host([display-type="bottom-bar"]),
      :host([display-type="full"]) {
        width: 0;
        height: 0;
      }

      /* Floating panel wrapper */
      .nostr-chat-float-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        border-radius: var(--nstrc-chat-border-radius);
        display: none;
      }
      .nostr-chat-float-panel.open { display: block; }

      /* Close (minimize) button for floating panel */
      .nostr-chat-close-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
        cursor: pointer;
        background: rgba(0,0,0,0.1);
        color: var(--nstrc-chat-text-color);
        border: none;
        transition: background-color 0.2s ease;
      }
      .nostr-chat-close-btn:hover {
        background: rgba(0,0,0,0.2);
      }
      
      /* Hide close button in embed mode */
      :host([display-type="embed"]) .nostr-chat-close-btn {
        display: none;
      }

      /* Launcher: FAB */
      .nostr-chat-launcher.fab {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: Inter, sans-serif;
      }
      .nostr-chat-launcher .bubble {
        background: var(--nstrc-chat-background);
        color: var(--nstrc-chat-text-color);
        border: var(--nstrc-chat-border);
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
      }
      .nostr-chat-launcher .bubble .title { font-weight: 700; font-size: 14px; }
      .nostr-chat-launcher .bubble .subtitle { font-size: 12px; opacity: 0.8; }
      .nostr-chat-launcher .fab-btn {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--nstrc-chat-accent-color);
        color: var(--nstrc-chat-accent-text-color);
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        font-size: 24px; /* Larger emoji/icon */
      }

      /* Launcher: Bottom bar */
      .nostr-chat-launcher.bottom-bar {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 20px;
        z-index: 2147483000;
      }
      .nostr-chat-launcher .bar-btn {
        padding: 12px 20px;
        border-radius: 999px;
        background: var(--nstrc-chat-accent-color);
        color: var(--nstrc-chat-accent-text-color);
        border: none;
        cursor: pointer;
        font-weight: 700;
        box-shadow: 0 6px 20px rgba(0,0,0,0.18);
      }

      .nostr-chat-container {
        display: flex;
        flex-direction: column;
        font-family: Inter, sans-serif;
        width: 100%;
        height: 100%;
        max-width: 400px;
        max-height: 600px;
        box-sizing: border-box;
        border-radius: var(--nstrc-chat-border-radius);
        border: var(--nstrc-chat-border);
        background-color: var(--nstrc-chat-background);
        color: var(--nstrc-chat-text-color);
        overflow: hidden;
      }

      .nostr-chat-header {
        padding: 12px 16px;
        border-bottom: var(--nstrc-chat-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      
      .nostr-chat-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nostr-chat-recipient, .nostr-chat-recipient-placeholder {
        display: flex;
        align-items: center; /* Ensures vertical centering */
        gap: 12px;
      }

      .nostr-chat-recipient-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-chat-recipient-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .nostr-chat-recipient-name {
        font-weight: 600;
        font-size: 16px;
        display: flex;
        align-items: center;
        height: 36px; /* Match avatar height */
      }

      .nostr-chat-self {
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0.85;
        font-size: 12px;
      }
      .nostr-chat-self-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-chat-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex-grow: 1;
        overflow-y: auto;
      }
      
      /* Scrollbar styling for dark theme */
      .nostr-chat-content::-webkit-scrollbar,
      .nostr-chat-history::-webkit-scrollbar {
        width: 8px;
      }
      .nostr-chat-content::-webkit-scrollbar-track,
      .nostr-chat-history::-webkit-scrollbar-track {
        background: transparent;
      }
      .nostr-chat-content::-webkit-scrollbar-thumb,
      .nostr-chat-history::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .nostr-chat-content::-webkit-scrollbar-thumb:hover,
      .nostr-chat-history::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .nostr-chat-history {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex-grow: 1;
        overflow-y: auto;
        padding-right: 10px; /* For scrollbar */
        padding-bottom: 16px;
      }

      .nostr-chat-message-row {
        display: flex;
        width: 100%;
        flex-direction: column;
        align-items: flex-start;
      }

      .nostr-chat-message-me {
        justify-content: flex-end;
        align-items: flex-end;
      }

      .nostr-chat-message-them {
        justify-content: flex-start;
        align-items: flex-start;
      }

      .nostr-chat-message-bubble {
        padding: 8px 12px;
        border-radius: 18px;
        max-width: 75%;
        word-wrap: break-word;
      }

      .nostr-chat-message-me .nostr-chat-message-bubble {
        background-color: var(--nstrc-chat-accent-color);
        color: var(--nstrc-chat-accent-text-color);
        border-radius: 15px 15px 0 15px;
        opacity: 1;
      }

      .nostr-chat-message-me.sending .nostr-chat-message-bubble {
        opacity: 0.5;
      }

      .nostr-chat-message-me.failed .nostr-chat-message-bubble {
        opacity: 1;
        border: 1px dashed var(--nstrc-chat-error-color);
      }

      .nostr-chat-message-them .nostr-chat-message-bubble {
        background-color: var(--nstrc-chat-their-message-background);
        border-bottom-left-radius: 4px;
      }

      /* Message timestamp under bubble, always visible but with opacity change on hover */
      .nostr-chat-message-meta {
        font-size: 10px;
        margin-top: 4px;
        opacity: 0.5;
        color: var(--nstrc-chat-text-color);
        max-width: 75%;
        transition: opacity 0.2s ease;
        height: 14px; /* Fixed height to prevent layout jumps */
      }
      .nostr-chat-message-row:hover .nostr-chat-message-meta {
        opacity: 0.9;
      }
      .nostr-chat-message-me .nostr-chat-message-meta {
        text-align: right;
      }
      .nostr-chat-message-them .nostr-chat-message-meta {
        text-align: left;
      }

      /* Slightly highlight timestamp for the last message */
      .nostr-chat-history > .nostr-chat-message-row:last-of-type .nostr-chat-message-meta {
        opacity: 0.75;
      }

      .nostr-chat-npub-input-container {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 20px 0;
      }

      .nostr-chat-npub-input {
        flex: 1;
        padding: 10px;
        box-sizing: border-box;
        border-radius: 4px;
        border: var(--nstrc-chat-border);
        background-color: var(--nstrc-chat-input-background);
        color: var(--nstrc-chat-text-color);
      }

      .nostr-chat-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
        border-top: var(--nstrc-chat-border);
        padding-top: 12px;
      }

      .nostr-chat-welcome {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 12px 8px;
      }
      .nostr-chat-welcome-text {
        opacity: 0.9;
      }
      .nostr-chat-start-btn {
        padding: 10px 16px;
        border-radius: 20px;
        border: none;
        background-color: var(--nstrc-chat-button-background);
        color: var(--nstrc-chat-button-text);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }

      .nostr-chat-textarea {
        flex-grow: 1;
        height: 40px;
        box-sizing: border-box;
        padding: 10px;
        border-radius: 20px;
        border: var(--nstrc-chat-border);
        background-color: var(--nstrc-chat-input-background);
        color: var(--nstrc-chat-text-color);
        font-family: Inter, sans-serif;
        resize: none;
        overflow-y: auto;
      }

      /* Character counter */
      .nostr-chat-char-counter {
        align-self: center;
        font-size: 12px;
        opacity: 0.75;
        color: var(--nstrc-chat-text-color);
        white-space: nowrap;
        min-width: max-content;
      }
      .nostr-chat-char-counter.warn {
        color: #ff8c00; /* Brighter orange color for warning */
        opacity: 1;
        font-weight: 700;
      }

      .nostr-chat-find-btn, .nostr-chat-send-btn {
        padding: 10px 16px;
        border-radius: 20px;
        border: none;
        background-color: var(--nstrc-chat-button-background);
        color: var(--nstrc-chat-button-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }

      .nostr-chat-error-message {
        color: var(--nstrc-chat-error-color);
        font-size: 14px;
        padding: 0 16px 16px;
        text-align: center;
      }
    </style>
  `;
}
