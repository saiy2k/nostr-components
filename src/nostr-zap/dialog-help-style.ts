// SPDX-License-Identifier: MIT

/**
 * Help dialog content styles for nostr-zap component
 * Contains only content-specific styles (base dialog styles in DialogComponent)
 */
export const getHelpDialogStyles = (): string => {
  return `
    /* Help Dialog Content Styles */
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
  `;
};
