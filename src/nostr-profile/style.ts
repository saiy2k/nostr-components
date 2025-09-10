// SPDX-License-Identifier: MIT

import { Theme } from '../common/types';

export function getProfileStyles(theme: Theme) {
  return `
    <style>
      :host {
        /* ===== Size / Box ===== */
        --nstrc-profile-width: 100%;
        --nstrc-profile-padding: 10px 16px;

          /* ===== Typography ===== */
        --nstrc-profile-font-size: 1em;

        /* ===== Color Tokens (raw) ===== */
        --nstrc-profile-background-light: #f5f5f5;
        --nstrc-profile-background-dark: #000000;

        --nstrc-profile-text-primary-light: #111111;
        --nstrc-profile-text-primary-dark: #ffffff;

        --nstrc-profile-text-grey-light: #808080;
        --nstrc-profile-text-grey-dark: #666666;

        --nstrc-profile-banner-placeholder-color-light: #e5e5e5;
        --nstrc-profile-banner-placeholder-color-dark: #222222;

        --nstrc-profile-copy-foreground-color-light: #222222;
        --nstrc-profile-copy-foreground-color-dark: #CCCCCC;

        --nstrc-profile-skeleton-min-hsl-light: 200, 20%, 80%;
        --nstrc-profile-skeleton-max-hsl-light: 200, 20%, 95%;
        --nstrc-profile-skeleton-min-hsl-dark: 200, 20%, 20%;
        --nstrc-profile-skeleton-max-hsl-dark: 200, 20%, 30%;

        /* ===== Computed (theme-resolved) ===== */
        --nstrc-profile-background: var(--nstrc-profile-background-${theme});
        --nstrc-profile-text-primary: var(--nstrc-profile-text-primary-${theme});
        --nstrc-profile-text-grey: var(--nstrc-profile-text-grey-${theme});
        --nstrc-profile-banner-placeholder: var(--nstrc-profile-banner-placeholder-color-${theme});
        --nstrc-profile-copy-foreground: var(--nstrc-copy-foreground-color-${theme});
        --nstrc-profile-skeleton-min-hsl: var(--nstrc-profile-skeleton-min-hsl-${theme});
        --nstrc-profile-skeleton-max-hsl: var(--nstrc-profile-skeleton-max-hsl-${theme});

        --nstrc-profile-accent: var(--nstrc-profile-accent, #ca077c);

        /* ===== Host element styles ===== */
        width: var(--nstrc-profile-width, 240px);
        max-width: 100%;
        box-sizing: border-box;
        display: inline-block;

        /* Override follow button styles for profile context */
        --nstrc-follow-btn-padding: 5px 8px !important;
        --nstrc-follow-btn-font-size: 14px !important;
        --nstrc-follow-btn-border-radius: 12px !important;
        --nstrc-follow-btn-border-dark: 1px solid #DDDDDD !important;
        --nstrc-follow-btn-border-light: 1px solid #DDDDDD !important;
        --nstrc-follow-btn-horizontal-alignment: end !important;
        --nstrc-follow-btn-min-height: auto !important;
        --nstrc-follow-btn-width: 280px;
      }

      .nostr-profile-container {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;

        width: 100%;
        min-height: 500px;
        box-sizing: border-box;
        border: 1px solid #CCC;

        border-radius: 5px;

        background-repeat: no-repeat;
        background-color: var(--nstrc-profile-background);
        font-family: Nacelle, sans-serif;
        font-size: var(--nstrc-profile-font-size);
        overflow-wrap: break-word;
      }

      .nostr-profile-container.is-clickable:hover {
        cursor: pointer;
        background-color: var(--nstrc-profile-hover-background, rgba(0, 0, 0, 0.05));
      }

      .nostr-profile-container.is-error {
        color: #d32f2f;
        justify-content: center;
        align-items: center;
      }

      .nostr-profile-top-container img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }

      .nostr-profile-bottom-container {
        min-width: 0;
        text-align: center;
      }

      #profile_banner {
        width: 100%;
        height: 214px;
        overflow: hidden;
        cursor: pointer;
      }

      #profile_banner a {
        outline: none;
        color: var(--nstrc-profile-accent);
      }

      #profile_banner a img {
        color: var(--nstrc-profile-accent);
        max-width: 100%;
        border-style: none;
        display: block;
        z-index: 22;
        width: 100%;
        height: 214px;
        object-fit: cover;
      }

      #profile_banner .banner-placeholder {
        width: 100%;
        height: 214px;
        background-color: var(--nstrc-profile-banner-placeholder-color);
      }

      .dp_container {
        position: absolute;
        top: 140px;
        left: 15px;
      }

      .avatar {
        --avatar-size: 142px;
        --avatar-ring: 4px;

        inline-size: var(--avatar-size);
        block-size: var(--avatar-size);
        border-radius: 50%;
        overflow: hidden;

        /* ring + backfill in one place */
        background-color: var(--nstrc-profile-background);
        border: var(--avatar-ring) solid var(--nstrc-profile-background);
      }

      .avatar img {
        inline-size: 100%;
        block-size: 100%;
        border-radius: 50%;
        display: block;
        object-fit: cover;
      }

      .profile_actions {
        height: 56px;
        align-self: flex-end;
        padding: 0 18px;
      }

      .profile_data {
        display: block;
        margin-inline: 20px;
        min-height: 52px;
      }

      .basic_info {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .name {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        max-width: 60%;
        height: 100%;
      }

      .name-text {
        color: var(--nstrc-profile-text-primary);
        line-height: 1;
        font-weight: 700;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        vertical-align: baseline;
        padding-bottom: 4px;
      }

      .verification-check {
        width: 20px;
        height: 20px;
      }

      .verification-icon {
        width: 20px;
        height: 20px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-inline: 4px;
      }

      ._whiteCheckL_lfbpc_49 {
        width: 12px;
        height: 12px;
        top: 4px;
        left: 4px;
        border-radius: 50%;
        background-color: #fff;
        position: absolute;
      }

      ._verifiedIconPrimal_lfbpc_30 {
        width: 100%;
        height: 100%;
        background: var(--nstrc-profile-accent);
        mask: url(https://primal.net/assets/verified-84f47cd3.svg) no-repeat 0/100%;
      }

      .joined {
        font-weight: 400;
        font-size: 1em;
        line-height: 16px;
        text-align: right;
        color: var(--nstrc-profile-text-grey);
      }

      .about {
        margin-inline: 20px;
        font-weight: 400;
        font-size: 1em;
        line-height: 20px;
        color: var(--nstrc-profile-text-primary);
      }

      .links {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-inline: 20px;
      }

      .website {
        font-weight: 400;
        font-size: 1em;
        line-height: 20px;
        display: flex;
        align-items: center;
      }

      .website a {
        line-height: 20px;
        outline: none;
        color: var(--nstrc-profile-accent);
        max-width: 350px;
        overflow: hidden;
        text-overflow: ellipsis;
        word-wrap: normal;
      }

      .stats {
        position: relative;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        padding-inline: 8px;
        border-radius: 0;
        border-top: none;
        background-color: var(--nstrc-profile-background);
        margin-top: 8px;
      }

      .stat {
        position: relative;
        display: inline-block;
        padding-inline: 14px;
        padding-block: 2px;
        border: none;
        background: none;
        width: fit-content;
        height: 40px;
        margin: 0 0 12px;
      }

      .stat-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .stat-inner .stat-value {
        font-weight: 100;
        font-size: 2em;
        line-height: 24px;
        color: var(--nstrc-profile-text-primary);
      }

      .stat-inner .stat-name {
        font-weight: 400;
        line-height: 16px;
        color: var(--nstrc-profile-text-grey);
        text-transform: lowercase;
      }

      .error-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        min-height: 500px;
      }

      .error {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        background-color: red;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #FFF;
      }

      .error-text {
        color: red;
        font-weight: bold;
      }

      .npub-container {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
        width: 100%;
      }

      .npub {
        color: #a2a2a2;
        display: flex;
        align-items: center;
        gap: 4px;
        word-break: break-all;
        font-family: monospace;
        font-size: 13px;
      }
      
      .profile-ids {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 4px;
        color: var(--nstrc-profile-text-grey);
        font-size: 14px;
        width: 100%;
      }
      
      .nip05-container {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .nip05 {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .npub.full {
        display: inline !important;
      }

      .npub.masked {
        display: none !important;
      }

      @media only screen and (max-width: 600px) {
        .stat .stat-value {
          font-size: 18px !important;
        }

        .npub.full {
          display: none !important;
        }

        .npub.masked {
          display: inline !important;
        }
      }

      @media only screen and (max-width: 600px) {
        :host {
          --nstrc-follow-btn-padding: 5px 8px !important;
          --nstrc-follow-btn-font-size: 12px !important;
          --nstrc-follow-btn-min-height: auto !important;
          --nstrc-follow-btn-border-radius: 8px !important;
          --nstrc-follow-btn-error-max-width: 150px !important;
        }
      }

      .nostr-profile-container .skeleton {
          animation: profile-skeleton-loading 0.5s linear infinite alternate;
      }

      @keyframes profile-skeleton-loading {
          0% {
              background-color: hsl(var(--nstrc-profile-skeleton-min-hsl));
          }
          100% {
              background-color: hsl(var(--nstrc-profile-skeleton-max-hsl));
          }
      }

      .nc-copy-btn {
        display: flex;
        font-size: 16px;
        min-width: 15px;
        min-height: 15px;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-weight: bold;
        color: var(--nstrc-profile-copy-foreground-color);
        border: none;
        background: var(--nstrc-profile-badge-background);
      }

      .nc-copy-btn:hover {
        opacity: 1;
      }
    </style>
  `;
}
