import { Theme } from '../common/types';
import { maskNPub } from '../common/utils';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface UserProfile {
  displayName?: string;
  name?: string;
  image?: string;
  nip05?: string;
}

interface NDKUser {
  npub?: string;
  pubkey?: string;
  profile?: {
    nip05?: string;
  };
}

export function renderNpub(
  ndkUser: NDKUser | null,
  npubAttribute: string | null,
  showNpub: string | null
): string {
  if (showNpub === 'false') {
    return '';
  }

  if (showNpub === null && ndkUser?.profile?.nip05) {
    return '';
  }

  const npub = npubAttribute || ndkUser?.npub;
  if (!npub) {
    console.warn('Cannot use showNpub without providing a nPub');
    return '';
  }

  return `
    <div class="npub-container">
      <span class="npub">${maskNPub(npub)}</span>
      <span id="npub-copy" class="copy-button">&#x2398;</span>
    </div>
  `;
}

export function renderProfileBadge(
  isLoading: boolean,
  isError: boolean,
  userProfile: UserProfile | null,
  ndkUser: NDKUser | null,
  npubAttribute: string | null,
  showNpub: string | null,
  showFollow: string | null
): string {
  let contentHTML = '';

  if (isLoading) {
    contentHTML = `
      <div class='nostr-profile-badge-container'>
        <div class='nostr-profile-badge-left-container'>
          <div class="skeleton img-skeleton"></div>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <div class="skeleton text-skeleton-name"></div>
          <div class="skeleton text-skeleton-nip05"></div>
        </div>
      </div>
    `;
  } else if (isError) {
    contentHTML = `
      <div class='nostr-profile-badge-container'>
        <div class='nostr-profile-badge-left-container'>
          <div class="error">&#9888;</div>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <span class="error-text">Unable to load</span>
        </div>
      </div>
    `;
  } else if (userProfile) {
    const profileName =
      userProfile.displayName ||
      userProfile.name ||
      maskNPub(ndkUser?.npub || '');
    const profileImage = userProfile.image || './assets/default_dp.png';

    contentHTML = `
      <div class='nostr-profile-badge-container'>
        <div class='nostr-profile-badge-left-container'>
          <img src='${escapeHtml(profileImage)}' alt='Nostr profile image of ${escapeHtml(profileName)}'/>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <div class='nostr-profile-badge-name' title="${escapeHtml(profileName)}">${escapeHtml(profileName)}</div>
          ${userProfile.nip05 ? `<div class='nostr-profile-badge-nip05' title="${escapeHtml(userProfile.nip05)}">${escapeHtml(userProfile.nip05)}</div>` : ''}
          ${showNpub === 'true' ? renderNpub(ndkUser, npubAttribute ? escapeHtml(npubAttribute) : null, showNpub) : ''}
          ${showFollow === 'true' && ndkUser?.pubkey ? `<nostr-follow-button pubkey="${escapeHtml(ndkUser.pubkey)}"></nostr-follow-button>` : ''}
        </div>
      </div>
    `;
  } else {
    contentHTML = `<div class="error-text">Error: Profile data unavailable.</div>`;
  }

  return contentHTML;
}

export function getProfileBadgeStyles(theme: Theme): string {
  return `
    <style>
      :host {
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

      :host(.dark) {
        --nstrc-profile-badge-background: var(--nstrc-profile-badge-background-dark);
        --nstrc-profile-badge-name-color: var(--nstrc-profile-badge-name-color-dark);
        --nstrc-profile-badge-nip05-color: var(--nstrc-profile-badge-nip05-color-dark);
        --nstrc-profile-badge-text-color: var(--nstrc-profile-badge-text-color-dark);
        --nstrc-profile-badge-skeleton-min-hsl: var(--nstrc-profile-badge-skeleton-min-hsl-dark);
        --nstrc-profile-badge-skeleton-max-hsl: var(--nstrc-profile-badge-skeleton-max-hsl-dark);
        --nstrc-profile-badge-border: var(--nstrc-profile-badge-border-dark);
        --nstrc-profile-badge-hover-background: var(--nstrc-profile-badge-hover-background-dark);
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
        color: var(--nstrc-profile-badge-name-color, #000);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nostr-profile-badge-nip05 {
        font-size: 14px;
        color: var(--nstrc-profile-badge-nip05-color, #666);
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
        color: var(--nstrc-profile-badge-text-color, #666);
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
        width: 80px;
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

export function getProfileBadgeStylesLegacy(theme: Theme): string {
  return `
    <style>
      :root {
        /* Light theme (default) */
        --nstrc-profile-badge-background-light: #ffffff;
        --nstrc-profile-badge-name-color-light: #000000;
        --nstrc-profile-badge-nip05-color-light: #666666;
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
        --nstrc-profile-badge-skeleton-min-hsl-dark: #2a2a2a;
        --nstrc-profile-badge-skeleton-max-hsl-dark: #333333;
        --nstrc-profile-badge-border-dark: 1px solid #333333;
        --nstrc-profile-badge-hover-background-dark: #2a2a2a;
      }
      
      ${getProfileBadgeStyles(theme)}
    </style>
  `;
}
