// SPDX-License-Identifier: MIT

import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';
import * as DomUtils from 'domutils';
import { replyIcon, heartIcon } from '../common/icons';
import { IRenderOptions } from '../base/render-options';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { escapeHtml } from '../common/utils';
import { ReplyItem } from './reply-utils';

export interface RenderPostOptions extends IRenderOptions {
  author: NDKUserProfile | null| undefined;
  date: string;
  shouldShowStats: boolean;
  stats: {
    replies: number;
    likes: number;
  } | null;
  statsLoading: boolean;
  htmlToRender: string;
  repliesExpanded: boolean;
  repliesLoaded: boolean;
  repliesLoading: boolean;
  repliesError: string | null;
  replyItems: ReplyItem[];
}

export function renderPost(options: RenderPostOptions): string {
  const {
    isLoading,
    isError,
    errorMessage,
    author,
    date,
    shouldShowStats,
    stats,
    statsLoading,
    htmlToRender,
    repliesExpanded,
    repliesLoaded,
    repliesLoading,
    repliesError,
    replyItems,
  } = options;

  if (isError) {
    return renderError(errorMessage || '');
  }

  return `
    <div class="nostr-post-container">
      ${renderPostHeader(isLoading, author, date)}
      ${renderPostBody(isLoading, htmlToRender)}
      ${renderPostFooter(
        isLoading,
        shouldShowStats,
        stats,
        statsLoading,
        repliesExpanded,
        repliesLoaded,
        replyItems
      )}
      ${renderRepliesSection(
        isLoading,
        repliesExpanded,
        repliesLoaded,
        repliesLoading,
        repliesError,
        replyItems
      )}
    </div>
  `;
}

function renderPostHeader(
  isLoading: boolean,
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

  return `
    <div class="post-body">
      ${htmlToRender}
    </div>
  `;
}

function renderPostFooter(
  isLoading: boolean,
  shouldShowStats: boolean,
  stats: { replies: number; likes: number } | null,
  statsLoading: boolean,
  repliesExpanded: boolean,
  repliesLoaded: boolean,
  replyItems: ReplyItem[]
): string {
  if (isLoading) {
    return `
      <div class="post-footer">
        <div class="stats-container">
          ${shouldShowStats ? `
            <div class="stat">
              <div style="width: 16px; height: 16px; border-radius: 4px;" class="skeleton"></div>
              <div style="width: 20px; height: 16px; border-radius: 4px;" class="skeleton"></div>
            </div>
            <div class="stat">
              <div style="width: 16px; height: 16px; border-radius: 4px;" class="skeleton"></div>
              <div style="width: 20px; height: 16px; border-radius: 4px;" class="skeleton"></div>
            </div>
          ` : ''}
          <button class="stat reply-toggle-btn" type="button" disabled aria-expanded="false">
            <span class="skeleton reply-toggle-skeleton"></span>
          </button>
        </div>
      </div>
    `;
  }

  const replyCount =
    stats?.replies ?? (repliesLoaded ? replyItems.length : undefined);
  const replyCountLabel =
    !repliesExpanded && replyCount && replyCount > 0
      ? ` (${replyCount})`
      : '';

  return `
    <div class="post-footer">
      <div class="stats-container">
        ${shouldShowStats ? `
          <div class="stat">
            ${statsLoading ? '<span class="skeleton reply-count-skeleton"></span>' : `${replyIcon}<span>${stats?.replies ?? 0}</span>`}
          </div>
          <div class="stat">
            ${statsLoading ? '<span class="skeleton like-count-skeleton"></span>' : `${heartIcon}<span>${stats?.likes ?? 0}</span>`}
          </div>
        ` : ''}
        <button
          class="stat reply-toggle-btn"
          type="button"
          aria-expanded="${repliesExpanded}"
        >
          <span class="reply-toggle-label">
            ${repliesExpanded ? 'Hide Replies' : `Show Replies${replyCountLabel}`}
          </span>
        </button>
      </div>
    </div>
  `;
}

function renderRepliesSection(
  isLoading: boolean,
  repliesExpanded: boolean,
  repliesLoaded: boolean,
  repliesLoading: boolean,
  repliesError: string | null,
  replyItems: ReplyItem[]
): string {
  if (isLoading || !repliesExpanded) {
    return '';
  }

  if (repliesLoading) {
    return `
      <div class="post-replies post-replies-loading" aria-live="polite">
        <div class="post-replies-state-label">Loading replies</div>
        ${renderReplySkeleton()}
        ${renderReplySkeleton()}
      </div>
    `;
  }

  if (repliesError) {
    return `
      <div class="post-replies post-replies-error" aria-live="polite">
        <div class="post-replies-state-label">Unable to load replies right now.</div>
      </div>
    `;
  }

  if (repliesLoaded && replyItems.length === 0) {
    return `
      <div class="post-replies post-replies-empty" aria-live="polite">
        <div class="post-replies-state-label">No replies yet.</div>
      </div>
    `;
  }

  return `
    <div class="post-replies" aria-live="polite">
      ${replyItems.map(renderReplyItem).join('')}
    </div>
  `;
}

function renderReplyItem(reply: ReplyItem): string {
  return `
    <div class="post-reply" data-reply-id="${escapeHtml(reply.id)}">
      <div class="post-reply-avatar">
        ${reply.authorImage ? `<img src="${escapeHtml(reply.authorImage)}" alt="${escapeHtml(reply.authorName)}" loading="lazy" />` : ''}
      </div>
      <div class="post-reply-main">
        <div class="post-reply-author">${escapeHtml(reply.authorName)}</div>
        <div class="post-reply-content">${reply.contentHtml}</div>
      </div>
    </div>
  `;
}

function renderReplySkeleton(): string {
  return `
    <div class="post-reply post-reply-skeleton">
      <div class="post-reply-avatar">
        <div class="skeleton reply-avatar-skeleton"></div>
      </div>
      <div class="post-reply-main">
        <div class="skeleton reply-author-skeleton"></div>
        <div class="skeleton reply-line-skeleton"></div>
        <div class="skeleton reply-line-skeleton short"></div>
      </div>
    </div>
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

function renderError(errorMessage: string): string {
  return `
    <div class="nostr-post-container">
      <div class="post-header">
        <div class="error-icon">⚠</div>
      </div>
      <div class="post-body">
        ${escapeHtml(errorMessage)}
      </div>
    </div>
  `;
}
