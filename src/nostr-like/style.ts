// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getLikeButtonStyles(): string {
  return getComponentStyles('nostr-like', `
    .nostr-like-button-container {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .nostr-like-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: var(--nostrc-like-btn-padding, 8px 16px);
      border: 1px solid transparent;
      border-radius: var(--nostrc-like-btn-border-radius, 4px);
      background: var(--nostrc-like-btn-bg, #f0f2f5);
      color: var(--nostrc-like-btn-color, #65676b);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 36px;
    }

    .nostr-like-button:hover {
      background: var(--nostrc-like-btn-hover-bg, #e4e6eb);
      color: var(--nostrc-like-btn-hover-color, #65676b);
    }

    .nostr-like-button:active {
      transform: translateY(1px);
    }

    .nostr-like-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .nostr-like-button.liked {
      background: var(--nostrc-like-btn-liked-bg, #e7f3ff);
      color: var(--nostrc-like-btn-liked-color, #1877f2);
      border-color: var(--nostrc-like-btn-liked-border, #1877f2);
    }

    .nostr-like-button.liked:hover {
      background: var(--nostrc-like-btn-liked-hover-bg, #d1e7ff);
    }

    .nostr-like-button svg {
      width: var(--nostrc-icon-width, 20px);
      height: var(--nostrc-icon-height, 20px);
      flex-shrink: 0;
    }

    .like-count {
      color: var(--nostrc-like-count-color, #65676b);
      font-size: 13px;
      font-weight: 400;
      cursor: default;
      user-select: none;
    }

    .like-count.clickable {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: transparent;
      transition: text-decoration-color 0.2s ease;
    }

    .like-count.clickable:hover {
      text-decoration-color: var(--nostrc-like-count-color, #65676b);
    }

    .button-text-skeleton {
      display: inline-block;
      width: 40px;
      height: 14px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: 2px;
    }

    .error-icon {
      color: #ff4444;
      font-size: 16px;
    }

    .nostr-like-button-left-container,
    .nostr-like-button-right-container {
      display: flex;
      align-items: center;
    }

    /* Dark theme */
    [data-theme="dark"] .nostr-like-button {
      background: var(--nostrc-like-btn-bg, #2a2a2a);
      color: var(--nostrc-like-btn-color, #b0b0b0);
    }

    [data-theme="dark"] .nostr-like-button:hover {
      background: var(--nostrc-like-btn-hover-bg, #3a3a3a);
    }

    [data-theme="dark"] .nostr-like-button.liked {
      background: var(--nostrc-like-btn-liked-bg, #1a3a5c);
      color: var(--nostrc-like-btn-liked-color, #4a9eff);
    }

    [data-theme="dark"] .like-count {
      color: var(--nostrc-like-count-color, #b0b0b0);
    }

    [data-theme="dark"] .button-text-skeleton {
      background: linear-gradient(90deg, #3a3a3a 25%, #4a4a4a 50%, #3a3a3a 75%);
      background-size: 200% 100%;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .nostr-like-button {
        padding: 6px 12px;
        font-size: 13px;
        min-height: 32px;
      }

      .nostr-like-button svg {
        width: 18px;
        height: 18px;
      }

      .like-count {
        font-size: 12px;
      }
    }
  `);
}
