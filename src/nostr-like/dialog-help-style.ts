// SPDX-License-Identifier: MIT

export function getHelpDialogStyles(): string {
  return `
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

    .help-content a {
      color: var(--nostrc-theme-primary, #0066cc);
      text-decoration: underline;
    }

    .help-content a:hover {
      color: var(--nostrc-theme-primary-hover, #0052a3);
    }
  `;
}

