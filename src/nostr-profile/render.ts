// SPDX-License-Identifier: MIT

import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { IRenderOptions } from '../base/render-options';
import { renderNpub } from '../base/text-row/render-npub';
import { renderNip05 } from '../base/text-row/render-nip05';
import { renderStats } from './render-stats';
import { renderName } from '../base/text-row/render-name';
import { renderTextRow } from '../base/text-row/render-text-row';

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
  showFollow: string | boolean;
  showNpub: boolean;
}

export function renderProfile(options: RenderProfileOptions): string {
  const {
    theme,
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
  const image = userProfile?.image || '';
  const about = userProfile?.about || '';
  const website = userProfile?.website || '';

  const renderFollowButton = () => {
    if (!showFollow) return '';
    return `
      <nostr-follow-button
        npub="${showFollow}"
        theme="${theme}">
      </nostr-follow-button>
    `;
  };

  return `
    <div class="nostrc-container nostr-profile-container">
      <div class="profile-banner">
        ${isLoading
          ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
          : userProfile.banner
            ? `<img src="${userProfile.banner}" width="524px"/>`
            : '<div class="banner-placeholder"></div>'
        }

        <div class="dp-container">
          <div class="avatar" role="img" aria-label="${displayName}">
            ${isLoading
              ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
              : `<img
                  src="${image}"
                  alt="${displayName}"
                  width="142" height="142"
                  loading="lazy" decoding="async"
                />`
            }
          </div>
        </div>
      </div>

      <div class="profile_actions">
        ${isLoading ? '<div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>'
          : renderFollowButton()
        }
      </div>
        
      <div class="profile_data">
        ${isLoading
          ? '<div style="width: 100px; height: 24px;" class="skeleton"></div>'
          : renderName({ name: displayName })
        }
          
        ${isLoading
          ? '<div style="width: 75px; height: 20px;" class="skeleton"></div>'
          : renderNip05(nip05)
        }

        ${showNpub ?
          isLoading
            ? '<div style="width: 75px; height: 20px;" class="skeleton"></div>'
            : renderNpub(npub)
          : null
        }

        <div style="margin-bottom: 12px"> </div>
        
        ${isLoading
          ? `<div style="width: 100%; margin-bottom: 12px; height: 18px" class="skeleton"></div>`
          : renderTextRow({ display: about, value: about })
        }

        <div style="margin-bottom: 12px"> </div>
        
        ${isLoading
          ? '<div style="width: 150px" class="skeleton"></div>'
          : website
            ? `<div class="website">
              <a target="_blank" href="${website}">${website}</a>
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
    <div class='nostrc-container nostr-profile-container'>
      <div class='nostr-profile-top-container'>
        <div class="error-icon">&#9888;</div>
      </div>
      <div class='nostr-profile-bottom-container'>
        ${errorMessage}
      </div>
    </div>
  `;
}