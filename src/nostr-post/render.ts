import { Theme } from '../common/types';
import { getPostStylesLegacy } from '../common/theme';
import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';
import * as DomUtils from 'domutils';
import { replyIcon, heartIcon } from '../common/icons';

export interface RenderPostOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  author:
    | {
        image?: string;
        displayName?: string;
        nip05?: string;
      }
    | null
    | undefined;
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
    htmlToRender,
  } = options;

  return `
    ${getPostStylesLegacy(theme)}
    ${getPostStyles(theme)}
    <div class="post-container">
      ${renderPostHeader(isLoading, isError, author, date)}
      ${renderPostBody(isLoading, isError, htmlToRender)}
      ${shouldShowStats ? renderPostFooter(isLoading, isError, stats) : ''}
    </div>
  `;
}

function renderPostHeader(
  isLoading: boolean,
  isError: boolean,
  author:
    | {
        image?: string;
        displayName?: string;
        nip05?: string;
      }
    | null
    | undefined,
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
          ${replyIcon}
          <span>${stats.replies}</span>
        </div>
        <div class="stat">
          ${heartIcon}
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
  authorProfile:
    | {
        displayName?: string;
        image?: string;
        nip05?: string;
      }
    | undefined,
  date: string,
  content: string
): string {
  const authorDisplayName = authorProfile?.displayName || '';

  // Process media items from content
  const mediaItems: { type: 'image' | 'video'; url: string }[] = [];
  let processedContent = content;

  try {
    // Create a handler to collect DOM elements
    const dom: any[] = [];
    const handler = new DomHandler(
      (error, parsedDom) => {
        if (error) {
          throw error;
        }
        dom.push(...parsedDom);
      },
      {
        normalizeWhitespace: false,
        withEndIndices: false,
        withStartIndices: false,
      }
    );

    const parser = new Parser(handler);

    // Parse the HTML content
    parser.write(content);
    parser.end();

    // Find all image and video elements
    const mediaElements = DomUtils.findAll((elem: any) => {
      return (
        elem.type === 'tag' &&
        (elem.name === 'img' || elem.name === 'video') &&
        elem.attribs?.src
      );
    }, dom) as any[];

    // Extract media items and remove them from the DOM
    mediaElements.forEach(elem => {
      if (elem.attribs?.src) {
        const type = elem.name === 'img' ? 'image' : 'video';
        mediaItems.push({ type, url: elem.attribs.src });

        // Remove the element from its parent
        const parent = elem.parent;
        if (parent?.children) {
          parent.children = parent.children.filter(
            (child: any) => child !== elem
          );
        }
      }
    });

    // Reconstruct the HTML without media elements
    processedContent = dom
      .map((node: any) => DomUtils.getOuterHTML(node))
      .join('');
  } catch (error) {
    console.error('Error processing HTML content:', error);
    // Fall back to original content if parsing fails
    processedContent = content;
  }

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
          <span class="embedded-author-name">${authorDisplayName}</span>
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
