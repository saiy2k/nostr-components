import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { Theme } from '../common/types';
import { maskNPub } from '../common/utils';
import { getProfileStyles } from '../common/theme';
import { copyIcon } from '../common/icons';

export interface Stats {
  notes: number;
  replies: number;
  follows: number;
  followers: number;
  zaps: number;
  relays: number;
}

export interface RenderOptions {
  npub: string;
  userProfile: NDKUserProfile;
  theme: Theme;
  isLoading: boolean;
  isStatsLoading: boolean;
  isStatsFollowersLoading: boolean;
  isStatsFollowsLoading: boolean;
  stats: Stats;
  error: string | null;
  showFollow: string | boolean;
  showNpub: boolean;
}

export function renderProfile(options: RenderOptions): string {
  const {
    npub,
    userProfile,
    theme,
    isLoading,
    isStatsLoading,
    isStatsFollowersLoading,
    isStatsFollowsLoading,
    stats,
    error,
    showFollow,
    showNpub,
  } = options;

  // Extract profile data with null checks and default values
  const displayName = userProfile?.displayName || userProfile?.name || '';
  const nip05 = userProfile?.nip05 || '';
  const image = userProfile?.image || '';
  const about = userProfile?.about || '';
  const website = userProfile?.website || '';


  if (error) {
    return `
      <div class="error-container">
        <div class="error">!</div>
        <div class="error-text">${error}</div>
      </div>
    `;
  }

  const styles = getProfileStyles(theme);
  const maskedNpub = maskNPub(npub);

  const renderNpub = () => {
    // Convert showNpub to boolean if it's a string
    const shouldShowNpub = showNpub === true || String(showNpub).toLowerCase() === 'true';
    if (!shouldShowNpub) return '';
    
    return `
      <div class="npub-container">
        <div class="npub">
          <span class="npub-text">${maskedNpub}</span>
          <span class="copy-button" data-npub="${npub}">
            ${copyIcon}
          </span>
        </div>
      </div>
    `;
  };

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
    ${styles}
    <div class="nostr-profile">
      <div id="profile">
        <div id="profile_banner">
          ${
            isLoading
              ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
              : userProfile.banner
                ? `<a target="_blank" data-cropped="true" class="profile_image">
                  <img src="${userProfile.banner}" width="524px"/>
                </a>`
                : '<div class="banner-placeholder"></div>'
          }
        </div>
        <div class="dp_container">
          <div class="avatar_container">
            <div class="avatar_wrapper">
              <div class="xxl_avatar">
                <div class="backfill">
                  ${
                    isLoading
                      ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
                      : `<a target="_blank" data-cropped="true" class="profile_image roundedImage">
                        <img src="${image}" width="524px" alt="${displayName}" />
                      </a>`
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="profile_actions">
          ${renderFollowButton()}
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
          
          <div class="profile-ids">
            <div class="nip05-container">
              ${
                isLoading
                  ? '<div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>'
                  : nip05
                    ? `<div class="nip05">
                        <span>${nip05}</span>
                        <span id="nip05-copy" class="copy-button">&#x2398;</span>
                      </div>`
                    : ''
              }
            </div>
            ${renderNpub()}
          </div>
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
      </div>
      
      <div class="stats" data-orientation="horizontal">
        <button class="stat" data-orientation="horizontal">
          <div class="stat-inner">
            <div class="stat-value">
              ${
                isStatsLoading || isStatsFollowsLoading
                  ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                  : stats.follows.toLocaleString()
              }
            </div>
            <div class="stat-name">Following</div>
          </div>
        </button>
        
        <button class="stat" data-orientation="horizontal">
          <div class="stat-inner">
            <div class="stat-value">
              ${
                isStatsLoading || isStatsFollowersLoading
                  ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                  : stats.followers.toLocaleString()
              }
            </div>
            <div class="stat-name">Followers</div>
          </div>
        </button>
        
        <button class="stat" data-orientation="horizontal">
          <div class="stat-inner">
            <div class="stat-value">
              ${
                isStatsLoading
                  ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                  : stats.notes.toLocaleString()
              }
            </div>
            <div class="stat-name">Notes</div>
          </div>
        </button>
        
        <button class="stat" data-orientation="horizontal">
          <div class="stat-inner">
            <div class="stat-value">
              ${
                isStatsLoading
                  ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                  : stats.replies.toLocaleString()
              }
            </div>
            <div class="stat-name">Replies</div>
          </div>
        </button>
        
        <button class="stat" data-orientation="horizontal">
          <div class="stat-inner">
            <div class="stat-value">
              ${
                isStatsLoading
                  ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
                  : stats.zaps.toLocaleString()
              }
            </div>
            <div class="stat-name">Zaps</div>
          </div>
        </button>
      </div>
    </div>
  `;
}

export function renderLoadingState(theme: Theme): string {
  const styles = getProfileStyles(theme);
  return `
    ${styles}
    <div class="nostr-profile">
      <div id="profile">
        <div id="profile_banner">
          <div style="width: 100%; height: 100%;" class="skeleton"></div>
        </div>
        <div class="dp_container">
          <div class="avatar_container">
            <div class="avatar_wrapper">
              <div class="xxl_avatar">
                <div class="backfill">
                  <div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="profile_actions">
          <div style="width: 100px; height: 36px; border-radius: 18px;" class="skeleton"></div>
        </div>
        <div class="profile_data">
          <div class="basic_info">
            <div class="name">
              <div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>
            </div>
          </div>
          <div class="nip05-wrapper" style="display: flex; align-items: flex-start; margin-top: 4px; color: var(--nstr-text-secondary); font-size: 14px; flex-direction: column;">
            <div class="nip05-container">
              <div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>
              <div class="npub-container" style="width: 100%; margin-top: 8px;">
                <div class="npub" style="display: flex; align-items: center; gap: 6px; color: var(--nstr-text-secondary); font-family: monospace; font-size: 13px; word-break: break-all;">
                  <div style="width: 120px; height: 12px; border-radius: 20px; margin-top: 4px;" class="skeleton"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="about">
          <div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
          <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>
        </div>
        <div class="links">
          <div style="width: 150px; height: 12px; border-radius: 20px" class="skeleton"></div>
        </div>
      </div>
      <div class="stats" data-orientation="horizontal">
        ${Array(4)
          .fill(0)
          .map(
            () => `
          <button class="stat" data-orientation="horizontal">
            <div class="stat-inner">
              <div class="stat-value">
                <div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>
              </div>
              <div class="stat-name">
                <div style="width: 50px; height: 12px; border-radius: 10px; margin: 4px auto 0;" class="skeleton"></div>
              </div>
            </div>
          </button>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

export function renderErrorState(error: string, theme: Theme): string {
  const styles = getProfileStyles(theme);
  return `
    ${styles}
    <div class="error-container">
      <div class="error">!</div>
      <span class="error-text">${error}</span>
    </div>
  `;
}
