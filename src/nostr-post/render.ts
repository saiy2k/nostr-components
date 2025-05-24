import { Theme } from "../common/types";
import { getPostStylesLegacy } from "../common/theme";

export interface RenderPostOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  author: {
    image?: string;
    displayName?: string;
    nip05?: string;
  } | null | undefined;
  date: string;
  shouldShowStats: boolean;
  stats: {
    replies: number;
    likes: number;
  } | null;
  htmlToRender: string;
}

export function renderPost(options: RenderPostOptions): string {
  const {
    theme,
    isLoading,
    isError,
    author,
    date,
    shouldShowStats,
    stats,
    htmlToRender
  } = options;

  return `
    ${getPostStylesLegacy(theme)}
    ${getPostStyles(theme)}
    <div class="post-container">
      ${renderPostHeader(theme, isLoading, isError, author, date)}
      ${renderPostBody(theme, isLoading, isError, htmlToRender)}
      ${shouldShowStats ? renderPostFooter(theme, isLoading, isError, stats) : ''}
    </div>
  `;
}

function renderPostHeader(
  theme: Theme,
  isLoading: boolean,
  isError: boolean,
  author: {
    image?: string;
    displayName?: string;
    nip05?: string;
  } | null | undefined,
  date: string
): string {
  if (isLoading) {
    return `
      <div class="post-header">
        <div class="post-header-left">
          <div class="author-picture">
            <div style="width: 35px; height: 35px; border-radius: 50%;" class="skeleton"></div>
          </div>
        </div>
        <div class="post-header-middle">
          <div style="width: 70%; height: 10px; border-radius: 10px;" class="skeleton"></div>
          <div style="width: 80%; height: 8px; border-radius: 10px; margin-top: 5px;" class="skeleton"></div>
        </div>
        <div class="post-header-right">
          <div style="width: 100px; height: 10px; border-radius: 10px;" class="skeleton"></div>
        </div>
      </div>
    `;
  }

  if (isError) {
    return '';
  }

  return `
    <div class="post-header">
      <div class="post-header-left">
        <div class="author-picture">
          ${author?.image ? `<img src="${author.image}" alt="Author" />` : ''}
        </div>
      </div>
      <div class="post-header-middle">
        ${author?.displayName ? `<span class="author-name">${author.displayName}</span>` : ''}
        ${author?.nip05 ? `<span class="author-username">${author.nip05}</span>` : ''}
      </div>
      <div class="post-header-right">
        <span class="post-date">${date}</span>
      </div>
    </div>
  `;
}

function renderPostBody(
  theme: Theme,
  isLoading: boolean,
  isError: boolean,
  htmlToRender: string
): string {
  if (isLoading) {
    return `
      <div class="post-body">
        <div style="width: 100%; height: 10px; border-radius: 10px; margin-bottom: 15px;" class="skeleton"></div>
        <div style="width: 100%; height: 10px; border-radius: 10px; margin-bottom: 15px;" class="skeleton"></div>
        <div style="width: 30%; height: 10px; border-radius: 10px;" class="skeleton"></div>
      </div>
    `;
  }

  if (isError) {
    return `
      <div class="post-body">
        <div class='error-container'>
          <div class="error">&#9888;</div>
          <span class="error-text">Unable to load post</span>
        </div>
        <div style="text-align: center; margin-top: 8px">
          <small class="error-text" style="font-weight: normal">Please check console for more information</small>
        </div>
      </div>
    `;
  }

  return `
    <div class="post-body">
      ${htmlToRender}
    </div>
  `;
}

function renderPostFooter(
  theme: Theme,
  isLoading: boolean,
  isError: boolean,
  stats: { replies: number; likes: number } | null
): string {
  if (isLoading) {
    return `
      <div class="post-footer">
        <div class='stats-container'>
          <div class="stat">
            <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
          </div>
          <div class="stat">
            <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
          </div>
          <div class="stat">
            <div style="width: 42px; height: 20px; border-radius: 4px;" class="skeleton"></div>
          </div>
        </div>
      </div>
    `;
  }

  if (isError || !stats) {
    return '';
  }

  return `
    <div class="post-footer">
      <div class='stats-container'>
        <div class="stat">
          <svg width="18" height="18" fill="#00b3ff">
            <path xmlns="http://www.w3.org/2000/svg" d="M12.2197 1.65717C7.73973 1.25408 5.14439 0.940234 3.12891 2.6623C0.948817 4.52502 0.63207 7.66213 2.35603 9.88052C3.01043 10.7226 4.28767 11.9877 5.51513 13.1462C6.75696 14.3184 7.99593 15.426 8.60692 15.9671C8.61074 15.9705 8.61463 15.9739 8.61859 15.9774C8.67603 16.0283 8.74753 16.0917 8.81608 16.1433C8.89816 16.2052 9.01599 16.2819 9.17334 16.3288C9.38253 16.3912 9.60738 16.3912 9.81656 16.3288C9.97391 16.2819 10.0917 16.2052 10.1738 16.1433C10.2424 16.0917 10.3139 16.0283 10.3713 15.9774C10.3753 15.9739 10.3792 15.9705 10.383 15.9671C10.994 15.426 12.2329 14.3184 13.4748 13.1462C14.7022 11.9877 15.9795 10.7226 16.6339 9.88052C18.3512 7.67065 18.0834 4.50935 15.8532 2.65572C13.8153 0.961905 11.2476 1.25349 9.49466 2.78774Z"/>
          </svg>
          <span>${stats.replies}</span>
        </div>
        <div class="stat">
          <svg width="18" height="18">
            <g xmlns="http://www.w3.org/2000/svg">
              <path fill="#ff006d" d="M12.2197 1.65717C7.73973 1.25408 5.14439 0.940234 3.12891 2.6623C0.948817 4.52502 0.63207 7.66213 2.35603 9.88052C3.01043 10.7226 4.28767 11.9877 5.51513 13.1462C6.75696 14.3184 7.99593 15.426 8.60692 15.9671C8.61074 15.9705 8.61463 15.9739 8.61859 15.9774C8.67603 16.0283 8.74753 16.0917 8.81608 16.1433C8.89816 16.2052 9.01599 16.2819 9.17334 16.3288C9.38253 16.3912 9.60738 16.3912 9.81656 16.3288C9.97391 16.2819 10.0917 16.2052 10.1738 16.1433C10.2424 16.0917 10.3139 16.0283 10.3713 15.9774C10.3753 15.9739 10.3792 15.9705 10.383 15.9671C10.994 15.426 12.2329 14.3184 13.4748 13.1462C14.7022 11.9877 15.9795 10.7226 16.6339 9.88052C18.3512 7.67065 18.0834 4.50935 15.8532 2.65572C13.8153 0.961905 11.2476 1.25349 9.49466 2.78774Z"/>
            </g>
          </svg>
          <span>${stats.likes}</span>
        </div>
      </div>
    </div>
  `;
}

function getPostStyles(theme: Theme): string {
  return `
    <style>
      .nostr-mention {
        color: #1DA1F2;
        font-weight: 500;
        cursor: pointer;
      }
      
      /* Embedded post styles */
      .embedded-post {
        margin: 10px 0;
        padding: 12px;
        border: 1px solid ${theme === 'light' ? '#e1e8ed' : '#38444d'};
        border-radius: 12px;
        background: ${theme === 'light' ? '#f8f9fa' : '#192734'};
      }
      
      .embedded-post-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .embedded-author-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 8px;
      }
      
      .embedded-author-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .embedded-author-info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      
      .embedded-author-name {
        font-weight: bold;
        font-size: 14px;
        color: ${theme === 'light' ? '#14171a' : '#ffffff'};
      }
      
      .embedded-author-username {
        font-size: 12px;
        color: ${theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-date {
        font-size: 12px;
        color: ${theme === 'light' ? '#657786' : '#8899a6'};
      }
      
      .embedded-post-content {
        font-size: 14px;
        color: ${theme === 'light' ? '#14171a' : '#ffffff'};
        line-height: 1.4;
        white-space: pre-line;
      }
      
      .embedded-post-media {
        margin-top: 10px;
      }
      
      .embedded-media-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .embedded-media-item {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .embedded-media-item img,
      .embedded-media-item video {
        width: 100%;
        max-height: 300px;
        object-fit: contain;
        display: block;
      }
      
      .embedded-post-error {
        padding: 10px;
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        font-size: 14px;
      }
    </style>
  `;
}

export function renderEmbeddedPost(
  noteId: string,
  theme: Theme,
  authorProfile: {
    displayName?: string;
    image?: string;
    nip05?: string;
  } | undefined,
  date: string,
  content: string
): string {
  // Process media items from content
  const mediaItems: { type: 'image' | 'video'; url: string }[] = [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  // Extract images and videos
  tempDiv.querySelectorAll('img').forEach(img => {
    mediaItems.push({ type: 'image', url: img.src });
  });
  
  tempDiv.querySelectorAll('video').forEach(video => {
    const src = video.getAttribute('src');
    if (src) {
      mediaItems.push({ type: 'video', url: src });
    }
  });

  // Remove media from content to prevent duplication
  tempDiv.querySelectorAll('img, video').forEach(el => el.remove());
  const processedContent = tempDiv.innerHTML;

  // Generate media HTML if there are media items
  let mediaHtml = '';
  if (mediaItems.length > 0) {
    mediaHtml = '<div class="embedded-media-list">';
    for (const item of mediaItems) {
      if (item.type === 'image') {
        mediaHtml += `<div class="embedded-media-item"><img src="${item.url}" alt="Embedded image" loading="lazy" /></div>`;
      } else if (item.type === 'video') {
        mediaHtml += `<div class="embedded-media-item"><video src="${item.url}" controls preload="none"></video></div>`;
      }
    }
    mediaHtml += '</div>';
  }

  return `
    <div class="embedded-post" data-note-id="${noteId}">
      <div class="embedded-post-header">
        <div class="embedded-author-avatar" style="cursor: pointer;">
          ${authorProfile?.image ? `<img src="${authorProfile.image}" alt="Profile">` : ''}
        </div>
        <div class="embedded-author-info" style="cursor: pointer;">
          <span class="embedded-author-name">${authorProfile?.displayName || 'Unknown'}</span>
          ${authorProfile?.nip05 ? `<span class="embedded-author-username">${authorProfile.nip05}</span>` : ''}
        </div>
        <div class="embedded-post-date">${date}</div>
      </div>
      <div class="embedded-post-content">
        ${processedContent}
        ${mediaHtml ? `<div class="embedded-post-media">${mediaHtml}</div>` : ''}
      </div>
    </div>
  `;
}
