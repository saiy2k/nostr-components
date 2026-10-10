// SPDX-License-Identifier: MIT

import { ZapDetails } from './zap-utils';
import {
  escapeHtml,
  formatRelativeTime,
  hexToNpub,
  shortNpub,
  validateNpub,
} from '../common/utils';
import { sanitizeHttpUrl, sanitizeMultilineText } from '../common/sanitize';

export interface EnhancedZapDetails extends ZapDetails {
  authorName?: string;
  authorPicture?: string;
  authorNpub?: string;
}

export interface ZapperProfileContent {
  display_name?: unknown;
  name?: unknown;
  picture?: unknown;
}

function profileText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Profile display name, then name, then a short npub. */
export function zapperDisplayName(
  pubkey: string | null,
  content?: ZapperProfileContent | null,
): string {
  if (!pubkey) return 'Anonymous';
  const named = profileText(content?.display_name) || profileText(content?.name);
  if (named) return named;
  return shortNpub(hexToNpub(pubkey)) || 'Unknown zapper';
}

export function zapperPictureUrl(picture: unknown): string | undefined {
  if (typeof picture !== 'string') return undefined;
  try {
    const url = new URL(picture.trim());
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function renderZapperEntry(
  zap: ZapDetails,
  index: number,
  content?: ZapperProfileContent | null,
): string {
  return renderZapEntry(
    {
      ...zap,
      authorName: zapperDisplayName(zap.authorPubkey, content),
      authorPicture: zapperPictureUrl(content?.picture),
      authorNpub: zap.authorPubkey ? hexToNpub(zap.authorPubkey) : '',
    },
    index,
  );
}

export function renderZapEntry(zap: EnhancedZapDetails, index: number): string {
  const anonymous = !zap.authorPubkey;
  const authorNameSafe = escapeHtml(
    zap.authorName || (anonymous ? 'Anonymous' : 'Unknown zapper'),
  );
  const npubSafe = !anonymous && validateNpub(zap.authorNpub || '') ? zap.authorNpub : '';
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
