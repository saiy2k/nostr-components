// SPDX-License-Identifier: MIT

/**
 * Base dialog component styles
 * Provides common styling for all dialog components
 */
export const getDialogComponentStyles = (): string => {
  return `
    /* Base Dialog Styles */
    .nostr-base-dialog {
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

    .nostr-base-dialog[open] {
      display: block;
    }

    .nostr-base-dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }

    .dialog-header {
      position: relative;
      margin-bottom: var(--nostrc-spacing-lg, 16px);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dialog-header h2 {
      font-size: var(--nostrc-font-size-large, 1.25rem);
      font-weight: var(--nostrc-font-weight-bold, 700);
      margin: 0;
      flex: 1;
      text-align: left;
      padding-top: 2px;
    }

    .dialog-close-btn {
      border: none;
      background: var(--nostrc-color-background-secondary, #f7fafc);
      border-radius: var(--nostrc-border-radius-full, 50%);
      width: 32px;
      height: 32px;
      min-width: 32px;
      font-size: var(--nostrc-font-size-base, 16px);
      cursor: pointer;
      color: var(--nostrc-color-text-secondary, #666666);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog-close-btn:hover {
      background: var(--nostrc-color-hover-background, rgba(0, 0, 0, 0.05));
      color: var(--nostrc-color-text-primary, #000000);
    }

    .dialog-content {
      line-height: 1.6;
    }
  `;
};

