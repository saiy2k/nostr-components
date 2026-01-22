// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getLivestreamStyles(): string {
  const customStyles = `
    /* === LIVESTREAM CSS VARIABLES === */
    :host {
      --nostrc-livestream-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-livestream-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-livestream-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-livestream-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-livestream-font-family: var(--nostrc-font-family-primary);
      --nostrc-livestream-font-size: var(--nostrc-font-size-base);
      
      /* Status badge colors (theme-aware, can be overridden by data-theme) */
      --nostrc-livestream-status-planned-bg: var(--nostrc-theme-status-planned-bg, #e3f2fd);
      --nostrc-livestream-status-planned-color: var(--nostrc-theme-status-planned-color, #1976d2);
      --nostrc-livestream-status-live-bg: var(--nostrc-theme-status-live-bg, #e8f5e9);
      --nostrc-livestream-status-live-color: var(--nostrc-theme-status-live-color, #2e7d32);
      --nostrc-livestream-status-ended-bg: var(--nostrc-theme-status-ended-bg, #f5f5f5);
      --nostrc-livestream-status-ended-color: var(--nostrc-theme-status-ended-color, #616161);
      
      /* Hover state variables */
      --nostrc-livestream-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-livestream-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-livestream-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual livestream surface */
      display: block;
      background: var(--nostrc-livestream-bg);
      color: var(--nostrc-livestream-text-primary);
      border: var(--nostrc-livestream-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-livestream-font-family);
      font-size: var(--nostrc-livestream-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  border-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    /* Hover state on host element (CSS-only, no JavaScript) */
    :host(.is-clickable:hover) {
      background: var(--nostrc-livestream-hover-bg);
      color: var(--nostrc-livestream-hover-color);
      border: var(--nostrc-livestream-hover-border);
    }

    :host(.is-clickable) {
      cursor: pointer;
    }

    :host(.is-error) {
      border: var(--nostrc-border-width) solid var(--nostrc-color-error-text);
    }

    /* === LIVESTREAM CONTAINER === */
    .nostr-livestream-container {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-lg);
      padding: var(--nostrc-spacing-md);
      min-height: 200px;
    }

    :host(.is-error) .nostr-livestream-container {
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-error-text);
    }

    /* === LIVESTREAM HEADER === */
    .livestream-header {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
    }

    .livestream-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--nostrc-spacing-sm);
    }

    .livestream-title {
      color: var(--nostrc-livestream-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      font-size: var(--nostrc-font-size-large);
      overflow-wrap: break-word;
      word-wrap: break-word;
      white-space: normal;
      line-height: 1.3;
      flex: 1;
      min-width: 0;
    }

    .livestream-header-right {
      flex-shrink: 0;
    }

    .livestream-author-row {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      cursor: pointer;
    }

    .livestream-author-row:hover .author-name,
    .livestream-author-row:hover .author-username {
      text-decoration: underline;
    }

    .author-picture {
      width: 35px;
      height: 35px;
      flex-shrink: 0;
    }

    .author-picture img {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }

    .livestream-author-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .livestream-author-info .author-name {
      color: var(--nostrc-livestream-text-primary);
      font-weight: var(--nostrc-font-weight-medium);
      font-size: var(--nostrc-font-size-base);
      word-break: break-word;
    }

    .livestream-author-info .author-username {
      color: var(--nostrc-livestream-text-secondary);
      font-size: var(--nostrc-font-size-small);
      word-break: break-all;
    }

    /* === STATUS BADGES === */
    .livestream-status-badge {
      display: inline-block;
      padding: var(--nostrc-spacing-xs) var(--nostrc-spacing-sm);
      border-radius: var(--nostrc-border-radius-md);
      font-size: var(--nostrc-font-size-small);
      font-weight: var(--nostrc-font-weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .livestream-status-planned {
      background-color: var(--nostrc-livestream-status-planned-bg);
      color: var(--nostrc-livestream-status-planned-color);
    }

    .livestream-status-live {
      background-color: var(--nostrc-livestream-status-live-bg);
      color: var(--nostrc-livestream-status-live-color);
      animation: pulse-live 2s ease-in-out infinite;
    }

    .livestream-status-ended {
      background-color: var(--nostrc-livestream-status-ended-bg);
      color: var(--nostrc-livestream-status-ended-color);
    }

    /* Pulsing animation for live status */
    @keyframes pulse-live {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7);
      }
      50% {
        opacity: 0.9;
        box-shadow: 0 0 0 8px rgba(46, 125, 50, 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .livestream-status-live {
        animation: none;
      }
    }

    /* === LIVESTREAM MEDIA === */
    .livestream-media {
      width: 100%;
      position: relative;
    }

    .livestream-video-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--nostrc-color-background, #f5f5f5);
      border-radius: var(--nostrc-border-radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--nostrc-livestream-text-secondary);
      padding: var(--nostrc-spacing-lg);
      text-align: center;
      min-height: 300px;
      max-height: 600px;
    }

    .livestream-video {
      width: 100%;
      max-width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--nostrc-border-radius-md);
      background-color: #000;
      display: block;
    }

    .livestream-preview-image {
      width: 100%;
      position: relative;
    }

    .livestream-preview-image img {
      width: 100%;
      height: auto;
      max-height: 500px;
      object-fit: contain;
      border-radius: var(--nostrc-border-radius-md);
      display: block;
    }

    .livestream-preview-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--nostrc-color-background, #f5f5f5);
      border-radius: var(--nostrc-border-radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--nostrc-livestream-text-secondary);
      padding: var(--nostrc-spacing-lg);
      min-height: 300px;
    }

    .livestream-preview-placeholder-icon {
      font-size: 3em;
      margin-bottom: var(--nostrc-spacing-sm);
      opacity: 0.5;
    }

    .livestream-recording-link {
      margin-top: var(--nostrc-spacing-md);
      text-align: center;
    }

    .livestream-recording-link a {
      display: inline-flex;
      align-items: center;
      gap: var(--nostrc-spacing-xs);
      padding: var(--nostrc-spacing-sm) var(--nostrc-spacing-lg);
      background-color: var(--nostrc-color-primary, #7f00ff);
      color: #ffffff;
      border-radius: var(--nostrc-border-radius-md);
      text-decoration: none;
      font-weight: var(--nostrc-font-weight-medium);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  transform 0.2s ease;
    }

    .livestream-recording-link a:hover {
      background-color: var(--nostrc-color-primary, #6a00d1);
      transform: translateY(-1px);
    }

    .recording-icon {
      font-size: 1.2em;
    }

    /* === LIVESTREAM METADATA === */
    .livestream-metadata {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-md);
    }

    .livestream-summary {
      color: var(--nostrc-livestream-text-primary);
      line-height: 1.6;
      word-break: break-word;
    }

    .livestream-participant-count {
      color: var(--nostrc-livestream-text-secondary);
      font-size: var(--nostrc-font-size-base);
    }

    .livestream-participant-count strong {
      color: var(--nostrc-livestream-text-primary);
      font-weight: var(--nostrc-font-weight-medium);
    }

    .livestream-timestamps {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-xs);
      color: var(--nostrc-livestream-text-secondary);
      font-size: var(--nostrc-font-size-small);
    }

    .livestream-start-time,
    .livestream-end-time {
      display: block;
    }

    .livestream-hashtags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--nostrc-spacing-xs);
    }

    .hashtag {
      display: inline-block;
      padding: 2px var(--nostrc-spacing-xs);
      background-color: var(--nostrc-color-background, #f5f5f5);
      color: var(--nostrc-color-primary, #7f00ff);
      border-radius: var(--nostrc-border-radius-sm);
      font-size: var(--nostrc-font-size-small);
      text-decoration: none;
    }

    /* === PARTICIPANTS === */
    .livestream-participants {
      margin-top: var(--nostrc-spacing-md);
    }

    .participants-title {
      color: var(--nostrc-livestream-text-primary);
      font-size: var(--nostrc-font-size-large);
      font-weight: var(--nostrc-font-weight-bold);
      margin-bottom: var(--nostrc-spacing-md);
    }

    .participants-list {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
      max-height: 400px;
      overflow-y: auto;
    }

    .participants-empty {
      color: var(--nostrc-livestream-text-secondary);
      font-style: italic;
      padding: var(--nostrc-spacing-md);
      text-align: center;
    }

    .participant-item {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
      padding: var(--nostrc-spacing-xs);
      border-radius: var(--nostrc-border-radius-sm);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    .participant-item:hover {
      background-color: var(--nostrc-livestream-hover-bg);
    }

    .participant-avatar {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    .participant-avatar img {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      object-fit: cover;
    }

    .participant-avatar-placeholder {
      width: 100%;
      height: 100%;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-background, #f5f5f5);
      border: 1px solid var(--nostrc-color-border, #e0e0e0);
    }

    .participant-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .participant-name {
      color: var(--nostrc-livestream-text-primary);
      font-weight: var(--nostrc-font-weight-medium);
      font-size: var(--nostrc-font-size-base);
      word-break: break-word;
    }

    .participant-role {
      display: inline-block;
      padding: 2px var(--nostrc-spacing-xs);
      border-radius: var(--nostrc-border-radius-sm);
      font-size: var(--nostrc-font-size-small);
      font-weight: var(--nostrc-font-weight-medium);
      text-transform: capitalize;
    }

    .participant-role-host {
      background-color: #fff3e0;
      color: #e65100;
    }

    .participant-role-speaker {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .participant-role-participant {
      background-color: var(--nostrc-color-background, #f5f5f5);
      color: var(--nostrc-livestream-text-secondary);
    }

    .participant-proof {
      color: var(--nostrc-livestream-status-live-color);
      font-weight: var(--nostrc-font-weight-bold);
      font-size: 1.2em;
      flex-shrink: 0;
    }

    /* === ERROR STATE === */
    .livestream-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-spacing-xl);
      text-align: center;
    }

    .livestream-error .error-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-background);
      color: var(--nostrc-color-error-icon);
      font-size: 2em;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .livestream-error .error-message {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-base);
    }

    /* === RESPONSIVE DESIGN === */
    @media only screen and (max-width: 768px) {
      .nostr-livestream-container {
        padding: var(--nostrc-spacing-sm);
        gap: var(--nostrc-spacing-md);
      }

      .livestream-title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--nostrc-spacing-xs);
      }

      .livestream-title {
        font-size: var(--nostrc-font-size-base);
        width: 100%;
        overflow-wrap: break-word;
        word-wrap: break-word;
        white-space: normal;
      }

      .livestream-header-right {
        align-self: flex-start;
      }

      .livestream-video,
      .livestream-video-placeholder,
      .livestream-preview-placeholder {
        aspect-ratio: 16 / 9;
        max-height: 400px;
      }

      .livestream-header {
        flex-wrap: wrap;
      }

      .livestream-status-badge {
        font-size: var(--nostrc-font-size-small);
        padding: 4px var(--nostrc-spacing-xs);
      }

      .participants-list {
        max-height: 300px;
      }

      .livestream-timestamps {
        font-size: var(--nostrc-font-size-small);
      }
    }

    @media only screen and (max-width: 480px) {
      .livestream-title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--nostrc-spacing-xs);
      }

      .livestream-title {
        font-size: var(--nostrc-font-size-base);
        width: 100%;
        overflow-wrap: break-word;
        word-wrap: break-word;
        white-space: normal;
      }

      .livestream-header-right {
        align-self: flex-start;
      }

      .livestream-video,
      .livestream-video-placeholder,
      .livestream-preview-placeholder {
        aspect-ratio: 4 / 3;
        min-height: 200px;
      }

      .participant-item {
        padding: var(--nostrc-spacing-xs);
      }

      .participant-avatar {
        width: 28px;
        height: 28px;
      }

      .participant-name {
        font-size: var(--nostrc-font-size-small);
      }
    }
  `;

  return getComponentStyles(customStyles);
}
