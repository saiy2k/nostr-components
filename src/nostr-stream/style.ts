// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getStreamStyles(): string {
  const customStyles = `
    /* === STREAM CSS VARIABLES === */
    :host {
      --nostrc-stream-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-stream-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-stream-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-stream-border: var(--nostrc-border-width) solid var(--nostrc-color-border);
      --nostrc-stream-font-family: var(--nostrc-font-family-primary);
      --nostrc-stream-font-size: var(--nostrc-font-size-base);
      
      /* Status badge colors (theme-aware, can be overridden by data-theme) */
      --nostrc-stream-status-planned-bg: var(--nostrc-theme-status-planned-bg, #e3f2fd);
      --nostrc-stream-status-planned-color: var(--nostrc-theme-status-planned-color, #1976d2);
      --nostrc-stream-status-live-bg: var(--nostrc-theme-status-live-bg, #e8f5e9);
      --nostrc-stream-status-live-color: var(--nostrc-theme-status-live-color, #2e7d32);
      --nostrc-stream-status-ended-bg: var(--nostrc-theme-status-ended-bg, #f5f5f5);
      --nostrc-stream-status-ended-color: var(--nostrc-theme-status-ended-color, #616161);
      
      /* Hover state variables */
      --nostrc-stream-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-stream-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-stream-hover-border: var(--nostrc-border-width) solid var(--nostrc-theme-border, var(--nostrc-color-border));

      /* Make the host the visual stream surface */
      display: block;
      background: var(--nostrc-stream-bg);
      color: var(--nostrc-stream-text-primary);
      border: var(--nostrc-stream-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-stream-font-family);
      font-size: var(--nostrc-stream-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  border-color var(--nostrc-transition-duration) var(--nostrc-transition-timing),
                  color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    /* Hover state on host element (CSS-only, no JavaScript) */
    :host(.is-clickable:hover) {
      background: var(--nostrc-stream-hover-bg);
      color: var(--nostrc-stream-hover-color);
      border: var(--nostrc-stream-hover-border);
    }

    :host(.is-clickable) {
      cursor: pointer;
    }

    /* === STREAM CONTAINER === */
    .nostr-stream-container {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-lg);
      padding: var(--nostrc-spacing-md);
      min-height: 200px;
    }

    :host(.is-error) .nostr-stream-container {
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-error-text);
    }

    /* === STREAM HEADER === */
    .stream-header {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm);
    }

    .stream-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--nostrc-spacing-sm);
    }

    .stream-title {
      color: var(--nostrc-stream-text-primary);
      font-weight: var(--nostrc-font-weight-bold);
      font-size: var(--nostrc-font-size-large);
      word-break: break-word;
      line-height: 1.3;
      flex: 1;
      min-width: 0;
    }

    .stream-header-right {
      flex-shrink: 0;
    }

    .stream-author-row {
      display: flex;
      align-items: center;
      gap: var(--nostrc-spacing-sm);
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

    .stream-author-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .stream-author-info .author-name {
      color: var(--nostrc-stream-text-primary);
      font-weight: var(--nostrc-font-weight-medium);
      font-size: var(--nostrc-font-size-base);
      word-break: break-word;
    }

    .stream-author-info .author-username {
      color: var(--nostrc-stream-text-secondary);
      font-size: var(--nostrc-font-size-small);
      word-break: break-all;
    }

    /* === STATUS BADGES === */
    .stream-status-badge {
      display: inline-block;
      padding: var(--nostrc-spacing-xs) var(--nostrc-spacing-sm);
      border-radius: var(--nostrc-border-radius-md);
      font-size: var(--nostrc-font-size-small);
      font-weight: var(--nostrc-font-weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stream-status-planned {
      background-color: var(--nostrc-stream-status-planned-bg);
      color: var(--nostrc-stream-status-planned-color);
    }

    .stream-status-live {
      background-color: var(--nostrc-stream-status-live-bg);
      color: var(--nostrc-stream-status-live-color);
      animation: pulse-live 2s ease-in-out infinite;
    }

    .stream-status-ended {
      background-color: var(--nostrc-stream-status-ended-bg);
      color: var(--nostrc-stream-status-ended-color);
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
      .stream-status-live {
        animation: none;
      }
    }

    /* === STREAM MEDIA === */
    .stream-media {
      width: 100%;
      position: relative;
    }

    .stream-video-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--nostrc-color-background, #f5f5f5);
      border-radius: var(--nostrc-border-radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--nostrc-stream-text-secondary);
      padding: var(--nostrc-spacing-lg);
      text-align: center;
      min-height: 300px;
      max-height: 600px;
    }

    .stream-video {
      width: 100%;
      max-width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--nostrc-border-radius-md);
      background-color: #000;
      display: block;
    }

    .stream-preview-image {
      width: 100%;
      position: relative;
    }

    .stream-preview-image img {
      width: 100%;
      height: auto;
      max-height: 500px;
      object-fit: contain;
      border-radius: var(--nostrc-border-radius-md);
      display: block;
    }

    .stream-preview-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--nostrc-color-background, #f5f5f5);
      border-radius: var(--nostrc-border-radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--nostrc-stream-text-secondary);
      padding: var(--nostrc-spacing-lg);
      min-height: 300px;
    }

    .stream-preview-placeholder-icon {
      font-size: 3em;
      margin-bottom: var(--nostrc-spacing-sm);
      opacity: 0.5;
    }

    .stream-recording-link {
      margin-top: var(--nostrc-spacing-md);
      text-align: center;
    }

    .stream-recording-link a {
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

    .stream-recording-link a:hover {
      background-color: var(--nostrc-color-primary, #6a00d1);
      transform: translateY(-1px);
    }

    .recording-icon {
      font-size: 1.2em;
    }

    /* === STREAM METADATA === */
    .stream-metadata {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-md);
    }

    .stream-summary {
      color: var(--nostrc-stream-text-primary);
      line-height: 1.6;
      word-break: break-word;
    }

    .stream-participant-count {
      color: var(--nostrc-stream-text-secondary);
      font-size: var(--nostrc-font-size-base);
    }

    .stream-participant-count strong {
      color: var(--nostrc-stream-text-primary);
      font-weight: var(--nostrc-font-weight-medium);
    }

    .stream-timestamps {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-xs);
      color: var(--nostrc-stream-text-secondary);
      font-size: var(--nostrc-font-size-small);
    }

    .stream-start-time,
    .stream-end-time {
      display: block;
    }

    .stream-hashtags {
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
    .stream-participants {
      margin-top: var(--nostrc-spacing-md);
    }

    .participants-title {
      color: var(--nostrc-stream-text-primary);
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
      color: var(--nostrc-stream-text-secondary);
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
      background-color: var(--nostrc-stream-hover-bg);
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
      color: var(--nostrc-stream-text-primary);
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
      color: var(--nostrc-stream-text-secondary);
    }

    .participant-proof {
      color: var(--nostrc-stream-status-live-color);
      font-weight: var(--nostrc-font-weight-bold);
      font-size: 1.2em;
      flex-shrink: 0;
    }

    /* === ERROR STATE === */
    .stream-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--nostrc-spacing-md);
      padding: var(--nostrc-spacing-xl);
      text-align: center;
    }

    .stream-error .error-icon {
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

    .stream-error .error-message {
      color: var(--nostrc-color-error-text);
      font-size: var(--nostrc-font-size-base);
    }

    /* === RESPONSIVE DESIGN === */
    @media only screen and (max-width: 768px) {
      .nostr-stream-container {
        padding: var(--nostrc-spacing-sm);
        gap: var(--nostrc-spacing-md);
      }

      .stream-title {
        font-size: var(--nostrc-font-size-base);
      }

      .stream-video,
      .stream-video-placeholder,
      .stream-preview-placeholder {
        aspect-ratio: 16 / 9;
        max-height: 400px;
      }

      .stream-header {
        flex-wrap: wrap;
      }

      .stream-header-right {
        width: 100%;
        margin-top: var(--nostrc-spacing-xs);
      }

      .stream-status-badge {
        font-size: var(--nostrc-font-size-small);
        padding: 4px var(--nostrc-spacing-xs);
      }

      .participants-list {
        max-height: 300px;
      }

      .stream-timestamps {
        font-size: var(--nostrc-font-size-small);
      }
    }

    @media only screen and (max-width: 480px) {
      .stream-title {
        font-size: var(--nostrc-font-size-base);
      }

      .stream-video,
      .stream-video-placeholder,
      .stream-preview-placeholder {
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
