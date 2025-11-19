// SPDX-License-Identifier: MIT

/**
 * Help dialog content styles for nostr-zap component
 * Contains only content-specific styles (base dialog styles in DialogComponent)
 */
export const getHelpDialogStyles = (): string => {
  return `
    /* Help Dialog Content Styles */
    .help-content {
      padding: var(--nostrc-spacing-md, 12px);
    }

    .help-content p {
      margin: 0 0 var(--nostrc-spacing-md, 12px) 0;
      color: var(--nostrc-theme-text-primary, #333333);
      line-height: 1.5;
    }

    .help-content p:last-child {
      margin-bottom: 0;
    }

    .help-content ul {
      margin: 0 0 var(--nostrc-spacing-md, 12px) 0;
      padding-left: var(--nostrc-spacing-lg, 16px);
      color: var(--nostrc-theme-text-primary, #333333);
    }

    .help-content li {
      margin-bottom: var(--nostrc-spacing-xs, 4px);
      line-height: 1.5;
    }

    .help-content li:last-child {
      margin-bottom: 0;
    }

    .help-content strong {
      font-weight: 600;
      color: var(--nostrc-theme-text-primary, #333333);
    }

    .help-content a:not(.youtube-link) {
      color: var(--nostrc-theme-primary, #0066cc);
      text-decoration: underline;
    }

    .help-content a:not(.youtube-link):hover {
      color: var(--nostrc-theme-primary-hover, #0052a3);
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
