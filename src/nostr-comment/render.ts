import { Theme } from '../common/types';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';

interface Comment {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  replies: Comment[];
  userProfile?: NDKUserProfile;
  replyTo?: string;
  depth?: number;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString();
}

function getUserDisplayName(comment: Comment): string {
  if (comment.userProfile?.displayName) {
    return comment.userProfile.displayName;
  }
  if (comment.userProfile?.name) {
    return comment.userProfile.name;
  }
  // Fallback to masked pubkey
  return `${comment.pubkey.slice(0, 8)}...${comment.pubkey.slice(-4)}`;
}

function getUserAvatar(comment: Comment): string {
  if (comment.userProfile?.image && comment.userProfile.image.trim() !== '') {
    // Handle IPFS links and ensure proper URL format
    let imageUrl = comment.userProfile.image.trim();

    // Convert IPFS hash to gateway URL if needed
    if (imageUrl.startsWith('Qm') || imageUrl.startsWith('bafy')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl}`;
    }

    // Ensure protocol is included
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    return imageUrl;
  }
  return './assets/default_dp.png';
}

function renderComment(comment: Comment, readonly: boolean = false, replyingToComment: string | null = null, currentUserProfile: any = null, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
  const displayName = getUserDisplayName(comment);
  const avatar = getUserAvatar(comment);
  const timeAgo = formatTimeAgo(comment.created_at);
  const depth = comment.depth || 0;
  const maxDepth = 6; // Maximum nesting depth
  const isReplying = replyingToComment === comment.id;

  return `
    <div class="comment reddit-comment" data-comment-id="${escapeHtml(comment.id)}" data-depth="${depth}" style="--depth: ${depth};">
      ${depth > 0 ? `<div class="comment-thread-line" style="left: ${depth * 60 + 10}px;"></div>` : ''}
      <div class="comment-container">
        <div class="comment-sidebar">
          <img src="${escapeHtml(avatar)}" alt="Avatar" class="comment-avatar" />
          ${depth < maxDepth && comment.replies.length > 0 ? '<div class="comment-collapse-line"></div>' : ''}
        </div>
        <div class="comment-main">
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(displayName)}</span>
            <span class="comment-time">• ${escapeHtml(timeAgo)}</span>
          </div>
          <div class="comment-content">
            ${escapeHtml(comment.content)}
          </div>
          <div class="comment-actions">
            ${!readonly ? `<button class="reply-button" data-comment-id="${escapeHtml(comment.id)}">↩ Reply</button>` : ''}
          </div>
          ${isReplying ? renderInlineReplyForm(comment, currentUserProfile, identityMode, hasNip07) : ''}
        </div>
      </div>
      ${comment.replies.length > 0 ? `
        <div class="comment-replies">
          ${comment.replies.map(reply => renderComment(reply, readonly, replyingToComment, currentUserProfile, identityMode, hasNip07)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderInlineReplyForm(parentComment: Comment, currentUserProfile: any, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
  // Use the same avatar processing as getUserAvatar
  let userAvatar = './assets/default_dp.png';
  if (currentUserProfile?.image && currentUserProfile.image.trim() !== '') {
    let imageUrl = currentUserProfile.image.trim();

    // Convert IPFS hash to gateway URL if needed
    if (imageUrl.startsWith('Qm') || imageUrl.startsWith('bafy')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl}`;
    }

    // Ensure protocol is included
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    userAvatar = imageUrl;
  }

  const parentName = getUserDisplayName(parentComment);
  const userName = currentUserProfile?.displayName || currentUserProfile?.name || 'Anonymous';

  return `
    <div class="inline-reply-form">
      <div class="reply-context">
        <span class="reply-context-text">💬 Replying to <strong>${escapeHtml(parentName)}</strong></span>
        <button data-role="cancel-reply" class="cancel-reply-btn">✕</button>
      </div>
      <div class="reply-form-container">
        <div class="reply-form-sidebar">
          <img src="${escapeHtml(userAvatar)}" alt="Your avatar" class="reply-user-avatar" />
        </div>
        <div class="reply-form-main">
          <div class="reply-form-header">
            <span class="current-user-name">Commenting as ${escapeHtml(userName)}</span>
            <div class="identity-toggle">
              <label class="toggle-label">Identity:</label>
              <button data-role="toggle-as-user" class="identity-btn ${identityMode === 'user' ? 'active' : ''}" ${!hasNip07 ? 'disabled' : ''}>User</button>
              <button data-role="toggle-as-anon" class="identity-btn ${identityMode === 'anon' ? 'active' : ''}">Anonymous</button>
            </div>
          </div>
          <textarea 
            data-role="comment-input" 
            placeholder="Write your reply..."
            rows="3"
            class="inline-reply-textarea"
          ></textarea>
          <div class="reply-form-actions">
            <button data-role="submit-comment" class="inline-reply-submit">💬 Reply</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommentForm(
  readonly: boolean,
  placeholder: string,
  isSubmitting: boolean,
  currentUserProfile: NDKUserProfile | null,
  _replyingToComment: string | null,
  identityMode: 'user' | 'anon' = 'anon',
  hasNip07: boolean = false
): string {
  if (readonly) {
    return '';
  }

  // Use the same avatar processing as getUserAvatar
  let userAvatar = './assets/default_dp.png';
  if (currentUserProfile?.image && currentUserProfile.image.trim() !== '') {
    let imageUrl = currentUserProfile.image.trim();

    // Convert IPFS hash to gateway URL if needed
    if (imageUrl.startsWith('Qm') || imageUrl.startsWith('bafy')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl}`;
    }

    // Ensure protocol is included
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    userAvatar = imageUrl;
  }

  const userName = currentUserProfile?.displayName || currentUserProfile?.name || 'Anonymous';

  return `
    <div class="comment-form reddit-comment-form">
      <div class="comment-form-container">
        <div class="comment-form-sidebar">
          <img src="${escapeHtml(userAvatar)}" alt="Your avatar" class="current-user-avatar" />
        </div>
        <div class="comment-form-main">
          <div class="comment-form-header">
            <span class="current-user-name">Commenting as ${escapeHtml(userName)}</span>
            <div class="identity-toggle">
              <label class="toggle-label">Identity:</label>
              <button data-role="toggle-as-user" class="identity-btn ${identityMode === 'user' ? 'active' : ''}" ${!hasNip07 ? 'disabled' : ''}>User</button>
              <button data-role="toggle-as-anon" class="identity-btn ${identityMode === 'anon' ? 'active' : ''}">Anonymous</button>
            </div>
          </div>
          <div class="comment-form-body">
            <textarea 
              data-role="comment-input" 
              placeholder="${escapeHtml(placeholder)}"
              rows="4"
              ${isSubmitting ? 'disabled' : ''}
              class="reddit-textarea"
            ></textarea>
            <div class="comment-form-toolbar">
              <div class="formatting-help">
                <small>💡 Ctrl+Enter to submit</small>
              </div>
              <div class="comment-form-actions">
                <button 
                  data-role="submit-comment" 
                  class="reddit-submit-btn"
                  ${isSubmitting ? 'disabled' : ''}
                >
                  ${isSubmitting ? '⏳ Submitting...' : '📝 Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommentsList(comments: Comment[], readonly: boolean = false, replyingToComment: string | null = null, currentUserProfile: any = null, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
  // Count total comments including replies
  const totalCount = countTotalComments(comments);

  if (totalCount === 0) {
    return `
      <div class="no-comments">
        <p>No comments yet. Be the first to comment!</p>
      </div>
    `;
  }

  return `
    <div class="comments-list">
      <div class="comments-header">
        <h3>${totalCount} Comment${totalCount !== 1 ? 's' : ''}</h3>
      </div>
      <div class="comments-container">
        ${comments.map(comment => renderComment(comment, readonly, replyingToComment, currentUserProfile, identityMode, hasNip07)).join('')}
      </div>
    </div>
  `;
}

function countTotalComments(comments: Comment[]): number {
  let count = 0;
  for (const comment of comments) {
    count += 1 + countTotalComments(comment.replies);
  }
  return count;
}

export function renderCommentWidget(
  isLoading: boolean,
  isError: boolean,
  errorMessage: string,
  comments: Comment[],
  readonly: boolean,
  placeholder: string,
  isSubmitting: boolean,
  currentUserProfile: NDKUserProfile | null = null,
  replyingToComment: string | null = null,
  identityMode: 'user' | 'anon' = 'anon',
  hasNip07: boolean = false
): string {
  if (isLoading) {
    return `
      <div class="comment-widget loading">
        <div class="loading-indicator">
          <div class="loading-spinner"></div>
          <p>Loading comments...</p>
        </div>
      </div>
    `;
  }

  if (isError) {
    return `
      <div class="comment-widget error">
        <div class="error-message">
          <p>❌ Failed to load comments</p>
          ${errorMessage ? `<small>${escapeHtml(errorMessage)}</small>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="comment-widget">
      ${renderCommentForm(readonly, placeholder, isSubmitting, currentUserProfile, replyingToComment, identityMode, hasNip07)}
      ${renderCommentsList(comments, readonly, replyingToComment, currentUserProfile, identityMode, hasNip07)}
      <div class="powered-by">
        <small>Powered by <a href="https://nostr.org" target="_blank">Nostr</a></small>
      </div>
    </div>
  `;
}

export function getCommentStyles(theme: Theme): string {
  return `
    <style>
      :host {
        /* Define CSS variables on the host element */
        --nstrc-comment-background: var(--nstrc-comment-background-${theme});
        --nstrc-comment-text-color: var(--nstrc-comment-text-color-${theme});
        --nstrc-comment-border-color: var(--nstrc-comment-border-color-${theme});
        --nstrc-comment-input-background: var(--nstrc-comment-input-background-${theme});
        --nstrc-comment-button-background: var(--nstrc-comment-button-background-${theme});
        --nstrc-comment-button-text: var(--nstrc-comment-button-text-${theme});
        --nstrc-comment-hover-background: var(--nstrc-comment-hover-background-${theme});
        --nstrc-comment-meta-color: var(--nstrc-comment-meta-color-${theme});
        display: block;
        contain: content;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      :host(.dark) {
        --nstrc-comment-background: var(--nstrc-comment-background-dark);
        --nstrc-comment-text-color: var(--nstrc-comment-text-color-dark);
        --nstrc-comment-border-color: var(--nstrc-comment-border-color-dark);
        --nstrc-comment-input-background: var(--nstrc-comment-input-background-dark);
        --nstrc-comment-button-background: var(--nstrc-comment-button-background-dark);
        --nstrc-comment-button-text: var(--nstrc-comment-button-text-dark);
        --nstrc-comment-meta-color: var(--nstrc-comment-meta-color-dark);
        --nstrc-comment-hover-background: var(--nstrc-comment-hover-background-dark);
      }

      /* CSS Variables with defaults */
      :host {
        --nstrc-comment-background-light: #ffffff;
        --nstrc-comment-background-dark: #1a1a1a;
        --nstrc-comment-text-color-light: #333333;
        --nstrc-comment-text-color-dark: #ffffff;
        --nstrc-comment-border-color-light: #e1e5e9;
        --nstrc-comment-border-color-dark: #404040;
        --nstrc-comment-input-background-light: #ffffff;
        --nstrc-comment-input-background-dark: #2a2a2a;
        --nstrc-comment-button-background-light: #007bff;
        --nstrc-comment-button-background-dark: #0d6efd;
        --nstrc-comment-button-text-light: #ffffff;
        --nstrc-comment-button-text-dark: #ffffff;
        --nstrc-comment-meta-color-light: #6c757d;
        --nstrc-comment-meta-color-dark: #adb5bd;
        --nstrc-comment-hover-background-light: #f8f9fa;
        --nstrc-comment-hover-background-dark: #2d2d30;
      }

      .nostr-comment-wrapper {
        display: block;
        width: 100%;
      }

      .comment-widget {
        background: var(--nstrc-comment-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        border-radius: 8px;
        max-width: 100%;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .comment-widget.loading,
      .comment-widget.error {
        text-align: center;
        padding: 40px 20px;
      }

      .loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-top: 2px solid var(--nstrc-comment-button-background, #007bff);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .error-message {
        color: #dc3545;
      }

      /* Reddit-style Comment Form */
      .reddit-comment-form {
        margin-bottom: 24px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 8px;
        background: var(--nstrc-comment-background, #ffffff);
      }

      .comment-form-container {
        display: flex;
        padding: 12px;
        gap: 12px;
      }

      .comment-form-sidebar {
        flex-shrink: 0;
      }

      .current-user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        border: 2px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .comment-form-main {
        flex: 1;
        min-width: 0;
      }

      .comment-form-header {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .current-user-name {
        font-weight: 500;
        font-size: 13px;
        color: var(--nstrc-comment-meta-color, #6c757d);
      }

      .identity-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .toggle-label {
        font-size: 12px;
        color: var(--nstrc-comment-meta-color, #6c757d);
      }
      .identity-btn {
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        background: var(--nstrc-comment-input-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        border-radius: 4px;
        cursor: pointer;
      }
      .identity-btn:hover {
        background: var(--nstrc-comment-hover-background);
      }
      .identity-btn.active {
        background: var(--nstrc-comment-button-background);
        color: var(--nstrc-comment-button-text, #ffffff);
        border-color: var(--nstrc-comment-button-background);
      }

      .reply-indicator {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--nstrc-comment-hover-background);
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 8px;
        font-size: 13px;
        color: var(--nstrc-comment-button-background, #007bff);
        border: 1px solid var(--nstrc-comment-border-color);
      }

      .cancel-reply-btn {
        background: none;
        border: none;
        color: var(--nstrc-comment-meta-color, #6c757d);
        cursor: pointer;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 3px;
        line-height: 1;
        font-weight: bold;
      }

      .cancel-reply-btn:hover {
        background: #dc3545;
        color: white;
      }

      .reddit-textarea {
        width: 100%;
        min-height: 80px;
        padding: 12px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 4px;
        background: var(--nstrc-comment-input-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
      }

      .reddit-textarea:focus {
        outline: none;
        border-color: var(--nstrc-comment-button-background, #007bff);
        box-shadow: 0 0 0 1px var(--nstrc-comment-button-background, #007bff);
      }

      .reddit-textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--nstrc-comment-hover-background);
      }

      .comment-form-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .formatting-help {
        color: var(--nstrc-comment-meta-color, #6c757d);
      }

      .formatting-help small {
        font-size: 12px;
      }

      .reddit-submit-btn {
        background: var(--nstrc-comment-button-background, #ff4500);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .reddit-submit-btn:hover:not(:disabled) {
        background: #e03e00;
        transform: translateY(-1px);
      }

      .reddit-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .comments-list {
        margin-bottom: 16px;
      }

      .comments-header h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--nstrc-comment-text-color, #333333);
      }

      .no-comments {
        text-align: center;
        padding: 40px 20px;
        color: var(--nstrc-comment-meta-color, #6c757d);
      }

      .no-comments p {
        margin: 0;
        font-style: italic;
      }

      .comments-container {
        display: flex;
        flex-direction: column;
      }

      /* Reddit-style Comments */
      .reddit-comment {
        position: relative;
        background: var(--nstrc-comment-input-background, #ffffff);
        margin-bottom: 2px;
      }

      .comment-thread-line {
        position: absolute;
        width: 2px;
        top: 48px;
        bottom: 0;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        z-index: 1;
      }

      .comment-container {
        display: flex;
        padding: 8px 12px;
        margin-left: calc(var(--depth, 0) * 60px);
        border-left: 2px solid transparent;
        transition: all 0.2s ease;
      }

      .comment-container:hover {
        background: var(--nstrc-comment-hover-background, #f8f9fa);
        border-left-color: var(--nstrc-comment-button-background, #007bff);
      }

      .comment-sidebar {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 32px;
        margin-right: 12px;
        position: relative;
        z-index: 2;
      }

      .comment-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        border: 2px solid var(--nstrc-comment-background, #ffffff);
        margin-bottom: 4px;
      }

      .comment-collapse-line {
        width: 2px;
        flex: 1;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        min-height: 12px;
      }

      .comment-main {
        flex: 1;
        min-width: 0;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .comment-author {
        font-weight: 600;
        font-size: 12px;
        color: var(--nstrc-comment-button-background, #007bff);
        text-decoration: none;
      }

      .comment-author:hover {
        text-decoration: underline;
      }

      .comment-score {
        font-size: 12px;
        color: var(--nstrc-comment-meta-color, #6c757d);
        font-weight: 500;
      }

      .comment-time {
        font-size: 12px;
        color: var(--nstrc-comment-meta-color, #6c757d);
      }

      .comment-content {
        font-size: 14px;
        line-height: 1.4;
        color: var(--nstrc-comment-text-color, #333333);
        margin-bottom: 8px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .comment-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 4px;
      }

      .reply-button {
        background: none;
        border: none;
        color: var(--nstrc-comment-meta-color, #6c757d);
        cursor: pointer;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 3px;
        transition: all 0.2s ease;
        font-weight: 600;
      }

      .reply-button:hover {
        background: var(--nstrc-comment-hover-background);
        color: var(--nstrc-comment-text-color);
      }

      .comment-replies {
        margin-top: 24px; /* Double the spacing between parent and child */
      }

      /* Inline Reply Form Styles */
      .inline-reply-form {
        margin-top: 16px;
        padding: 16px;
        background: var(--nstrc-comment-hover-background);
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 8px;
      }

      .reply-context {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .reply-context-text {
        font-size: 13px;
        color: var(--nstrc-comment-button-background, #007bff);
      }

      .reply-form-container {
        display: flex;
        gap: 12px;
      }

      .reply-form-sidebar {
        flex-shrink: 0;
      }

      .reply-user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        border: 2px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .reply-form-main {
        flex: 1;
        min-width: 0;
      }

      .reply-form-header {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .reply-form-header .current-user-name {
        font-size: 12px;
        color: var(--nstrc-comment-meta-color, #6c757d);
        font-weight: 500;
      }

      .reply-form-header .identity-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .reply-form-header .toggle-label {
        font-size: 11px;
        color: var(--nstrc-comment-meta-color, #6c757d);
        font-weight: 500;
      }

      .reply-form-header .identity-btn {
        padding: 2px 6px;
        font-size: 10px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        background: var(--nstrc-comment-input-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        border-radius: 3px;
        cursor: pointer;
      }

      .reply-form-header .identity-btn:hover {
        background: var(--nstrc-comment-hover-background);
      }

      .reply-form-header .identity-btn.active {
        background: var(--nstrc-comment-button-background);
        color: var(--nstrc-comment-button-text, #ffffff);
        border-color: var(--nstrc-comment-button-background);
      }

      .reply-form-header .identity-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .inline-reply-textarea {
        width: 100%;
        min-height: 60px;
        padding: 12px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 4px;
        background: var(--nstrc-comment-input-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
      }

      .inline-reply-textarea:focus {
        outline: none;
        border-color: var(--nstrc-comment-button-background, #007bff);
        box-shadow: 0 0 0 1px var(--nstrc-comment-button-background, #007bff);
      }

      .reply-form-actions {
        margin-top: 8px;
        display: flex;
        justify-content: flex-end;
      }

      .inline-reply-submit {
        background: var(--nstrc-comment-button-background, #ff4500);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .inline-reply-submit:hover:not(:disabled) {
        background: #e03e00;
      }

      .inline-reply-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .powered-by {
        text-align: center;
        padding-top: 16px;
        border-top: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .powered-by small {
        color: var(--nstrc-comment-meta-color, #6c757d);
        font-size: 12px;
      }

      .powered-by a {
        color: var(--nstrc-comment-button-background, #007bff);
        text-decoration: none;
      }

      .powered-by a:hover {
        text-decoration: underline;
      }

      @media (max-width: 480px) {
        .comment-widget {
          padding: 16px;
        }
        
        .comment-form-actions {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
        
        .comment-hint {
          text-align: center;
        }
      }
    </style>
  `;
}
