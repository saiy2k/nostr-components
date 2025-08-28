import { escapeHtml } from '../common/utils';

export interface CopyRowOptions {
  value: string;             // the raw text to copy
  display?: string;          // what to show (defaults to value)
  className?: string;        // extra classes to add to the row
  monospace?: boolean;       // show in mono font
  iconHtml?: string;         // override icon (default ⎘)
  title?: string;            // title/tooltip for the text
}

export function renderCopyRow(opts: CopyRowOptions): string {
  const {
    value,
    display = value,
    className = '',
    monospace = false,
    iconHtml = '&#x2398;', // ⎘
    title = display,
  } = opts;

  const safeValue   = escapeHtml(value);
  const safeDisplay = escapeHtml(display);
  const safeTitle   = escapeHtml(title);

  const rowClass = `badge-row nc-copy ${monospace ? 'mono' : ''} ${className}`.trim();

  return `
    <div class="${rowClass}" data-copy="${safeValue}" title="${safeTitle}">
      <span class="nc-copy-text">${safeDisplay}</span>
      <button type="button" 
            class="copy-button nc-copy-btn"
            aria-label="Copy"
            title="Copy">${iconHtml}</button>
    </div>
  `;
}
