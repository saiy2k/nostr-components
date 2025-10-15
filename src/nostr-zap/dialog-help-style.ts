// SPDX-License-Identifier: MIT

/**
 * Help dialog styles for nostr-zap component
 * Extracted for better organization and consistency
 */
export const getHelpDialogStyles = (): string => {
  return `
    /* Help Dialog Styles */
    .nostr-zap-help-dialog {
      width: 400px;
      max-width: 90vw;
      border: none;
      border-radius: var(--nostrc-border-radius-lg, 10px);
      padding: var(--nostrc-spacing-xl, 20px);
      background: var(--nostrc-color-background, #ffffff);
      color: var(--nostrc-color-text-primary, #000000);
      position: relative;
      font-family: var(--nostrc-font-family-primary, ui-sans-serif, system-ui, sans-serif);
    }

    .nostr-zap-help-dialog[open] {
      display: block;
    }

    .help-dialog-content {
      position: relative;
    }

    .help-dialog-content h2 {
      font-size: var(--nostrc-font-size-large, 1.25rem);
      font-weight: var(--nostrc-font-weight-bold, 700);
      margin: 0 0 var(--nostrc-spacing-lg, 16px) 0;
      text-align: center;
    }

    .help-content {
      line-height: 1.6;
    }

    .help-content p {
      margin: var(--nostrc-spacing-md, 12px) 0;
    }

    .help-content ul {
      margin: var(--nostrc-spacing-md, 12px) 0;
      padding-left: var(--nostrc-spacing-lg, 16px);
    }

    .help-content li {
      margin: var(--nostrc-spacing-xs, 4px) 0;
    }

    .youtube-link {
      display: inline-block;
      background: var(--nostrc-color-primary, #7f00ff);
      color: var(--nostrc-color-text-on-primary, #ffffff);
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 12px);
      border-radius: var(--nostrc-border-radius-md, 6px);
      text-decoration: none;
      font-weight: var(--nostrc-font-weight-medium, 500);
      margin-top: var(--nostrc-spacing-md, 12px);
      transition: background-color 0.2s ease;
    }

    .youtube-link:hover {
      background: var(--nostrc-color-primary-hover, #6b00d9);
    }

    .help-dialog-content .close-btn {
      position: absolute;
      top: -var(--nostrc-spacing-sm, 8px);
      right: -var(--nostrc-spacing-sm, 8px);
      border: none;
      background: var(--nostrc-color-background-secondary, #f7fafc);
      border-radius: var(--nostrc-border-radius-full, 50%);
      width: 32px;
      height: 32px;
      font-size: var(--nostrc-font-size-base, 16px);
      cursor: pointer;
      color: var(--nostrc-color-text-secondary, #666666);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .help-dialog-content .close-btn:hover {
      background: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      color: var(--nostrc-color-text-primary, #000000);
    }
  `;
};
