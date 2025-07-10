import { Theme } from '../common/types';
import { maskNPub } from '../common/utils';
import { DEFAULT_PROFILE_IMAGE } from '../common/constants';

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
    const profileImage = userProfile.image || DEFAULT_PROFILE_IMAGE;

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
