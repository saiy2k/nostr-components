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
  isStatsNotesLoading: boolean;
  isStatsFollowersLoading: boolean;
  isStatsFollowsLoading: boolean;
  stats: Stats;
  error: string | null;
  showFollow: string | boolean;
  showNpub: boolean;
  onNpubClick?: () => void;
  onProfileClick?: () => void;
}

export function renderProfile(options: RenderOptions): string {
  const {
    npub,
    userProfile,
    theme,
    isLoading,
    isStatsLoading,
    isStatsNotesLoading,
    isStatsFollowersLoading,
    isStatsFollowsLoading,
    stats,
    error,
    showFollow,
    showNpub,
    onNpubClick,
    onProfileClick,
  } = options;

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
  const displayName = userProfile?.name || maskedNpub;
  const nip05 = userProfile?.nip05 || '';
  const image = userProfile?.image || '';
  const about = userProfile?.about || '';
  const website = userProfile?.website || '';

  // Data attributes for event delegation
  const npubDataAttr = onNpubClick ? 'data-nostr-action="npub-click"' : '';
  const profileDataAttr = onProfileClick
    ? 'data-nostr-action="profile-click"'
    : '';

  const renderNpub = () => {
    if (!showNpub) return '';
    return `
      <div class="npub" ${npubDataAttr}>
        <span class="npub-text">${maskedNpub}</span>
        <span class="copy-button" data-npub="${npub}">
          ${copyIcon}
        </span>
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
          ${isLoading
      ? '<div style="width: 100%; height: 100%;" class="skeleton"></div>'
      : userProfile.banner
        ? `<a target="_blank" data-cropped="true" class="profile_image" href="#">
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
                  ${isLoading
      ? '<div style="width: 100%; height: 100%; border-radius: 50%" class="skeleton"></div>'
      : `<a target="_blank" data-cropped="true" class="profile_image roundedImage" href="#">
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
              ${isLoading
      ? '<div style="width: 100px; height: 16px; border-radius: 20px" class="skeleton"></div>'
      : `<div class="name-text">${displayName}</div>`
    }
            </div>
          </div>
          
          <div class="nip05-wrapper">
            <div class="nip05-container">
              ${isLoading
      ? '<div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>'
      : nip05
        ? `<div class="nip05">
                      <span>${nip05}</span>
                      <span id="nip05-copy" class="copy-button">&#x2398;</span>
                    </div>`
        : ''
    }
              ${renderNpub()}
            </div>
          </div>
        </div>
        
        <div class="about">
          ${isLoading
      ? `<div style="width: 100%; height: 12px; border-radius: 20px; margin-bottom: 12px" class="skeleton"></div>
               <div style="width: 40%; height: 12px; border-radius: 20px" class="skeleton"></div>`
      : about || ''
    }
        </div>
        
        <div class="links">
          ${isLoading
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
              ${isStatsNotesLoading
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
              ${isStatsNotesLoading
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
              ${isStatsFollowsLoading
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
              ${isStatsFollowersLoading
      ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
      : stats.followers.toLocaleString()
    }
            </div>
            <div class="stat-name">Followers</div>
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
          <div class="nip05-wrapper">
            <div class="nip05-container">
              <div style="width: 75px; height: 8px; border-radius: 20px" class="skeleton"></div>
              <div style="width: 120px; height: 12px; border-radius: 20px; margin-top: 4px;" class="skeleton"></div>
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
    <div class="nostr-profile error-container">
      <div class="error">!</div>
      <span class="error-text">${error}</span>
    </div>
  `;
}
