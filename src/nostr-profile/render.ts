// SPDX-License-Identifier: MIT

import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { IRenderOptions } from '../base/render-options';
import { renderNpub } from '../base/text-row/render-npub';
import { renderNip05 } from '../base/text-row/render-nip05';
import { renderStats } from './render-stats';
import { renderName } from '../base/text-row/render-name';
import { renderTextRow } from '../base/text-row/render-text-row';
import { escapeHtml, sanitizeUrl } from '../common/utils';

export interface Stats {
  notes: number;
  replies: number;
  follows: number;
  followers: number;
  zaps: number;
  relays: number;
}

export interface RenderProfileOptions extends IRenderOptions {
  npub: string;
  userProfile: NDKUserProfile;
  isStatsLoading: boolean;
  isStatsFollowersLoading: boolean;
  isStatsFollowsLoading: boolean;
  isZapsLoading: boolean;
  stats: Stats;
  showFollow: boolean;
  showNpub: boolean;
}

export function renderProfile(options: RenderProfileOptions): string {
  const {
    isLoading,
    isError,
    errorMessage,
    npub,
    userProfile,
    isStatsLoading,
    isStatsFollowersLoading,
    isStatsFollowsLoading,
    isZapsLoading,
    stats,
    showFollow,
    showNpub,
  } = options;

  if (isError) {
    return renderError(errorMessage || '');
  }

  // Extract profile data with null checks and default values
  const displayName = userProfile?.displayName || userProfile?.name || '';
  const nip05 = userProfile?.nip05 || '';
  const about = userProfile?.about || '';
  const website = userProfile?.website || '';
  const sanitizedBanner = sanitizeUrl(userProfile?.banner || '');
  const sanitizedImage = sanitizeUrl(userProfile?.picture || '');
  const sanitizedWebsite = sanitizeUrl(website);
  const safeDisplayName = escapeHtml(displayName);
  const safeNpub = escapeHtml(npub);

  const renderFollowButton = () => {
    if (!showFollow || npub === '') return '';
    return `
      <nostr-follow-button
        npub="${safeNpub}">
      </nostr-follow-button>
    `;
  };

  return `
    <div class="nostr-profile-container">
      <div class="profile-banner">
        ${
          isLoading
            ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
            : sanitizedBanner
              ? `<img src="${sanitizedBanner}" width="524px" alt="Profile banner" loading="lazy" />`
              : '<div class="banner-placeholder"></div>'
        }

        <div class="dp-container">
          <div class="avatar" role="img" aria-label="${safeDisplayName}">
            ${
              isLoading
                ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
                : sanitizedImage
                  ? `<img
                  src="${sanitizedImage}"
                  alt="${safeDisplayName}"
                  width="142" height="142"
                  loading="lazy" decoding="async"
                />`
                  : '<div class="avatar-placeholder"></div>'
            }
          </div>
        </div>
      </div>

      <div class="profile_actions">
        ${
          showFollow
            ? isLoading
              ? '<div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>'
              : renderFollowButton()
            : ''
        }
      </div>
        
      <div class="profile_data">
        ${
          isLoading
            ? '<div style="width: 100px; height: 24px;" class="skeleton"></div>'
            : renderName({ name: displayName })
        }
          
        ${
          isLoading
            ? '<div style="width: 75px; height: 20px;" class="skeleton"></div>'
            : renderNip05(nip05)
        }

        ${
          showNpub
            ? isLoading
              ? '<div style="width: 75px; height: 20px;" class="skeleton"></div>'
              : renderNpub(npub)
            : ''
        }

        <div class="margin-bottom-md"> </div>
        
        ${
          isLoading
            ? `<div style="width: 100%; margin-bottom: 12px; height: 18px" class="skeleton"></div>`
            : renderTextRow({ display: about, value: about })
        }

        <div class="margin-bottom-md"> </div>
        
        ${
          isLoading
            ? '<div style="width: 150px" class="skeleton"></div>'
            : sanitizedWebsite
              ? `<div class="website">
              <a target="_blank" rel="noopener noreferrer" href="${sanitizedWebsite}">${escapeHtml(website)}</a>
              </div>`
              : ''
        }
      
        <div class="stats">

          ${renderStats('Following', stats.follows, isStatsFollowsLoading)}
          
          ${renderStats('Followers', stats.followers, isStatsFollowersLoading)}

          ${renderStats('Notes', stats.notes, isStatsLoading)}
          
          ${renderStats('Replies', stats.replies, isStatsLoading)}
          
          ${renderStats('Zaps', stats.zaps, isZapsLoading)}
          
        </div>
      </div>
    </div>
  `;
}

function renderError(errorMessage: string): string {
  return `
    <div class='nostr-profile-container'>
      <div class='nostr-profile-top-container'>
        <div class="error-icon">&#9888;</div>
      </div>
      <div class='nostr-profile-bottom-container'>
        ${escapeHtml(errorMessage)}
      </div>
    </div>
  `;
}
