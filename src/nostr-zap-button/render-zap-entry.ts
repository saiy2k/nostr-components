// SPDX-License-Identifier: MIT

import { ZapDetails } from './zap-utils';
import { escapeHtml, formatRelativeTime, validateNpub } from '../common/utils';
import { sanitizeHttpUrl, sanitizeMultilineText } from '../common/sanitize';

export interface EnhancedZapDetails extends ZapDetails {
  authorName?: string;
  authorPicture?: string;
  authorNpub?: string;
}

export function renderZapEntry(zap: EnhancedZapDetails, index: number): string {
  const authorNameSafe = escapeHtml(zap.authorName || 'Unknown zapper');
  const npubSafe = validateNpub(zap.authorNpub || '') ? zap.authorNpub : '';
  const njumpUrl = npubSafe
    ? sanitizeHttpUrl(`https://njump.me/${npubSafe}`)
    : '';
  const profilePictureSafe = sanitizeHttpUrl(zap.authorPicture);
  const authorPubkeySafe = escapeHtml(zap.authorPubkey);

  const profilePicture = profilePictureSafe
    ? `<img src="${profilePictureSafe}" alt="${authorNameSafe}" class="zap-author-picture" />`
    : `<div class="zap-author-picture-default">👤</div>`;

  const commentHtml = zap.comment
    ? `<div class="zap-comment">${sanitizeMultilineText(zap.comment)}</div>`
    : '';

  const authorNameHtml = njumpUrl
    ? `<a href="${njumpUrl}" target="_blank" rel="noopener noreferrer" class="zap-author-link">
            ${authorNameSafe}
          </a>`
    : `<span class="zap-author-link">${authorNameSafe}</span>`;

  return `
    <div class="zap-entry" data-zap-index="${index}" data-author-pubkey="${authorPubkeySafe}">
      <div class="zap-author-info">
        ${profilePicture}
        <div class="zap-author-details">
          ${authorNameHtml}
          ${commentHtml}
          <div class="zap-amount-date">
            ${zap.amount.toLocaleString()} ⚡ • ${formatRelativeTime(Math.floor(zap.date.getTime() / 1000))}
          </div>
        </div>
      </div>
    </div>
  `;
}
