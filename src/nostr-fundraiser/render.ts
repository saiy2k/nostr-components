// SPDX-License-Identifier: MIT

import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { IRenderOptions } from '../base/render-options';
import { escapeHtml, isValidUrl } from '../common/utils';
import type { ParsedFundraiserEvent } from './fundraiser-utils';

export interface RenderFundraiserOptions extends IRenderOptions {
  author: NDKUserProfile | null;
  parsedFundraiser: ParsedFundraiserEvent | null;
  totalRaised: number;
  donorCount: number;
  percentRaised: number;
  remainingAmount: number;
  isClosed: boolean;
  isDonationsLoading: boolean;
  donationErrorMessage?: string;
  actionErrorMessage?: string;
  actionLabel: string;
  createdAtLabel?: string;
}

function renderMultilineText(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br />');
}

function formatSats(value: number): string {
  return `${Math.round(value).toLocaleString()} sats`;
}

function renderLoading(): string {
  return `
    <div class="nostr-fundraiser-container">
      <div class="post-header" style="margin: var(--nostrc-spacing-md); margin-bottom: 0;">
        <div class="post-header-left">
          <div class="author-picture">
            <div style="width: 35px; height: 35px; border-radius: 50%;" class="skeleton"></div>
          </div>
        </div>
        <div class="post-header-middle">
          <div style="width: 70%; height: 10px; border-radius: 10px;" class="skeleton"></div>
          <div style="width: 80%; height: 8px; border-radius: 10px; margin-top: 5px;" class="skeleton"></div>
        </div>
        <div class="post-header-right">
          <div style="width: 80px; height: 10px; border-radius: 10px;" class="skeleton"></div>
        </div>
      </div>
      <div class="fundraiser-banner skeleton fundraiser-banner-skeleton" style="margin-top: var(--nostrc-spacing-md);"></div>
      <div class="fundraiser-body">
        <div class="skeleton" style="width: 55%; height: 28px;"></div>
        <div class="skeleton" style="width: 80%;"></div>
        <div class="fundraiser-progress-card">
          <div class="skeleton" style="width: 45%;"></div>
          <div class="fundraiser-progress-track">
            <div class="fundraiser-progress-fill skeleton" style="width: 45%; height: 100%; margin: 0;"></div>
          </div>
          <div class="skeleton" style="width: 35%;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderError(errorMessage: string): string {
  return `
    <div class="nostr-fundraiser-container fundraiser-error-state">
      <div class="error-icon">&#9888;</div>
      <div class="fundraiser-error-message">${escapeHtml(errorMessage)}</div>
    </div>
  `;
}

function renderAuthor(author: NDKUserProfile | null, createdAtLabel?: string): string {
  const authorName = author?.displayName || author?.name || 'Unknown creator';
  const authorAvatar = author?.picture || author?.image || '';
  const nip05 = author?.nip05 || '';

  return `
    <div class="post-header" style="margin: var(--nostrc-spacing-md); margin-bottom: 0;">
      <div class="post-header-left">
        <div class="author-picture">
          ${authorAvatar && isValidUrl(authorAvatar)
            ? `<img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(authorName)}" loading="lazy" />`
            : '<div class="fundraiser-author-avatar-fallback">F</div>'
          }
        </div>
      </div>
      <div class="post-header-middle">
        <span class="author-name">${escapeHtml(authorName)}</span>
        ${nip05 ? `<span class="author-username">${escapeHtml(nip05)}</span>` : ''}
      </div>
      <div class="post-header-right">
        ${createdAtLabel ? `<span class="post-date">${escapeHtml(createdAtLabel)}</span>` : ''}
      </div>
    </div>
  `;
}

function renderBanner(parsedFundraiser: ParsedFundraiserEvent): string {
  if (parsedFundraiser.image && isValidUrl(parsedFundraiser.image)) {
    return `
      <div class="fundraiser-banner">
        <img src="${escapeHtml(parsedFundraiser.image)}" alt="${escapeHtml(parsedFundraiser.title)}" loading="lazy" />
      </div>
    `;
  }

  return `
    <div class="fundraiser-banner fundraiser-banner-placeholder">
      <div class="fundraiser-banner-copy">NIP-75 fundraiser</div>
    </div>
  `;
}

export function renderFundraiser({
  isLoading,
  isError,
  errorMessage,
  author,
  parsedFundraiser,
  totalRaised,
  donorCount,
  percentRaised,
  remainingAmount,
  isClosed,
  isDonationsLoading,
  donationErrorMessage,
  actionErrorMessage,
  actionLabel,
  createdAtLabel,
}: RenderFundraiserOptions): string {
  if (isError) {
    return renderError(errorMessage || 'Failed to load fundraiser');
  }

  if (isLoading || !parsedFundraiser) {
    return renderLoading();
  }

  const progressBarWidth = Math.max(0, Math.min(percentRaised, 100));
  const percentLabel = `${Math.round(percentRaised)}% funded`;
  const donorLabel = donorCount === 1 ? 'donor' : 'donors';
  const linkUrl = parsedFundraiser.resourceUrl && isValidUrl(parsedFundraiser.resourceUrl)
    ? parsedFundraiser.resourceUrl
    : '';

  return `
    <div class="nostr-fundraiser-container">
      ${renderAuthor(author, createdAtLabel)}
      <div style="padding: var(--nostrc-spacing-md); padding-bottom: 0;">
        ${renderBanner(parsedFundraiser)}
      </div>
      <div class="fundraiser-body">

        <div class="fundraiser-header">
          <div class="fundraiser-heading-group">
            <h2 class="fundraiser-title">${escapeHtml(parsedFundraiser.title)}</h2>
            ${parsedFundraiser.description
              ? `<p class="fundraiser-description">${renderMultilineText(parsedFundraiser.description)}</p>`
              : ''
            }
          </div>
          <span class="fundraiser-status-badge ${isClosed ? 'is-closed' : 'is-open'}">
            ${isClosed ? 'Closed' : 'Open'}
          </span>
        </div>

        <div class="fundraiser-progress-card">
          <div class="fundraiser-progress-head">
            <div class="fundraiser-progress-amounts">
              <span class="fundraiser-progress-raised">${formatSats(totalRaised)}</span>
              <span class="fundraiser-progress-goal">of ${formatSats(parsedFundraiser.targetAmountSats)}</span>
            </div>
            <span class="fundraiser-progress-percent">${escapeHtml(percentLabel)}</span>
          </div>

          <div class="fundraiser-progress-track" aria-hidden="true">
            <div class="fundraiser-progress-fill" style="width: ${progressBarWidth}%;"></div>
          </div>

          <div class="fundraiser-progress-foot">
            <span class="fundraiser-progress-remaining">
              ${remainingAmount > 0 ? `${formatSats(remainingAmount)} to go` : 'Goal reached'}
            </span>
            <button
              type="button"
              class="nostr-fundraiser-donors"
              ${donorCount === 0 || isDonationsLoading ? 'disabled' : ''}
            >
              ${isDonationsLoading ? 'Loading donors...' : `${donorCount} ${donorLabel}`}
            </button>
          </div>

          ${donationErrorMessage ? `<div class="fundraiser-inline-error">${escapeHtml(donationErrorMessage)}</div>` : ''}
        </div>

        <div class="fundraiser-actions">
          <button type="button" class="nostr-fundraiser-zap-button">
            <span class="fundraiser-zap-icon">⚡</span>
            <span>${escapeHtml(actionLabel)}</span>
          </button>
          ${linkUrl
            ? `<a class="nostr-fundraiser-link" href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer">Learn more</a>`
            : ''
          }
        </div>

        ${actionErrorMessage ? `<div class="fundraiser-inline-error">${escapeHtml(actionErrorMessage)}</div>` : ''}
      </div>
    </div>
  `;
}
