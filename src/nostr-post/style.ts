// SPDX-License-Identifier: MIT

import { Theme } from '../common/types';

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
            nostr-post .nostr-post-container {
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

            nostr-post .nostr-post-container .post-header {
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

            nostr-post .nostr-post-container .skeleton {
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

export function getPostStyles(theme: Theme): string {
  return `
    <style>
      .nostr-mention {
        color: #1DA1F2;
        font-weight: 500;
        cursor: pointer;
      }
      
      /* Embedded post styles */
      .embedded-post {
        margin: 10px 0;
        padding: 12px;
        border: 1px solid ${theme === 'light' ? '#e1e8ed' : '#38444d'};
        border-radius: 12px;
        background: ${theme === 'light' ? '#f8f9fa' : '#192734'};
      }
      
      .embedded-post-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .embedded-author-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 8px;
      }
      
      .embedded-author-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .embedded-author-info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      
      .embedded-author-name {
        font-weight: bold;
        font-size: 14px;
        color: ${theme === 'light' ? '#14171a' : '#ffffff'};
      }
      
      .embedded-author-username {
        font-size: 12px;
        color: ${theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-date {
        font-size: 12px;
        color: ${theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-content {
        font-size: 14px;
        color: ${theme === 'light' ? '#14171a' : '#ffffff'};
        line-height: 1.4;
        white-space: pre-line;
      }
      
      .embedded-post-media {
        margin-top: 10px;
      }
      
      .embedded-media-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .embedded-media-item {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .embedded-media-item img,
      .embedded-media-item video {
        width: 100%;
        max-height: 300px;
        object-fit: contain;
        display: block;
      }
      
      .embedded-post-error {
        padding: 10px;
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        font-size: 14px;
      }
    </style>
  
`;
}
