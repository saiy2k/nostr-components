import { Theme } from './types';
import { checkmarkIcon, nostrLogo } from './icons';

export function getNostrLogo(theme: Theme, width: number = 21, height: number = 24) {
  return nostrLogo(theme, width, height);
}

import { loadingNostrich } from './icons';

export function getLoadingNostrich(
  theme: Theme = 'dark',
  width: number = 25,
  height: number = 25
) {
  return loadingNostrich(width, height, theme);
}

export function getSuccessAnimation(
  theme: Theme = 'dark',
  width: number = 25,
  height: number = 25
) {
  return checkmarkIcon(theme, width, height);
}


// Function for NostrPost styles (legacy/innerHTML)
export function getPostStylesLegacy(theme: Theme): string {
  let variables = ``;
  if (theme === 'dark') {
    variables = `
        --nstrc-post-background: var(--nstrc-post-background-dark);
        --nstrc-post-name-color: var(--nstrc-post-name-color-dark);
        --nstrc-post-nip05-color: var(--nstrc-post-nip05-color-dark);
        --nstrc-post-skeleton-min-hsl: var(--nstrc-post-skeleton-min-hsl-dark);
        --nstrc-post-skeleton-max-hsl: var(--nstrc-post-skeleton-max-hsl-dark);
        --nstrc-post-text-color: var(--nstrc-post-text-color-dark);
        --nstrc-post-stats-color: var(--nstrc-post-stat-text-color-dark);
        `;
  } else {
    variables = `
        --nstrc-post-background: var(--nstrc-post-background-light);
        --nstrc-post-name-color: var(--nstrc-post-name-color-light);
        --nstrc-post-nip05-color: var(--nstrc-post-nip05-color-light);
        --nstrc-post-skeleton-min-hsl: var(--nstrc-post-skeleton-min-hsl-light);
        --nstrc-post-skeleton-max-hsl: var(--nstrc-post-skeleton-max-hsl-light);
        --nstrc-post-text-color: var(--nstrc-post-text-color-light);
        --nstrc-post-stats-color: var(--nstrc-post-stat-text-color-light);
      `;
  }

  // NOTE: Glide CSS links are handled directly in NostrPost.render() for this legacy version
  return `
          <style>
            nostr-post { /* Use host tag selector for scoping */
              --nstrc-post-background-light: #f5f5f5;
              --nstrc-post-background-dark: #000000;
              --nstrc-post-name-color-light: #444;
              --nstrc-post-name-color-dark: #CCC;
              --nstrc-post-nip05-color-light: #808080;
              --nstrc-post-nip05-color-dark: #757575;
              --nstrc-post-skeleton-min-hsl-light: 200, 20%, 80%;
              --nstrc-post-skeleton-min-hsl-dark: 200, 20%, 20%;
              --nstrc-post-skeleton-max-hsl-light: 200, 20%, 95%;
              --nstrc-post-skeleton-max-hsl-dark: 200, 20%, 30%;
              --nstrc-post-text-color-light: #222;
              --nstrc-post-text-color-dark: #d4d4d4;
              --nstrc-post-stat-text-color-light: #222;
              --nstrc-post-stat-text-color-dark: #d0d0d0;

              --nstrc-post-name-font-weight: 700;
              --nstrc-post-nip05-font-weight: 400;

              --nstrc-post-accent: #ca077c;

              ${variables}
            }
            
            nostr-post a { /* Scope link color */
              color: var(--nstrc-post-accent);
            }

            /* Keep other styles targeting elements within nostr-post */
            nostr-post .post-container {
                font-family: sans-serif;
                padding: 20px;

                display: flex;
                flex-direction: column;
                gap: 20px;

                border: 1px solid #d9d9d9;
                border-radius: 10px;

                background-color: var(--nstrc-post-background);

                color: var(--nstrc-post-text-color);

                cursor: pointer;
            }

            nostr-post .post-container .post-header {
                display: flex;
                gap: 10px;
            }
            
            nostr-post .post-body {
              display: block;
              width: 100%;
            }

            nostr-post .post-header-left {
                width: 35px;
            }

            nostr-post .post-header-left img {
                width: 35px;
                border-radius: 50%;
            }

            nostr-post .post-header-middle {
                display: flex;
                flex-direction: column;
                width: 100%;
                gap: 5px;
            }

            nostr-post .post-header-right {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: end;
            }

            nostr-post .author-name {
              color: var(--nstrc-post-name-color);
              font-weight: var(--nstrc-post-name-font-weight);
                  word-break: break-word;
            }

            nostr-post .author-username {
                font-weight: var(--nstrc-post-nip05-font-weight);
                color: var(--nstrc-post-nip05-color);
                font-size: 14px;
                word-break: break-all;
            }

            nostr-post .text-content {
              word-break: break-word;
            }

            nostr-post .glide__slide {
                width: 100%;
            }

            nostr-post .glide__slide * {
                border-radius: 10px;
            }

            nostr-post .glide__bullets button {
                border: 1px solid #000; /* Example, adjust as needed */
            }

            nostr-post .post-container .skeleton {
              animation: post-skeleton-loading 0.5s linear infinite alternate;
            }

            @keyframes post-skeleton-loading {
              0% {
                background-color: hsl(var(--nstrc-post-skeleton-min-hsl));
              }
              100% {
                background-color: hsl(var(--nstrc-post-skeleton-max-hsl));
              }
            }

          nostr-post .error-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }

          nostr-post .error {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            background-color: red;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 20px;
            color: #FFF;
          }

          nostr-post .error-text {
            color: red;
            font-weight: bold;
          }

          nostr-post .post-footer {
            margin-top: 20px; /* Adjusted margin based on isError logic removal */
            display: block; /* Ensure it takes full width */
            width: 100%;    /* Ensure it takes full width */
          }

          nostr-post .stats-container {
            display: flex;
            gap: 20px;
          }

          nostr-post .stat {
            display: flex;
            align-items: center;
            gap: 5px;
            color: var(--nstrc-post-stats-color);
          }

          /* Media styling */
          nostr-post .post-media-item {
            width: 100%;
            margin: 10px 0;
            display: flex;
            justify-content: center;
          }

          nostr-post .post-media-item img,
          nostr-post .post-media-item video {
            max-width: 100%;
            max-height: 500px;
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 10px;
            display: block;
          }

          /* Embedded media styling */
          nostr-post .embedded-media-item {
            width: 100%;
            border-radius: 8px;
            overflow: hidden;
            margin: 5px 0;
          }

          nostr-post .embedded-media-item img,
          nostr-post .embedded-media-item video {
            width: 100%;
            max-height: 500px;
            object-fit: contain;
            display: block;
          }
        </style>
      `;
}

// New function for NostrProfileBadge styles (legacy/innerHTML)
export const getProfileBadgeStylesLegacy = (theme: Theme) => {
  // Define base variables and styles, scoped to 'nostr-profile-badge'
  let styles = `
    nostr-profile-badge {
      /* Base Variables */
      --nstrc-profile-badge-background-light: #f5f5f5;
      --nstrc-profile-badge-background-dark: #121212;
      --nstrc-profile-badge-text-color-light: #000;
      --nstrc-profile-badge-text-color-dark: #fff;
      --nstrc-profile-badge-border-color-light: #ddd;
      --nstrc-profile-badge-border-color-dark: #333;
      --nstrc-profile-badge-hover-background-color-light: #f0f0f0;
      --nstrc-profile-badge-hover-background-color-dark: #151515;
      --nstrc-profile-badge-hover-text-color-light: #333;
      --nstrc-profile-badge-hover-text-color-dark: #ccc;
      --nstrc-profile-badge-focus-background-color-light: #e0e0e0;
      --nstrc-profile-badge-focus-background-color-dark: #1a1a1a;
      --nstrc-profile-badge-focus-text-color-light: #666;
      --nstrc-profile-badge-focus-text-color-dark: #aaa;
      --nstrc-profile-badge-error-color: #f44336;
      --nstrc-profile-badge-error-background-color: #fbe9e7;
      --nstrc-profile-badge-error-border-color: #f44336;
      --nstrc-profile-badge-error-text-color: #f44336;
      --nstrc-profile-badge-loading-color: #2196f3;
      --nstrc-profile-badge-loading-background-color: #e0e0e0;
      --nstrc-profile-badge-loading-border-color: #2196f3;
      --nstrc-profile-badge-loading-text-color: #2196f3;

      /* Base Styles */
      display: inline-flex; /* Changed from flex to inline-flex */
      align-items: center;
      padding: 5px 10px; /* Adjusted padding */
      border: 1px solid var(--nstrc-profile-badge-border-color-light);
      border-radius: 15px; /* Adjusted border-radius */
      background-color: var(--nstrc-profile-badge-background-light);
      color: var(--nstrc-profile-badge-text-color-light);
      cursor: pointer;
      font-family: Inter, sans-serif; /* Added default font */
      max-width: 300px; /* Added max-width */
      overflow: hidden; /* Prevent content overflow */
      text-overflow: ellipsis; /* Add ellipsis for overflow */
      white-space: nowrap; /* Keep content on one line */
    }

    nostr-profile-badge .nostr-profile-badge-container {
      display: flex;
      align-items: center;
      width: 100%; /* Ensure container takes full width */
    }

    nostr-profile-badge .nostr-profile-badge-left-container {
      margin-right: 8px; /* Adjusted margin */
      flex-shrink: 0; /* Prevent image from shrinking */
    }

    nostr-profile-badge img {
        width: 25px; /* Adjusted size */
        height: 25px; /* Adjusted size */
        border-radius: 50%;
        object-fit: cover; /* Ensure image covers the area */
    }

    nostr-profile-badge .nostr-profile-badge-right-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden; /* Hide overflow */
      min-width: 0; /* Allow shrinking */
    }

    nostr-profile-badge .nostr-profile-badge-name {
      font-weight: bold;
      font-size: 14px; /* Adjusted font size */
      margin-bottom: 2px; /* Adjusted margin */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    nostr-profile-badge .nostr-profile-badge-nip05 {
      font-size: 12px; /* Adjusted font size */
      color: grey; /* Adjusted color */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    nostr-profile-badge .nostr-profile-badge-nip05 a {
      text-decoration: none;
      color: inherit; /* Inherit color */
    }

    nostr-profile-badge .nostr-profile-badge-nip05 a:hover {
      text-decoration: underline;
    }

    /* Loading State */
    nostr-profile-badge.loading {
      background-color: var(--nstrc-profile-badge-loading-background-color);
      border-color: var(--nstrc-profile-badge-loading-border-color);
      color: var(--nstrc-profile-badge-loading-text-color);
    }

    nostr-profile-badge .skeleton {
        background-color: #e0e0e0; /* Simplified skeleton color */
        border-radius: 4px;
        display: inline-block;
        line-height: 1;
    }

    nostr-profile-badge .skeleton.img-skeleton {
        width: 25px;
        height: 25px;
        border-radius: 50%;
    }

    nostr-profile-badge .skeleton.text-skeleton-name {
        width: 70%;
        height: 14px;
        margin-bottom: 2px;
    }

    nostr-profile-badge .skeleton.text-skeleton-nip05 {
        width: 90%;
        height: 12px;
    }

    /* Error State */
    nostr-profile-badge.error-container {
      background-color: var(--nstrc-profile-badge-error-background-color);
      border-color: var(--nstrc-profile-badge-error-border-color);
      color: var(--nstrc-profile-badge-error-text-color);
    }
    nostr-profile-badge .error {
      color: var(--nstrc-profile-badge-error-color);
      font-size: 18px; /* Adjusted size */
    }
    nostr-profile-badge .error-text {
        font-size: 12px;
        margin-left: 5px;
    }

    /* Dark Theme */
    nostr-profile-badge.dark {
      background-color: var(--nstrc-profile-badge-background-dark);
      border-color: var(--nstrc-profile-badge-border-color-dark);
      color: var(--nstrc-profile-badge-text-color-dark);
    }
    nostr-profile-badge.dark .nostr-profile-badge-nip05 {
        color: #aaa; /* Adjusted dark theme nip05 color */
    }
    nostr-profile-badge.dark .skeleton {
        background-color: #424242; /* Darker skeleton */
    }
  `;

  // Append theme-specific overrides
  if (theme === 'dark') {
    styles += `
      nostr-profile-badge {
        border-color: var(--nstrc-profile-badge-border-color-dark);
        background-color: var(--nstrc-profile-badge-background-dark);
        color: var(--nstrc-profile-badge-text-color-dark);
      }
    `;
  }

  return `<style>${styles}</style>`;
};

// Function for NostrProfile styles
export function getProfileStyles(theme: Theme) {
  let variables = ``;

  if (theme === 'dark') {
    variables = `
    --nstrc-profile-background: var(--nstrc-profile-background-dark, #000000);
    --nstrc-profile-skeleton-min-hsl: var(--nstrc-profile-skeleton-min-hsl-dark, 200, 20%, 20%);
    --nstrc-profile-skeleton-max-hsl: var(--nstrc-profile-skeleton-max-hsl-dark, 200, 20%, 30%);
    --nstrc-profile-text-primary: var(--nstrc-profile-text-primary-dark, #ffffff);
    --nstrc-profile-text-grey: var(--nstrc-profile-text-grey-dark, #666666);
    --nstrc-profile-banner-placeholder-color: var(--nstrc-profile-banner-placeholder-color-dark, #222222);
    --nstrc-profile-copy-foreground-color: var(--nstrc-profile-copy-foreground-color-dark, #CCC);
    `;
  } else {
    variables = `
    --nstrc-profile-background: var(--nstrc-profile-background-light, #f5f5f5);
    --nstrc-profile-skeleton-min-hsl: var(--nstrc-profile-skeleton-min-hsl-light, 200, 20%, 80%);
    --nstrc-profile-skeleton-max-hsl: var(--nstrc-profile-skeleton-max-hsl-light, 200, 20%, 95%);
    --nstrc-profile-text-primary: var(--nstrc-profile-text-primary-light, #111111);
    --nstrc-profile-text-grey: var(--nstrc-profile-text-grey-light, #808080);
    --nstrc-profile-banner-placeholder-color: var(--nstrc-profile-banner-placeholder-color-light, #e5e5e5);
    --nstrc-profile-copy-foreground-color: var(--nstrc-profile-copy-foreground-color-light, #222);
    `;
  }

  return `
  <style>
  :host {
      ${variables}

      --nstrc-profile-accent: var(--nstrc-profile-accent, #ca077c);

      /* Override follow button styles for profile context */
      --nstrc-follow-btn-padding: 5px 8px !important;
      --nstrc-follow-btn-font-size: 14px !important;
      --nstrc-follow-btn-border-radius: 12px !important;
      --nstrc-follow-btn-border-dark: 1px solid #DDDDDD !important;
      --nstrc-follow-btn-border-light: 1px solid #DDDDDD !important;
      --nstrc-follow-btn-horizontal-alignment: end !important;
      --nstrc-follow-btn-min-height: auto !important;
    }

      .nostr-profile .skeleton {
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

    .nostr-profile {
      -webkit-tap-highlight-color: transparent;
      text-size-adjust: 100%;
      font-weight: 400;
      font-size: 18px;
      line-height: 1.5;
      text-rendering: optimizeLegibility;
      overflow-wrap: break-word;
      font-family: Nacelle, sans-serif;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
      background-repeat: no-repeat;
      min-height: 500px;
      border: 1px solid #CCC;
      border-radius: 5px;
      background-color: var(--nstrc-profile-background);
    }

    #profile {
      position: relative;
      background-color: var(--nstrc-profile-background);
      padding-bottom: 4px;
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
      overflow: hidden;
    }

    .avatar_container {
      border: solid 4px var(--nstrc-profile-background);
      border-radius: 50%;
      background-color: var(--nstrc-profile-background);
    }

    .avatar_wrapper {
      display: block;
      min-height: 142px;
    }

    .xxl_avatar {
      position: relative;
      background-color: var(--nstrc-profile-background);
      border-radius: 50%;
      width: 142px;
      height: 142px;
    }

    .backfill {
      background-color: var(--nstrc-profile-background);
      border-radius: 50%;
      width: 142px;
      height: 142px;
    }

    .backfill a {
      outline: none;
    }

    .backfill a img {
      max-width: 100%;
      border-style: none;
      display: block;
      z-index: 22;
      border-radius: 50%;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile_actions {
      height: 76px;
      display: flex;
      justify-content: end;
      align-items: center;
      padding: 0 18px;
    }

    .profile_data {
      display: block;
      margin-inline: 20px;
      min-height: 52px;
      margin-top: 14px;
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
      font-size: 20px;
      line-height: 1;
      font-weight: 700;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      vertical-align: baseline;
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
      font-size: 14px;
      line-height: 16px;
      text-align: right;
      color: var(--nstrc-profile-text-grey);
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

    .nip05-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      color: var(--nstrc-profile-text-grey);
      font-weight: 400;
      font-size: 14px;
      line-height: 16px;
      margin-top: 2px;
      margin-bottom: 16px;
    }

    .nip05-container {
      color: var(--nstrc-profile-text-grey);
      font-weight: 400;
      font-size: 14px;
      line-height: 16px;
      display: flex;
      align-items: center;
    }

    .nip05 {
      color: var(--nstrc-profile-text-grey);
      font-weight: 400;
      font-size: 14px;
      line-height: 16px;
      width: 100%;
      overflow: hidden;
      display: flex;
      gap: 5px;
    }

    .about {
      margin-inline: 20px;
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      color: var(--nstrc-profile-text-primary);
    }

    .links {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-inline: 20px;
      margin-block: 12px;
    }

    .website {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      display: flex;
      align-items: center;
    }

    .website a {
      font-weight: 400;
      font-size: 14px;
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
      padding-top: 22px;
      border-top: none;
      background-color: var(--nstrc-profile-background);
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
      font-weight: 400;
      font-size: 24px;
      line-height: 24px;
      color: var(--nstrc-profile-text-primary);
    }

    .stat-inner .stat-name {
      font-weight: 400;
      font-size: 14px;
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
      font-size: 20px;
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

    .copy-button {
      display: flex;
      font-size: 16px;
      min-width: 15px;
      min-height: 15px;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
      color: var(--nstrc-profile-copy-foreground-color);
    }

    @media only screen and (max-width: 600px) {
      button.stat .stat-value {
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

  </style>
  `;
}
