/**
 * Nostr Profile Badge CSS Variables:
 *
 * --nstrc-profile-badge-background-[light|dark]: Background color
 * --nstrc-profile-badge-name-color-[light|dark]: Name text color
 * --nstrc-profile-badge-nip05-color-[light|dark]: NIP-05 text color
 * --nstrc-profile-badge-text-color-[light|dark]: General text color
 * --nstrc-profile-badge-skeleton-min-hsl-[light|dark]: Skeleton loader min color
 * --nstrc-profile-badge-skeleton-max-hsl-[light|dark]: Skeleton loader max color
 * --nstrc-profile-badge-border-[light|dark]: Border style
 * --nstrc-profile-badge-hover-background-[light|dark]: Hover background color
 *
 * You can override these variables in your global CSS or on the host element.
 */
import { Theme } from "../common/types";

export function getProfileBadgeStyles(theme: Theme): string {
  return `
    <style>
      :host {
        /* Light theme (default) */
        --nstrc-profile-badge-background-light: #fff;
        --nstrc-profile-badge-name-color-light: #444;
        --nstrc-profile-badge-nip05-color-light: #808080;
        --nstrc-profile-badge-text-color-light: #666666;
        --nstrc-profile-badge-skeleton-min-hsl-light: #f0f0f0;
        --nstrc-profile-badge-skeleton-max-hsl-light: #e0e0e0;
        --nstrc-profile-badge-border-light: 1px solid #e0e0e0;
        --nstrc-profile-badge-hover-background-light: #f5f5f5;
        
        /* Dark theme */
        --nstrc-profile-badge-background-dark: #1a1a1a;
        --nstrc-profile-badge-name-color-dark: #ffffff;
        --nstrc-profile-badge-nip05-color-dark: #a0a0a0;
        --nstrc-profile-badge-text-color-dark: #a0a0a0;
        --nstrc-profile-badge-skeleton-min-hsl-dark: rgb(62, 43, 43);
        --nstrc-profile-badge-skeleton-max-hsl-dark: #333333;
        --nstrc-profile-badge-border-dark: 1px solid #333333;
        --nstrc-profile-badge-hover-background-dark: #2a2a2a;

        /* Define CSS variables on the host element */
        --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-${theme});
        --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-${theme});
        --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-${theme});
        --nstrc-profile-badge-text-color: var(--nstrc-profile-badge-text-color-${theme});
        --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-${theme});
        --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-${theme});
        --nstrc-profile-badge-border: var(--nstrc-profile-badge-border-${theme});
        --nstrc-profile-badge-hover-background: var(--nstrc-profile-badge-hover-background-${theme});
        display: block;
        contain: content;
      }

      .nostr-profile-badge-wrapper {
        /* Wrapper to contain all the component's content */
        display: block;
        width: 100%;
        height: 100%;
      }

      .nostr-profile-badge-container {
        display: flex;
        gap: 12px;
        padding: 8px;
        border-radius: 8px;
        background-color: var(--nstrc-profile-badge-background);
        border: var(--nstrc-profile-badge-border, none);
        cursor: pointer;
        transition: background-color 0.2s ease;
        box-sizing: border-box;
      }

      .nostr-profile-badge-container:hover {
        background-color: var(--nstrc-profile-badge-hover-background, rgba(0, 0, 0, 0.05));
      }

      .nostr-profile-badge-left-container {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
      }

      .nostr-profile-badge-left-container img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-profile-badge-right-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex-grow: 1;
        min-width: 0;
      }

      .nostr-profile-badge-name {
        font-weight: 600;
        font-size: 16px;
        color: var(--nstrc-profile-badge-name-color, #444);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nostr-profile-badge-nip05 {
        font-size: 14px;
        color: var(--nstrc-profile-badge-nip05-color, #808080);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .npub-container {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: monospace;
        font-size: 12px;
        color: var(--nstrc-profile-badge-text-color, #666666);
      }

      .copy-button {
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .copy-button:hover {
        opacity: 1;
      }

      /* Skeleton loading styles */
      .skeleton {
        background: linear-gradient(
          90deg,
          var(--nstrc-profile-badge-skeleton-min-hsl, #f0f0f0) 0%,
          var(--nstrc-profile-badge-skeleton-max-hsl, #e0e0e0) 50%,
          var(--nstrc-profile-badge-skeleton-min-hsl, #f0f0f0) 100%
        );
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
        border-radius: 4px;
      }

      .img-skeleton {
        width: 48px;
        height: 48px;
        border-radius: 50% !important;
      }

      .text-skeleton-name {
        width: 120px;
        height: 16px;
        margin-bottom: 6px;
      }

      .text-skeleton-nip05 {
        width: 160px;
        height: 14px;
      }

      @keyframes skeleton-loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      /* Error state */
      .error {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: #ffebee;
        color: #d32f2f;
        font-size: 24px;
      }

      .error-text {
        color: #d32f2f;
        font-size: 14px;
      }
    </style>
  `;
}
