// SPDX-License-Identifier: MIT

import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { IRenderOptions } from '../base/render-options';
import { renderNpub } from '../base/render-npub';
import { renderNip05 } from '../base/render-nip05';
import { renderStats } from './render-stats';

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
    stats,
    showFollow,
    showNpub,
  } = options;

  if (isError) {
    return renderError(errorMessage);
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
    <div class="nostr-profile-container">
        <div id="profile_banner">
          ${
            isLoading
              ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
              : userProfile.banner
                ? `<div class="profile_image">
                  <img src="${userProfile.banner}" width="524px"/>
                </div>`
                : '<div class="banner-placeholder"></div>'
          }
        </div>

        <div class="dp_container">
          <div class="avatar" role="img" aria-label="${displayName}">
            ${
              isLoading
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


        <div class="profile_actions">
            ${
              isLoading ? '<div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>'
              : renderFollowButton()
            }
        </div>
        
        <div class="profile_data">
          <div class="basic_info">
            <div class="name">
              ${
                isLoading
                  ? '<div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>'
                  : `<div class="name-text">${displayName}</div>`
              }
            </div>
          </div>
          
          ${
            isLoading
              ? '<div style="width: 75px; height: 12px; border-radius: 20px" class="skeleton"></div>'
              : renderNip05(nip05)
          }
          ${
            isLoading
              ? '<div style="width: 75px; height: 12px; border-radius: 20px" class="skeleton"></div>'
              : renderNpub(npub)
          }
        </div>
        
        <div class="about">
          ${
            isLoading
              ? `<div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
               <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>`
              : about || ''
          }
        </div>
        
        <div class="links">
          ${
            isLoading
              ? '<div style="width: 150px; height: 12px; border-radius: 20px" class="skeleton"></div>'
              : website
                ? `<div class="website">
                  <a target="_blank" href="${website}">${website}</a>
                </div>`
                : ''
          }
        </div>
      
      <div class="stats" data-orientation="horizontal">
        
        ${renderStats('Following', stats.follows, isStatsLoading || isStatsFollowsLoading)}
        
        ${renderStats('Followers', stats.followers, isStatsLoading || isStatsFollowersLoading)}

        ${renderStats('Notes', stats.notes, isStatsLoading)}
        
        ${renderStats('Replies', stats.replies, isStatsLoading)}
        
        ${renderStats('Zaps', stats.zaps, isStatsLoading)}
        
      </div>
    </div>
  `;
}

function renderError(errorMessage: string): string {
  return `
    <div class='nostr-profile-container is-error'>
      <div class='nostr-profile-top-container'>
        <div class="error-icon">&#9888;</div>
      </div>
      <div class='nostr-profile-bottom-container'>
        ${errorMessage}
      </div>
    </div>
  `;
}