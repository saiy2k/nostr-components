import { Theme } from "../common/types";
import { getLoadingNostrich, getNostrLogo } from "../common/theme";

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  status: 'sending' | 'sent';
}

export interface RenderLiveChatOptions {
  theme: Theme;
  recipientNpub: string | null;
  recipientName: string | null;
  recipientPicture: string | null;
  message: string;
  messages: Message[];
  isLoading: boolean;
  isFinding: boolean;
  isError: boolean;
  errorMessage: string;
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
}: RenderLiveChatOptions): string {
  const iconSize = 24;



  return `
    ${getLiveChatStyles(theme)}
    <div class="nostr-chat-container ${isError ? "nostr-chat-error" : ""}">
      <div class="nostr-chat-header">
        ${
          recipientNpub && recipientName
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

      <div class="nostr-chat-content">
        ${
          !recipientNpub
            ? `
          <div class="nostr-chat-npub-input-container">
            <input type="text" class="nostr-chat-npub-input" placeholder="Enter recipient's npub/nip05 address..." />
            <button class="nostr-chat-find-btn" ${isFinding ? "disabled" : ""}>
              ${
                isFinding
                  ? `${getLoadingNostrich(theme, iconSize, iconSize)} <span>Finding...</span>`
                  : `<span>Find</span>`
              }
            </button>
          </div>
        `
            : `
          <div class="nostr-chat-history">
            ${messages.map(msg => `
              <div class="nostr-chat-message-row nostr-chat-message-${msg.sender} ${msg.sender === 'me' && msg.status === 'sending' ? 'sending' : ''}">
                <div class="nostr-chat-message-bubble">${sanitizeHtml(msg.text)}</div>
              </div>
            `).join('')}
          </div>
          <div class="nostr-chat-actions">
            <textarea 
              class="nostr-chat-textarea" 
              placeholder="Type your message..."
            >${sanitizeHtml(message)}</textarea>
            <button class="nostr-chat-send-btn" ${isLoading ? "disabled" : ""}>
              ${
                isLoading
                  ? getLoadingNostrich(theme, 16, 16)
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
        --nostr-chat-accent-color: #8a2be2;
        --nostr-chat-accent-text-color: #FFFFFF;
        --nstrc-chat-text-color-light: #000000;
        --nstrc-chat-border-dark: 1px solid #444444;
        --nstrc-chat-border-light: 1px solid #DDDDDD;
        --nstrc-chat-input-background-dark: #333333;
        --nstrc-chat-input-background-light: #F9F9F9;
        --nstrc-chat-my-message-background-dark: #5A3E85;
        --nstrc-chat-my-message-background-light: #E6DDF4;
        --nostr-chat-accent-color: #8a2be2;
        --nostr-chat-accent-text-color: #ffffff;
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
        flex-shrink: 0;
      }

      .nostr-chat-recipient, .nostr-chat-recipient-placeholder {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nostr-chat-recipient-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-chat-recipient-name {
        font-weight: 600;
        font-size: 16px;
      }

      .nostr-chat-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex-grow: 1;
        overflow-y: auto;
      }
      
      .nostr-chat-history {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex-grow: 1;
        overflow-y: auto;
        padding-right: 10px; /* For scrollbar */
      }

      .nostr-chat-message-row {
        display: flex;
        width: 100%;
      }

      .nostr-chat-message-me {
        justify-content: flex-end;
      }

      .nostr-chat-message-them {
        justify-content: flex-start;
      }

      .nostr-chat-message-bubble {
        padding: 8px 12px;
        border-radius: 18px;
        max-width: 75%;
        word-wrap: break-word;
      }

      .nostr-chat-message-me .nostr-chat-message-bubble {
        background-color: var(--nostr-chat-accent-color, #8a2be2);
        color: var(--nostr-chat-accent-text-color, #ffffff);
        border-radius: 15px 15px 0 15px;
        opacity: 1;
      }

      .nostr-chat-message-me.sending .nostr-chat-message-bubble {
        opacity: 0.5;
      }

      .nostr-chat-message-them .nostr-chat-message-bubble {
        background-color: var(--nstrc-chat-their-message-background);
        border-bottom-left-radius: 4px;
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
