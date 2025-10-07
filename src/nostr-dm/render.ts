import { Theme } from "../common/types";
import { getLoadingNostrich, getNostrLogo } from "../common/theme";

export interface RenderDmOptions {
  theme: Theme;
  recipientNpub: string | null;
  recipientName: string | null;
  recipientPicture: string | null;
  message: string;
  isLoading: boolean;
  isFinding: boolean;
  isError: boolean;
  errorMessage: string;
  isSent: boolean;
}

export function renderDm({
  theme,
  recipientNpub,
  recipientName,
  recipientPicture,
  message,
  isLoading,
  isFinding,
  isError,
  errorMessage,
  isSent,
}: RenderDmOptions): string {
  const buttonText = isLoading ? "Sending..." : "Send DM";
  const iconSize = 24;
  const placeholderText = recipientNpub
    ? "Type your message here..."
    : "Enter recipient npub/nip05 address...";

  return `
    ${getDmStyles(theme)}
    <div class="nostr-dm-container ${isError ? "nostr-dm-error" : ""}">
      <div class="nostr-dm-header">
        ${
          recipientNpub && recipientName
            ? `
          <div class="nostr-dm-recipient">
            <img 
              src="${recipientPicture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"}" 
              alt="${recipientName}" 
              class="nostr-dm-recipient-avatar"
              onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23ccc\' d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\'/%3E%3C/svg%3E';"
            />
            <span class="nostr-dm-recipient-name">${recipientName}</span>
          </div>
        `
            : `
          <div class="nostr-dm-recipient-placeholder">
            ${getNostrLogo(iconSize, iconSize)}
            <span>Nostr Direct Message</span>
          </div>
        `
        }
      </div>

      <div class="nostr-dm-content">
        ${
          !recipientNpub
            ? `
          <div class="nostr-dm-npub-input-container">
            <input type="text" class="nostr-dm-npub-input" placeholder="Enter recipient's npub/nip05 address..." />
            <button class="nostr-dm-find-btn" ${isFinding ? "disabled" : ""}>
              ${
                isFinding
                  ? `${getLoadingNostrich()} <span>Finding...</span>`
                  : `${getNostrLogo(iconSize, iconSize)} <span>Find</span>`
              }
            </button>
          </div>
        `
            : ""
        }
        
        <textarea 
          class="nostr-dm-textarea" 
          placeholder="${placeholderText}"
          ${!recipientNpub ? "disabled" : ""}
        >${message}</textarea>
        
        <div class="nostr-dm-actions">
          <button class="nostr-dm-send-btn" ${!recipientNpub || isLoading ? "disabled" : ""}>
            ${
              isLoading
                ? `${getLoadingNostrich()} <span>Sending...</span>`
                : `${getNostrLogo(iconSize, iconSize)} <span>${buttonText}</span>`
            }
          </button>
        </div>
      </div>

      ${isError ? `<small class="nostr-dm-error-message">${errorMessage}</small>` : ""}
      ${isSent ? `<small class="nostr-dm-success-message">Message sent successfully!</small>` : ""}
    </div>
  `;
}

export function getDmStyles(theme: Theme): string {
  return `
    <style>
      :host {
        --nstrc-dm-background-dark: #222222;
        --nstrc-dm-background-light: #FFFFFF;
        --nstrc-dm-text-color-dark: #FFFFFF;
        --nstrc-dm-text-color-light: #000000;
        --nstrc-dm-border-dark: 1px solid #444444;
        --nstrc-dm-border-light: 1px solid #DDDDDD;
        --nstrc-dm-input-background-dark: #333333;
        --nstrc-dm-input-background-light: #F9F9F9;
        --nstrc-dm-button-background-dark: #000000;
        --nstrc-dm-button-background-light: #FFFFFF;
        --nstrc-dm-button-hover-dark: #333333;
        --nstrc-dm-button-hover-light: #F0F0F0;
        --nstrc-dm-button-text-dark: #FFFFFF;
        --nstrc-dm-button-text-light: #000000;
        --nstrc-dm-error-color: #FF4D4F;
        --nstrc-dm-success-color: #52C41A;
        --nstrc-dm-border-radius: 8px;
        
        --nstrc-dm-background: var(--nstrc-dm-background-${theme});
        --nstrc-dm-text-color: var(--nstrc-dm-text-color-${theme});
        --nstrc-dm-border: var(--nstrc-dm-border-${theme});
        --nstrc-dm-input-background: var(--nstrc-dm-input-background-${theme});
        --nstrc-dm-button-background: var(--nstrc-dm-button-background-${theme});
        --nstrc-dm-button-hover: var(--nstrc-dm-button-hover-${theme});
        --nstrc-dm-button-text: var(--nstrc-dm-button-text-${theme});
      }

      .nostr-dm-container {
        display: flex;
        flex-direction: column;
        font-family: var(--nostrc-font-family-primary);
        max-width: 500px;
        width: 100%;
        box-sizing: border-box;
        border-radius: var(--nstrc-dm-border-radius);
        border: var(--nstrc-dm-border);
        background-color: var(--nstrc-dm-background);
        color: var(--nstrc-dm-text-color);
        overflow: hidden;
      }

      .nostr-dm-header {
        padding: 12px 16px;
        border-bottom: var(--nstrc-dm-border);
        display: flex;
        align-items: center;
      }

      .nostr-dm-recipient, .nostr-dm-recipient-placeholder {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nostr-dm-recipient-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-dm-recipient-name {
        font-weight: 600;
        font-size: 16px;
      }

      .nostr-dm-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .nostr-dm-npub-input-container {
        display: flex;
        gap: 8px;
      }

      .nostr-dm-npub-input {
        flex: 1;
        padding: 10px;
        box-sizing: border-box;
        max-width: 100%;
        border-radius: 4px;
        border: var(--nstrc-dm-border);
        background-color: var(--nstrc-dm-input-background);
        color: var(--nstrc-dm-text-color);
      }

      .nostr-dm-find-btn {
        padding: 10px 16px;
        border-radius: 4px;
        border: var(--nstrc-dm-border);
        background-color: var(--nstrc-dm-button-background);
        color: var(--nstrc-dm-button-text);
        cursor: pointer;
      }

      .nostr-dm-find-btn:hover {
        background-color: var(--nstrc-dm-button-hover);
      }

      .nostr-dm-textarea {
        width: 100%;
        min-height: 100px;
        box-sizing: border-box;
        padding: 12px;
        border-radius: 4px;
        border: var(--nstrc-dm-border);
        background-color: var(--nstrc-dm-input-background);
        color: var(--nstrc-dm-text-color);
        font-family: var(--nostrc-font-family-primary);
        resize: vertical;
      }

      .nostr-dm-textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .nostr-dm-actions {
        display: flex;
        justify-content: flex-end;
      }

      .nostr-dm-send-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 4px;
        border: var(--nstrc-dm-border);
        background-color: var(--nstrc-dm-button-background);
        color: var(--nstrc-dm-button-text);
        cursor: pointer;
      }

      .nostr-dm-send-btn:hover:not(:disabled) {
        background-color: var(--nstrc-dm-button-hover);
      }

      .nostr-dm-send-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .nostr-dm-send-btn svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }

      .nostr-dm-error-message {
        color: var(--nstrc-dm-error-color);
        font-size: 14px;
        padding: 0 16px 16px;
      }

      .nostr-dm-success-message {
        color: var(--nstrc-dm-success-color);
        font-size: 14px;
        padding: 0 16px 16px;
      }
    </style>
  `;
}
