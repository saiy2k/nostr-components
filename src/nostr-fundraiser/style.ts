// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getFundraiserStyles(): string {
  const customStyles = `
    :host {
      --nostrc-fundraiser-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-fundraiser-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-fundraiser-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-fundraiser-border: var(--nostrc-theme-border, var(--nostrc-border-width) solid var(--nostrc-color-border));
      --nostrc-fundraiser-font-family: var(--nostrc-font-family-primary);
      --nostrc-fundraiser-font-size: var(--nostrc-font-size-base);

      /* Hover state variables */
      --nostrc-fundraiser-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-fundraiser-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-fundraiser-hover-border: var(--nostrc-theme-hover-border, var(--nostrc-border-width) solid var(--nostrc-color-border));

      --nostrc-fundraiser-accent: #f59e0b;
      --nostrc-fundraiser-accent-strong: #d97706;
      --nostrc-fundraiser-accent-soft: rgba(245, 158, 11, 0.12);
      --nostrc-fundraiser-progress-track: #f3f4f6;
      --nostrc-fundraiser-open-bg: #ecfdf3;
      --nostrc-fundraiser-open-color: #166534;
      --nostrc-fundraiser-closed-bg: #fef2f2;
      --nostrc-fundraiser-closed-color: #991b1b;

      display: block;
      background: var(--nostrc-fundraiser-bg);
      color: var(--nostrc-fundraiser-text-primary);
      border: var(--nostrc-fundraiser-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-fundraiser-font-family);
      font-size: var(--nostrc-fundraiser-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    :host(.is-clickable:hover) {
      background: var(--nostrc-fundraiser-hover-bg);
      color: var(--nostrc-fundraiser-hover-color);
      border: var(--nostrc-fundraiser-hover-border);
    }

    .nostr-fundraiser-container {
      display: flex;
      flex-direction: column;
      border-radius: var(--nostrc-border-radius-md);
    }

    :host(.is-error) .nostr-fundraiser-container {
      min-height: 200px;
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-error-text);
      /* In case bordered is enabled */
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }

    .fundraiser-error-state {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-spacing-xl);
      text-align: center;
    }

    .fundraiser-error-message {
      color: var(--nostrc-color-error-text);
    }

    .fundraiser-banner {
      position: relative;
      aspect-ratio: 16 / 7;
      background:
        radial-gradient(circle at top left, rgba(245, 158, 11, 0.28), transparent 38%),
        linear-gradient(135deg, #fff8eb 0%, #fffdf7 55%, #f2fbf8 100%);
      overflow: hidden;
      border-radius: var(--nostrc-border-radius-md);
    }

    .fundraiser-banner img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: var(--nostrc-border-radius-md);
    }

    .fundraiser-banner-placeholder {
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      padding: var(--nostrc-spacing-lg);
      border-radius: var(--nostrc-border-radius-md);
    }

    .fundraiser-banner-copy {
      font-size: var(--nostrc-font-size-small);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: var(--nostrc-font-weight-bold);
      color: rgba(120, 53, 15, 0.9);
      background: rgba(255, 255, 255, 0.7);
      padding: 6px 10px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }

    .fundraiser-banner-skeleton {
      min-height: 180px;
      margin: 0;
      border-radius: 0;
    }

    .fundraiser-body {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-lg);
      padding: var(--nostrc-spacing-lg);
    }

    /* === POST HEADER PATTERN === */
    .post-header {
      display: flex;
      gap: var(--nostrc-spacing-sm);
    }
    
    .post-header-left {
      width: 35px;
      flex-shrink: 0;
    }

    .post-header-left img {
      width: 35px;
      height: 35px;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }

    .author-picture {
      width: 35px;
      height: 35px;
    }

    .fundraiser-author-avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--nostrc-fundraiser-accent-soft);
      color: var(--nostrc-fundraiser-accent-strong);
      font-weight: var(--nostrc-font-weight-bold);
    }

    .post-header-middle {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: var(--nostrc-spacing-xs);
    }

    .post-header-right {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: end;
    }

    .author-name {
      color: var(--nostrc-fundraiser-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      word-break: break-word;
    }

    .author-username {
      font-weight: var(--nostrc-font-weight-normal);
      color: var(--nostrc-fundraiser-text-secondary);
      font-size: var(--nostrc-font-size-sm);
      word-break: break-all;
    }

    .post-date {
      font-weight: var(--nostrc-font-weight-normal);
      color: var(--nostrc-fundraiser-text-secondary);
      font-size: var(--nostrc-font-size-sm);
    }

    .fundraiser-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--nostrc-spacing-md);
    }

    .fundraiser-heading-group {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
    }

    .fundraiser-title {
      margin: 0;
      font-size: 1.5rem;
      line-height: 1.2;
      word-break: break-word;
      color: var(--nostrc-fundraiser-text-primary);
    }

    .fundraiser-description {
      margin: 0;
      color: var(--nostrc-fundraiser-text-secondary);
      line-height: 1.65;
      word-break: break-word;
    }

    .fundraiser-status-badge {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: var(--nostrc-font-size-small);
      font-weight: var(--nostrc-font-weight-bold);
      white-space: nowrap;
    }

    .fundraiser-status-badge.is-open {
      background: var(--nostrc-fundraiser-open-bg);
      color: var(--nostrc-fundraiser-open-color);
    }

    .fundraiser-status-badge.is-closed {
      background: var(--nostrc-fundraiser-closed-bg);
      color: var(--nostrc-fundraiser-closed-color);
    }

    .fundraiser-progress-card {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
      padding: var(--nostrc-spacing-md);
      border-radius: var(--nostrc-border-radius-md);
      background: var(--nostrc-fundraiser-hover-bg);
      border: var(--nostrc-fundraiser-border);
    }

    .fundraiser-progress-head,
    .fundraiser-progress-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--nostrc-spacing-md);
      flex-wrap: wrap;
    }

    .fundraiser-progress-amounts {
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }

    .fundraiser-progress-raised {
      font-size: 1.25rem;
      font-weight: var(--nostrc-font-weight-bold);
      color: var(--nostrc-fundraiser-text-primary);
    }

    .fundraiser-progress-goal,
    .fundraiser-progress-percent,
    .fundraiser-progress-remaining {
      color: var(--nostrc-fundraiser-text-secondary);
      font-size: var(--nostrc-font-size-small);
    }

    .fundraiser-progress-track {
      width: 100%;
      height: 12px;
      border-radius: 999px;
      background: var(--nostrc-fundraiser-progress-track);
      overflow: hidden;
    }

    .fundraiser-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--nostrc-fundraiser-accent), var(--nostrc-fundraiser-accent-strong));
      transition: width var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    .nostr-fundraiser-donors,
    .nostr-fundraiser-zap-button,
    .fundraiser-link {
      border: none;
      background: none;
      font: inherit;
    }

    .nostr-fundraiser-donors {
      padding: 0;
      color: var(--nostrc-fundraiser-accent-strong);
      font-weight: var(--nostrc-font-weight-medium);
      cursor: pointer;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }

    .nostr-fundraiser-donors:disabled {
      color: var(--nostrc-fundraiser-text-secondary);
      cursor: default;
      text-decoration: none;
    }

    .fundraiser-inline-error {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-small);
    }

    .fundraiser-actions {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      flex-wrap: wrap;
    }

    .nostr-fundraiser-zap-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 999px;
      background: var(--nostrc-fundraiser-accent);
      color: #111827;
      cursor: pointer;
      font-weight: var(--nostrc-font-weight-bold);
      transition: transform var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  box-shadow var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
      box-shadow: 0 10px 20px rgba(245, 158, 11, 0.2);
    }

    .nostr-fundraiser-zap-button:hover {
      transform: translateY(-1px);
      background: var(--nostrc-fundraiser-accent-strong);
      color: #ffffff;
    }

    .fundraiser-zap-icon {
      font-size: 1rem;
      line-height: 1;
    }

    .nostr-fundraiser-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid rgba(17, 24, 39, 0.12);
      color: var(--nostrc-fundraiser-text-primary);
      text-decoration: none;
      font-weight: var(--nostrc-font-weight-medium);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  border-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    .nostr-fundraiser-link:hover {
      background: rgba(17, 24, 39, 0.05);
      border-color: rgba(17, 24, 39, 0.22);
    }

    @media (max-width: 640px) {
      .fundraiser-body {
        padding: var(--nostrc-spacing-md);
      }

      .fundraiser-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .fundraiser-title {
        font-size: 1.3rem;
      }
    }
  `;

  return getComponentStyles(customStyles);
}
