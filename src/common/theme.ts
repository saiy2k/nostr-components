import { Theme } from './types';

export function getNostrLogo(
    theme: Theme = 'dark',
    width: number = 24,
    height: number = 21,
) {
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 21 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.7084 10.1607C18.1683 13.3466 14.8705 14.0207 12.9733 13.9618C12.8515 13.958 12.7366 14.0173 12.6647 14.1157C12.4684 14.384 12.1547 14.7309 11.9125 14.7309C11.6405 14.7309 11.3957 15.254 11.284 15.5795C11.2723 15.6137 11.3059 15.6452 11.3403 15.634C14.345 14.6584 15.5241 14.3238 16.032 14.4178C16.4421 14.4937 17.209 15.8665 17.5413 16.5434C16.7155 16.5909 16.4402 15.8507 16.2503 15.7178C16.0985 15.6116 16.0415 16.0974 16.032 16.3536C15.8517 16.2587 15.6239 16.1259 15.6049 15.7178C15.5859 15.3098 15.3771 15.4142 15.2157 15.4332C15.0544 15.4521 12.5769 16.2493 12.2067 16.3536C11.8366 16.458 11.4094 16.6004 11.0582 16.8471C10.4697 17.1318 10.09 16.9325 9.98561 16.4485C9.90208 16.0614 10.4444 14.8701 10.726 14.3229C10.3779 14.4526 9.65529 14.7158 9.54898 14.7309C9.44588 14.7457 8.13815 15.7552 7.43879 16.3038C7.398 16.3358 7.37174 16.3827 7.36236 16.4336C7.25047 17.0416 6.89335 17.2118 6.27423 17.5303C5.77602 17.7867 4.036 20.4606 3.14127 21.9041C3.0794 22.0039 2.9886 22.0806 2.8911 22.1461C2.32279 22.5276 1.74399 23.4985 1.50923 23.9737C1.17511 23.0095 1.61048 22.1802 1.86993 21.886C1.75602 21.7873 1.49341 21.8449 1.37634 21.886C1.69907 20.7757 2.82862 20.7757 2.79066 20.7757C2.99948 20.5954 5.44842 17.0938 5.50538 16.9325C5.56187 16.7725 5.46892 16.0242 6.69975 15.6139C6.7193 15.6073 6.73868 15.5984 6.75601 15.5873C7.71493 14.971 8.43427 13.9774 8.67571 13.5542C7.39547 13.4662 5.92943 12.7525 5.16289 12.294C4.99765 12.1952 4.8224 12.1092 4.63108 12.0875C3.58154 11.9687 2.53067 12.6401 2.10723 13.0228C1.93258 12.7799 2.12938 12.0739 2.24961 11.7513C1.82437 11.6905 1.19916 12.308 0.939711 12.6243C0.658747 12.184 0.904907 11.397 1.06311 11.0585C0.501179 11.0737 0.120232 11.3306 0 11.4571C0.465109 7.99343 4.02275 9.00076 4.06259 9.04675C3.87275 8.84937 3.88857 8.59126 3.92021 8.48688C6.0749 8.54381 7.08105 8.18321 7.71702 7.81313C12.7288 5.01374 14.8882 6.73133 15.6856 7.1631C16.4829 7.59487 17.9304 7.77042 18.9318 7.37187C20.1278 6.83097 19.9478 5.43673 19.7054 4.90461C19.4397 4.32101 17.9399 3.51438 17.4084 2.49428C16.8768 1.47418 17.34 0.233672 17.9558 0.0607684C18.5425 -0.103972 18.9615 0.0876835 19.2831 0.378128C19.4974 0.571763 20.0994 0.710259 20.3509 0.800409C20.6024 0.890558 21.0201 1.00918 20.9964 1.08035C20.9726 1.15152 20.5699 1.14202 20.5075 1.14202C20.3794 1.14202 20.2275 1.161 20.3794 1.23217C20.5575 1.30439 20.8263 1.40936 20.955 1.47846C20.9717 1.48744 20.9683 1.51084 20.95 1.51577C20.0765 1.75085 19.2966 1.26578 18.7183 1.82526C18.1298 2.39463 19.3827 2.83114 20.0282 3.51438C20.6736 4.19762 21.3381 5.01372 20.8065 6.87365C20.395 8.31355 18.6703 9.53781 17.7795 10.0167C17.7282 10.0442 17.7001 10.1031 17.7084 10.1607Z" fill="${theme === 'dark' ? 'white': 'black'}"/>
        </svg>
    `;
}

export function getLoadingNostrich(
    theme: Theme = 'dark',
    width: number = 25,
    height: number = 25,
) {
    return `<img width="${width}" height="${height}" src="./assets/${theme === "dark" ? "light": "dark"}-nostrich-running.gif" />`;
}

export function getSuccessAnimation(
    theme: Theme = 'dark',
    width: number = 25,
    height: number = 25,
) {
    return `
        <style>
            .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                stroke-width: 4;
                stroke-miterlimit: 10;
                stroke: ${theme === 'dark' ? '#FFF': '#000'};
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
            }

            .checkmark {
                width: ${width}px;
                height: ${height}px;
                border-radius: 50%;
                display: block;
                stroke-width: 2;
                stroke: ${theme === 'dark' ? '#FFFFFF': '#000000'};
                stroke-miterlimit: 10;
                box-shadow: inset 0px 0px 0px #7ac142;
                animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
            }

            .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                stroke-width: 4;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
            }

            @keyframes stroke {
                100% {
                    stroke-dashoffset: 0;
                }
            }
            @keyframes scale {
                0%, 100% {
                    transform: none;
            }
            50% {
                    transform: scale3d(1.1, 1.1, 1);
                }
            }
            @keyframes fill {
                100% {
                    box-shadow: inset 0px 0px 0px 30px #fff;
                    fill: #000;
                }
            }
        </style>

        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="${theme === 'dark' ? '#000': '#FFF'}"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    `;
}

export function getFollowButtonStyles(theme: Theme, isLoading: boolean) {
    let variables = ``;

    if (theme === "dark") {
      variables = `
          --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-dark);
          --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-dark);
    
          --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-dark);
          --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-dark);
      `;
    } else {
      variables = `
          --nstrc-follow-btn-background: var(--nstrc-follow-btn-background-light);
          --nstrc-follow-btn-hover-background: var(--nstrc-follow-btn-hover-background-light);
    
          --nstrc-follow-btn-text-color: var(--nstrc-follow-btn-text-color-light);
          --nstrc-follow-btn-border: var(--nstrc-follow-btn-border-light);
      `;
    }

    return `
        <style>
          :host {
            ${variables}

            --nstrc-follow-btn-padding: 10px 16px;
            --nstrc-follow-btn-font-size: 16px;
            --nstrc-follow-btn-background-dark: #000000;
            --nstrc-follow-btn-background-light: #FFFFFF;
            --nstrc-follow-btn-hover-background-dark: #222222;
            --nstrc-follow-btn-hover-background-light: #F9F9F9;
            --nstrc-follow-btn-border-dark: none;
            --nstrc-follow-btn-border-light: 1px solid #DDDDDD;
            --nstrc-follow-btn-text-color-dark: #FFFFFF;
            --nstrc-follow-btn-text-color-light: #000000;
            --nstrc-follow-btn-border-radius: 8px;
            --nstrc-follow-btn-error-font-size: 12px;
            --nstrc-follow-btn-error-line-height: 1em;
            --nstrc-follow-btn-error-max-width: 250px;
            --nstrc-follow-btn-horizontal-alignment: start;
            --nstrc-follow-btn-min-height: 47px;
          }

          .nostr-follow-button-container {
            display: flex;
            flex-direction: column;
            font-family: Inter,sans-serif;
            flex-direction: column;
            gap: 8px;
            width: fit-content;
          }

          .nostr-follow-button-wrapper {
            display: flex;
            justify-content: var(--nstrc-follow-btn-horizontal-alignment);
          }
    
          .nostr-follow-button {
            display: flex;
            align-items: center;
            gap: 12px;
            border-radius: var(--nstrc-follow-btn-border-radius);
            background-color: var(--nstrc-follow-btn-background);
            cursor: pointer;

            min-height: var(--nstrc-follow-btn-min-height);

            border: var(--nstrc-follow-btn-border);

            padding: var(--nstrc-follow-btn-padding);
            font-size: var(--nstrc-follow-btn-font-size);
            color: var(--nstrc-follow-btn-text-color);

            ${isLoading ? 'pointer-events: none; user-select: none; background-color: var(--nstrc-follow-btn-hover-background);' : ''}
          }

          .nostr-follow-button:hover {
            background-color: var(--nstrc-follow-btn-hover-background);
          }

          .nostr-follow-button-error small {
            justify-content: flex-end;
            color: red;
            font-size: var(--nstrc-follow-btn-error-font-size);
            line-height: var(--nstrc-follow-btn-error-line-height);
            max-width: var(--nstrc-follow-btn-error-max-width);
          }
        </style>
    `;
}

export function getPostStyles(theme: Theme) {
  let variables = '';

  if (theme === 'dark') {
    variables = `
      --nstrc-post-background-color: var(--nstrc-post-background-color-dark, #000000);
      --nstrc-post-border: var(--nstrc-post-border-dark, 1px solid #333333);
      --nstrc-post-text-color: var(--nstrc-post-text-color-dark, #FFFFFF);
      --nstrc-post-link-color: var(--nstrc-post-link-color-dark, #2A76FF);
      --nstrc-post-author-link-color: var(--nstrc-post-author-link-color-dark, #FFFFFF);
      --nstrc-post-nip05-color: var(--nstrc-post-nip05-color-dark, #ABABAB);
      --nstrc-post-time-color: var(--nstrc-post-time-color-dark, #ABABAB);
      --nstrc-post-stats-color: var(--nstrc-post-stats-color-dark, #ABABAB);
      --nstrc-post-loading-background: var(--nstrc-post-loading-background-dark, #333333);
      --nstrc-post-loading-foreground: var(--nstrc-post-loading-foreground-dark, #555555);
      --nstrc-post-carousel-arrow-color: var(--nstrc-post-carousel-arrow-color-dark, #ABABAB);
      --nstrc-post-carousel-arrow-background: var(--nstrc-post-carousel-arrow-background-dark, rgba(0,0,0,0.5));
    `;
  } else {
    variables = `
      --nstrc-post-background-color: var(--nstrc-post-background-color-light, #FFFFFF);
      --nstrc-post-border: var(--nstrc-post-border-light, 1px solid #DDDDDD);
      --nstrc-post-text-color: var(--nstrc-post-text-color-light, #000000);
      --nstrc-post-link-color: var(--nstrc-post-link-color-light, #2A76FF);
      --nstrc-post-author-link-color: var(--nstrc-post-author-link-color-light, #000000);
      --nstrc-post-nip05-color: var(--nstrc-post-nip05-color-light, #ABABAB);
      --nstrc-post-time-color: var(--nstrc-post-time-color-light, #ABABAB);
      --nstrc-post-stats-color: var(--nstrc-post-stats-color-light, #ABABAB);
      --nstrc-post-loading-background: var(--nstrc-post-loading-background-light, #DDDDDD);
      --nstrc-post-loading-foreground: var(--nstrc-post-loading-foreground-light, #BBBBBB);
      --nstrc-post-carousel-arrow-color: var(--nstrc-post-carousel-arrow-color-light, #ABABAB);
      --nstrc-post-carousel-arrow-background: var(--nstrc-post-carousel-arrow-background-light, rgba(255,255,255,0.5));
    `;
  }

  return `
      <style>
          :host {
            ${variables}

            --nstrc-post-font-family: Inter, sans-serif;

            --nstrc-post-container-width: 640px;
            --nstrc-post-container-border-radius: 10px;
            --nstrc-post-container-padding: 10px;

            --nstrc-post-image-border-radius: 10px;
            --nstrc-post-loading-border-radius: 10px;

            --nstrc-post-horizontal-alignment: start;
          }

          .loading-placeholder {
            display: block;
            width: var(--nstrc-post-container-width);
            max-width: 100%;
            border-radius: var(--nstrc-post-loading-border-radius);
            background: linear-gradient(90deg, var(--nstrc-post-loading-background) 25%, var(--nstrc-post-loading-foreground) 50%, var(--nstrc-post-loading-background) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            min-height: 100px; 
          }

          @keyframes loading {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }

          .post-container {
            font-family: var(--nstrc-post-font-family);
            max-width: 100%;
            width: var(--nstrc-post-container-width);
            border-radius: var(--nstrc-post-container-border-radius);
            padding: var(--nstrc-post-container-padding);
            border: var(--nstrc-post-border);
            background-color: var(--nstrc-post-background-color);
            color: var(--nstrc-post-text-color);
            cursor: pointer;
            display: flex;
            justify-content: var(--nstrc-post-horizontal-alignment);
          }

          .post-container:hover {
            border-color: var(--nstrc-post-link-color);
          }

          .post-container-wrapper {
            width: 100%;
          }

          .post-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
          }

          .post-header-left img {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            margin-right: 10px;
          }

          .post-header-middle {
            display: flex;
            flex-direction: column;
          }

          .post-header-middle .author-name {
            font-weight: bold;
            color: var(--nstrc-post-author-link-color);
          }

          .post-header-middle .nip05 {
            color: var(--nstrc-post-nip05-color);
            font-size: 0.9em;
          }

          .post-header-right {
            margin-left: auto;
            color: var(--nstrc-post-time-color);
            font-size: 0.9em;
          }

          .post-content {
            margin-bottom: 10px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }

          .post-content a {
            color: var(--nstrc-post-link-color);
            text-decoration: none;
          }

          .post-content a:hover {
            text-decoration: underline;
          }

          .post-image img, .post-video video {
            max-width: 100%;
            border-radius: var(--nstrc-post-image-border-radius);
            margin-top: 10px;
            display: block;
          }

          .post-stats {
            display: flex;
            justify-content: space-around;
            color: var(--nstrc-post-stats-color);
            margin-top: 10px;
            font-size: 0.9em;
          }

          .post-stats div {
            display: flex;
            align-items: center;
            gap: 5px;
          }

          .glide__arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background-color: var(--nstrc-post-carousel-arrow-background);
            border: none;
            border-radius: 50%;
            padding: 10px;
            cursor: pointer;
            color: var(--nstrc-post-carousel-arrow-color);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            opacity: 0.7;
            transition: opacity 0.3s ease;
          }

          .glide__arrow:hover {
            opacity: 1;
          }

          .glide__arrow--left {
            left: 10px;
          }

          .glide__arrow--right {
            right: 10px;
          }

          .glide__slide img {
            display: block;
            width: 100%;
            height: auto;
            max-height: 500px; /* Adjust as needed */
            object-fit: contain;
            border-radius: var(--nstrc-post-image-border-radius);
          }
      </style>
    `;
}

export function getProfileBadgeStyles(theme: Theme) {
    let variables = ``;

    if(theme === 'dark') {
      variables = `
      --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-dark, #121212);
      --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-dark, #CCC);
      --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-dark, #757575);
      --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-dark, 200, 20%, 20%);
      --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-dark, 200, 20%, 30%);
      --nstrc-profile-badge-copy-foreground-color: var(--nstrc-profile-badge-copy-foreground-color-dark, #CCC);
      `;
    } else {
      variables = `
      --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-light, #f5f5f5);
      --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-light, #444);
      --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-light, #808080);
      --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-light, 200, 20%, 80%);
      --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-light, 200, 20%, 95%);
      --nstrc-profile-badge-copy-foreground-color: var(--nstrc-profile-badge-copy-foreground-color-light, #222);
      `;
    }

    return `
    <style>
      :host {
        --nstrc-profile-badge-name-font-weight: 700;
        --nstrc-profile-badge-nip05-font-weight: 400;

        /* Override follow button styles for badge context */
        --nstrc-follow-btn-padding: 4px 10px !important;
        --nstrc-follow-btn-font-size: 10px !important;
        --nstrc-follow-btn-border-radius: 8px !important;
        --nstrc-follow-btn-error-font-size: 8px !important;
        --nstrc-follow-btn-error-line-height: 1em !important;
        --nstrc-follow-btn-horizontal-alignment: start !important;
        --nstrc-follow-btn-min-height: auto !important;

        ${variables}
      }

    .nostr-profile-badge-container {
      display: flex;
      align-items: center;
      border-radius: 100px;
      background-color: var(--nstrc-profile-badge-background);
      gap: 10px;
      font-size: 12px;
      min-height: 48px;
      padding: 8px 10px;
      font-family: Nacelle,sans-serif;
      cursor: pointer;
    }

    .nostr-profile-badge-container:has(.npub-container) {
      padding: 10px 12px;
    }

    .nostr-profile-badge-left-container {
      border-radius: 50%;
    }

    .nostr-profile-badge-left-container img {
      width: 35px;
      height: 35px;
      border-radius: 50%;
    }

    .nostr-profile-badge-container:has(.npub-container) .nostr-profile-badge-left-container img {
      width: 64px !important;
      height: 64px !important;
    }

    .nostr-profile-badge-right-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }

    .nostr-profile-badge-right-container .nostr-profile-badge-name {
      color: var(--nstrc-profile-badge-name-color);
      font-weight: var(--nstrc-profile-badge-name-font-weight);
    }

    .nostr-profile-badge-right-container .nostr-profile-badge-nip05 {
      color: var(--nstrc-profile-badge-nip05-color);
      font-weight: var(--nstrc-profile-badge-nip05-font-weight);
    }

    .skeleton {
      animation: profile-badge-skeleton-loading 0.5s linear infinite alternate;
    }

    @keyframes profile-badge-skeleton-loading {
      0% {
        background-color: hsl(var(--nstrc-profile-badge-skeleton-min-hsl));
      }
      100% {
        background-color: hsl(var(--nstrc-profile-badge-skeleton-max-hsl));
      }
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
      color: var(--nstrc-profile-badge-copy-foreground-color);
    }

    .npub-container, .nip05-container {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .npub-container .npub {
      color: #a2a2a2;
    }
    
    .npub-container .nostr-profile-badge-nip05 {
      word-break: break-all;
    }

    .name-container {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 3px 0; /* To equalize flex height with other items */
    }
    </style>
    `;
}

export function getProfileStyles(theme: Theme) {
  let variables = ``;

  if(theme === 'dark') {
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
      cursor: pointer;
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
      margin-top: 6px;
    }

    .npub-container .npub {
      color: #a2a2a2;
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
