import { Theme } from '../common/types';

export function getFollowButtonStyles(
  theme: Theme,
): string {
  return `
      <style>
        :host {
          /* ===== Size / Box ===== */
          --nstrc-follow-btn-width: 100%;
          --nstrc-follow-btn-padding: 10px 16px;

          /* ===== Typography ===== */
          --nstrc-follow-btn-font-size: 1em;

          /* ===== Color Tokens (raw) ===== */
          --nstrc-follow-btn-background-light: #FFFFFF;
          --nstrc-follow-btn-background-dark: #000000;
          --nstrc-follow-btn-hover-background-light: #F9F9F9;
          --nstrc-follow-btn-hover-background-dark: #222222;
          --nstrc-follow-btn-text-color-light: #000000;
          --nstrc-follow-btn-text-color-dark: #FFFFFF;

          /* ===== Computed (theme-resolved) ===== */
          --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-${theme});
          --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-${theme});
          --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-${theme});

          /* ===== Border ===== */
          --nstrc-follow-btn-border-light: 1px solid #DDDDDD;
          --nstrc-follow-btn-border-dark: none;
          --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-${theme});
          --nstrc-follow-btn-border-radius: 8px;

          /* ===== Layout / Alignment ===== */
          --nstrc-follow-btn-horizontal-alignment: start;

          /* ===== Host element styles ===== */
          width: var(--nstrc-follow-btn-width, 240px);
          max-width: 100%;
          box-sizing: border-box;
          display: inline-block;
        }
  
        .nostr-follow-button-container {
          display: flex;
          align-items: center;
          gap: 12px;

          width: 100%;
          padding: var(--nstrc-follow-btn-padding);
          border: var(--nstrc-follow-btn-border);
          border-radius: var(--nstrc-follow-btn-border-radius);
          box-sizing: border-box;
          overflow: hidden;

          background-color: var(--nstrc-follow-btn-background);

          font-family: Inter, sans-serif;
          font-size: var(--nstrc-follow-btn-font-size);
          color: var(--nstrc-follow-btn-text-color);
        }
  
        .nostr-follow-button-container.is-clickable:hover {
          background-color: var(--nstrc-follow-btn-hover-background);
          cursor: pointer;
        }

        .nostr-follow-button-container.is-error {
          color: #d32f2f;
        }

        .nostr-follow-button-left-container.is-error {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .nostr-follow-button-left-container.is-error img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .nostr-follow-button-right-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex-grow: 1;
          min-width: 0;
        }

        /* Error state */
        .error-icon {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 48px;
          height: 48px;
          border-radius: 50%;

          background-color: #ffebee;
          font-size: 2em;
          color: #d32f2f;
        }

      </style>
    `;
  }
