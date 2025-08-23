import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { escapeHtml, maskNPub } from '../common/utils';
import { DEFAULT_PROFILE_IMAGE } from '../common/constants';

/**
 * Should this become a component on it's own?
 */
export function renderNpub(
  ndkUser: NDKUser | null,
  npubAttribute: string | null,
): string {
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
  userProfile: NDKUserProfile | null,
  ndkUser: NDKUser | null,
  npubAttribute: string | null,
  showNpub: boolean,
  showFollow: boolean
): string {

  if (isLoading) {
    return renderLoading();
  }

  if (isError || userProfile == null) {
    return renderError();
  }

  const profileName = escapeHtml(
    userProfile.displayName ||
    userProfile.name ||
    maskNPub(ndkUser?.npub || '')
  );
  const profileImage = escapeHtml(userProfile.picture || DEFAULT_PROFILE_IMAGE);
  const nip05 = escapeHtml(userProfile?.nip05 || '');
  const pubkey = escapeHtml(ndkUser?.pubkey || '');
  const shouldShowNpub = showNpub && !userProfile?.nip05;

  return `
      <div class='nostr-profile-badge-container'>
        <div class='nostr-profile-badge-left-container'>
          <img src='${profileImage}' alt='Nostr profile image of ${profileName}'/>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <div class='nostr-profile-badge-name' title="${profileName}">${profileName}</div>
          ${userProfile.nip05 ? `<div class='nostr-profile-badge-nip05' title="${nip05}">${nip05}</div>` : ''}
          ${shouldShowNpub === true ? renderNpub(ndkUser, npubAttribute) : ''}
          ${showFollow === true && ndkUser?.pubkey ? `<nostr-follow-button pubkey="${pubkey}"></nostr-follow-button>` : ''}
        </div>
      </div>
    `;
}

function renderLoading(): string {
  return `
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
}

function renderError(): string {
  return `
      <div class='nostr-profile-badge-container'>
        <div class='nostr-profile-badge-left-container'>
          <div class="error">&#9888;</div>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <span class="error-text">Unable to load. Check console logs</span>
        </div>
      </div>
    `;
}