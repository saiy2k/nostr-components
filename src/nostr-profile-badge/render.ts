import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { escapeHtml, maskNPub } from '../common/utils';
import { DEFAULT_PROFILE_IMAGE } from '../common/constants';
import { IRenderOptions } from '../base/render-options';
import { renderNpub } from '../base/render-npub';
import { renderNip05 } from '../base/render-nip05';

export interface RenderProfileBadgeOptions extends IRenderOptions {
  userProfile: NDKUserProfile | null;
  ndkUser: NDKUser | null;
  npub: string | null;
  showNpub: boolean;
  showFollow: boolean;
}

export function renderProfileBadge({
  theme,
  isLoading,
  isError,
  errorMessage,
  userProfile,
  ndkUser,
  npub,
  showNpub,
  showFollow
}: RenderProfileBadgeOptions): string {

  if (isLoading) {
    return renderLoading();
  }

  if (isError || userProfile == null) {
    return renderError(errorMessage);
  }

  const profileName = escapeHtml(
    userProfile.displayName ||
    userProfile.name ||
    maskNPub(ndkUser?.npub || '')
  );
  const profileImage = escapeHtml(userProfile.picture || DEFAULT_PROFILE_IMAGE);
  const nip05 = escapeHtml(userProfile?.nip05 || '');
  const pubkey = escapeHtml(ndkUser?.pubkey || '');

  return `
      <div class='nostr-profile-badge-container is-clickable'>
        <div class='nostr-profile-badge-left-container'>
          <img src='${profileImage}' alt='Nostr profile image of ${profileName}'/>
        </div>
        <div class='nostr-profile-badge-right-container'>
          <div class='nostr-profile-badge-name' title="${profileName}">${profileName}</div>
          ${userProfile.nip05 ? renderNip05(nip05) : ''}
          ${showNpub === true ? renderNpub(npub || '') : ''}
          ${showFollow === true && ndkUser?.pubkey ? `<nostr-follow-button pubkey="${pubkey}"></nostr-follow-button>` : ''}
        </div>
      </div>
    `;
}

function renderLoading(): string {
  return `
      <div class='nostr-profile-badge-container is-disabled'>
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

function renderError(errorMessage: string): string {
  return `
      <div class='nostr-profile-badge-container is-error'>
        <div class='nostr-profile-badge-left-container'>
          <div class="error-icon">&#9888;</div>
        </div>
        <div class='nostr-profile-badge-right-container'>
          ${errorMessage}
        </div>
      </div>
    `;
}