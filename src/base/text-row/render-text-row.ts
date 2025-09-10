// SPDX-License-Identifier: MIT

import { escapeHtml } from '../../common/utils';

export interface TextRowOptions {
  value: string;             // the raw text to copy
  display?: string;          // what to show (defaults to value)
  className?: string;        // extra classes to add to the row
  monospace?: boolean;       // show in mono font
  iconHtml?: string;         // override icon (default ⎘)
  title?: string;            // title/tooltip for the text
  showCopyButton?: boolean;  // show copy button (default true)
}

export function renderTextRow(opts: TextRowOptions): string {
  const {
    value,
    display = value,
    className = '',
    monospace = false,
    title = display,
    showCopyButton = false,
  } = opts;

  // Allow only class token chars to avoid breaking out of class attr
  const safeClassName = className.replace(/[^\w\- ]/g, '');
  const safeValue   = escapeHtml(value);
  const safeDisplay = escapeHtml(display);
  const safeTitle   = escapeHtml(title);
  const iconHtml    = '&#x2398;'; // ⎘

  if (showCopyButton) {
    const rowClass = `text-row ${monospace ? 'mono' : ''} ${safeClassName}`.trim();
    return `
      <div class="${rowClass}" data-copy="${safeValue}" title="${safeTitle}">
        <span class="nc-copy-text">${safeDisplay}</span>
        <button type="button" 
              class="nc-copy-btn"
              aria-label="Copy"
              title="Copy">${iconHtml}</button>
      </div>
    `;
  }

  const rowClass = `text-row ${monospace ? 'mono' : ''} ${safeClassName}`.trim();
  return `
    <div class="${rowClass}" title="${safeTitle}">
      ${safeDisplay}
    </div>
  `;
}
