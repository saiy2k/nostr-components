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
    console.log('Processing image URL:', imageUrl, 'for user:', comment.userProfile.name || comment.pubkey);

    // Convert IPFS hash to gateway URL if needed
    if (imageUrl.startsWith('Qm') || imageUrl.startsWith('bafy')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl}`;
      console.log('Converted IPFS to gateway URL:', imageUrl);
    }

    // Ensure protocol is included
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
      console.log('Added protocol to URL:', imageUrl);
    }

    console.log('Final image URL:', imageUrl);
    return imageUrl;
  }
  console.log('No image found for user:', comment.userProfile?.name || comment.pubkey, 'using default');
  // Components are in dist/components/, so assets are at ../../assets/ from component location
  return '../../assets/default_dp.png';
}

function renderComment(comment: Comment, readonly: boolean = false, replyingToComment: string | null = null, currentUserProfile: NDKUserProfile | null = null, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
  const displayName = getUserDisplayName(comment);
  const avatar = getUserAvatar(comment);
  const timeAgo = formatTimeAgo(comment.created_at);
  const depth = comment.depth || 0;
  const maxDepth = 6; // Maximum nesting depth
  const isReplying = replyingToComment === comment.id;

  return `
    <div class="modern-comment" data-comment-id="${escapeHtml(comment.id)}" data-depth="${depth}">
      <div class="comment-content-wrapper">
        <div class="comment-avatar-section">
          <img src="${avatar}" alt="Avatar" class="comment-avatar" />
        </div>
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(displayName)}</span>
            <span class="comment-time">${escapeHtml(timeAgo)}</span>
          </div>
          <div class="comment-text">
            ${escapeHtml(comment.content.trim())}
          </div>
          <div class="comment-actions">
            ${!readonly ? `<button class="reply-btn" data-comment-id="${escapeHtml(comment.id)}" aria-label="Reply to comment">
              <span class="reply-icon">💬</span>
              <span class="reply-text">Reply</span>
            </button>` : ''}
          </div>
          ${isReplying ? renderInlineReplyForm(comment, currentUserProfile, identityMode, hasNip07) : ''}
        </div>
      </div>
      ${comment.replies.length > 0 ? `
        <div class="comment-replies" style="margin-left: ${Math.min(depth + 1, maxDepth) * 24}px;">
          ${comment.replies.map(reply => renderComment(reply, readonly, replyingToComment, currentUserProfile, identityMode, hasNip07)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderInlineReplyForm(parentComment: Comment, currentUserProfile: NDKUserProfile | null, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
  // Use the same avatar processing as getUserAvatar
  // Components are in dist/components/, so assets are at ../../assets/ from component location
  let userAvatar = '../../assets/default_dp.png';
  console.log('renderInlineReplyForm - currentUserProfile:', currentUserProfile);

  if (currentUserProfile?.image && currentUserProfile.image.trim() !== '') {
    let imageUrl = currentUserProfile.image.trim();
    console.log('Inline reply form - Processing image URL:', imageUrl);

    // Convert IPFS hash to gateway URL if needed
    if (imageUrl.startsWith('Qm') || imageUrl.startsWith('bafy')) {
      imageUrl = `https://ipfs.io/ipfs/${imageUrl}`;
      console.log('Inline reply form - Converted IPFS to gateway URL:', imageUrl);
    }

    // Ensure protocol is included
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
      console.log('Inline reply form - Added protocol to URL:', imageUrl);
    }

    console.log('Inline reply form - Final image URL:', imageUrl);
    userAvatar = imageUrl;
  } else {
    console.log('Inline reply form - No image found, using default');
  }

  const parentName = getUserDisplayName(parentComment);

  return `
    <div class="inline-reply-form">
      <div class="reply-context">
        <span class="reply-context-text">💬 Replying to <strong>${escapeHtml(parentName)}</strong></span>
        <button data-role="cancel-reply" class="cancel-reply-btn" aria-label="Cancel reply">✕</button>
      </div>
      <div class="reply-input-container">
        <div class="reply-input-avatar">
          <img src="${userAvatar}" alt="Your avatar" class="user-avatar" />
        </div>
        <div class="reply-input-main">
          <textarea 
            data-role="comment-input" 
            placeholder="Write your reply..."
            rows="2"
            class="modern-comment-textarea"
          ></textarea>
          <div class="reply-input-footer">
            <div class="identity-toggle">
              <button data-role="toggle-as-user" class="identity-btn ${identityMode === 'user' ? 'active' : ''}" ${!hasNip07 ? 'disabled' : ''} title="${!hasNip07 ? 'NIP-07 extension not detected' : 'Use your Nostr extension'}">
                <span class="identity-icon">${!hasNip07 ? '🔌' : '✅'}</span>
                <span class="identity-text">User</span>
              </button>
              <button data-role="toggle-as-anon" class="identity-btn ${identityMode === 'anon' ? 'active' : ''}" title="Comment anonymously">
                <span class="identity-icon">👤</span>
                <span class="identity-text">Anonymous</span>
              </button>
            </div>
            <div class="reply-actions">
              <button data-role="cancel-reply" class="cancel-reply-btn" aria-label="Cancel reply">Cancel</button>
              <button data-role="submit-comment" class="submit-reply-btn" aria-label="Submit reply">
                <span class="submit-icon">💬</span>
                <span class="submit-text">Reply</span>
              </button>
            </div>
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

  console.log('renderCommentForm - currentUserProfile:', currentUserProfile);

  return `
    <div class="modern-comment-form">
      <div class="comment-input-container">
        <div class="comment-input-main">
          <textarea 
            data-role="comment-input" 
            placeholder="${escapeHtml(placeholder)}"
            rows="3"
            ${isSubmitting ? 'disabled' : ''}
            class="modern-comment-textarea"
          ></textarea>
          <div class="comment-input-footer">
            <div class="identity-toggle">
              <button data-role="toggle-as-user" class="identity-btn ${identityMode === 'user' ? 'active' : ''}" ${!hasNip07 ? 'disabled' : ''} title="${!hasNip07 ? 'NIP-07 extension not detected' : 'Use your Nostr extension'}">
                <span class="identity-icon">${!hasNip07 ? '🔌' : '✅'}</span>
                <span class="identity-text">User</span>
              </button>
              <button data-role="toggle-as-anon" class="identity-btn ${identityMode === 'anon' ? 'active' : ''}" title="Comment anonymously">
                <span class="identity-icon">👤</span>
                <span class="identity-text">Anonymous</span>
              </button>
            </div>
            <button 
              data-role="submit-comment" 
              class="submit-comment-btn"
              ${isSubmitting ? 'disabled' : ''}
              aria-label="${isSubmitting ? 'Submitting comment' : 'Submit comment'}"
            >
              ${isSubmitting ? '⏳' : '💬'}
              <span class="submit-text">${isSubmitting ? 'Submitting...' : 'Comment'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommentsList(comments: Comment[], readonly: boolean = false, replyingToComment: string | null = null, currentUserProfile: NDKUserProfile | null = null, identityMode: 'user' | 'anon' = 'anon', hasNip07: boolean = false): string {
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
        <div class="comments-title">
          <span class="comments-label">Comments</span>
          <span class="comments-count-badge">${totalCount}</span>
        </div>
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
        --nstrc-comment-shadow: var(--nstrc-comment-shadow-${theme});
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
        --nstrc-comment-shadow: var(--nstrc-comment-shadow-dark);
      }

      /* CSS Variables with defaults */
      :host {
        --nstrc-comment-background-light: #f8f9fa;
        --nstrc-comment-background-dark: #1a1a1a;
        --nstrc-comment-text-color-light: #333333;
        --nstrc-comment-text-color-dark: #ffffff;
        --nstrc-comment-border-color-light: #e1e5e9;
        --nstrc-comment-border-color-dark: #404040;
        --nstrc-comment-input-background-light: #f5f5f5;
        --nstrc-comment-input-background-dark: #2a2a2a;
        --nstrc-comment-button-background-light: #ff6b35;
        --nstrc-comment-button-background-dark: #ff6b35;
        --nstrc-comment-button-text-light: #ffffff;
        --nstrc-comment-button-text-dark: #ffffff;
        --nstrc-comment-meta-color-light: #6c757d;
        --nstrc-comment-meta-color-dark: #adb5bd;
        --nstrc-comment-hover-background-light: #e9ecef;
        --nstrc-comment-hover-background-dark: #2d2d30;
        --nstrc-comment-shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
        --nstrc-comment-shadow-dark: 0 2px 8px rgba(0, 0, 0, 0.3);
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

      /* Modern Comment Form */
      .modern-comment-form {
        margin-bottom: 16px;
        background: var(--nstrc-comment-input-background, #f5f5f5);
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: var(--nstrc-comment-shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
      }

      .comment-input-container {
        display: flex;
        padding: 16px;
        gap: 12px;
        align-items: flex-start;
      }

      .comment-input-main {
        flex: 1;
        min-width: 0;
      }

      .comment-input-main textarea {
        width: 100%;
        min-height: 60px;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        background: var(--nstrc-comment-background, #f8f9fa);
        color: var(--nstrc-comment-text-color, #333333);
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        transition: all 0.2s ease;
        line-height: 1.4;
      }

      .comment-input-main textarea:focus {
        outline: none;
        background: var(--nstrc-comment-background, #f8f9fa);
        box-shadow: 0 0 0 2px var(--nstrc-comment-button-background, #ff6b35);
      }

      .comment-input-main textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--nstrc-comment-hover-background, #e9ecef);
      }

      .comment-input-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .identity-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .identity-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        background: var(--nstrc-comment-background, #f8f9fa);
        color: var(--nstrc-comment-text-color, #333333);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
      }

      .identity-btn:hover {
        background: var(--nstrc-comment-hover-background);
        transform: translateY(-1px);
      }

      .identity-btn.active {
        background: var(--nstrc-comment-button-background);
        color: var(--nstrc-comment-button-text, #ffffff);
        border-color: var(--nstrc-comment-button-background);
      }

      .identity-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .identity-icon {
        font-size: 14px;
      }

      .identity-text {
        font-weight: 500;
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

      .submit-comment-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--nstrc-comment-button-background, #ff6b35);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(255, 107, 53, 0.2);
      }

      .submit-comment-btn:hover:not(:disabled) {
        background: #e55a2b;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
      }

      .submit-comment-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .submit-icon {
        font-size: 16px;
      }

      .submit-text {
        font-weight: 600;
      }


      .comments-list {
        margin-bottom: 16px;
      }

      .comments-header {
        margin-bottom: 12px;
      }

      .comments-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .comments-label {
        font-size: 18px;
        font-weight: 600;
        color: var(--nstrc-comment-text-color, #333333);
      }

      .comments-count-badge {
        background: var(--nstrc-comment-button-background, #007bff);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
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

      /* Ultra-Compact Modern Comments */
      .modern-comment {
        background: var(--nstrc-comment-background, #ffffff);
        border-bottom: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        margin-bottom: 0;
        transition: background-color 0.2s ease;
      }

      .modern-comment:hover {
        background: var(--nstrc-comment-hover-background, #f8f9fa);
      }

      .modern-comment:last-child {
        border-bottom: none;
      }

      .comment-content-wrapper {
        display: flex;
        padding: 8px 12px;
        gap: 8px;
        align-items: flex-start;
      }

      .comment-avatar-section {
        flex-shrink: 0;
      }

      .comment-avatar {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .comment-body {
        flex: 1;
        min-width: 0;
        margin: 0;
        padding: 0;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
        flex-wrap: wrap;
      }

      .comment-author {
        font-weight: 600;
        font-size: 12px;
        color: var(--nstrc-comment-text-color, #333333);
        text-decoration: none;
      }

      .comment-author:hover {
        color: var(--nstrc-comment-button-background, #007bff);
      }

      .comment-time {
        font-size: 11px;
        color: var(--nstrc-comment-meta-color, #6c757d);
        font-weight: 400;
      }

      .comment-text {
        font-size: 13px;
        line-height: 0.45;
        color: var(--nstrc-comment-text-color, #333333);
        margin-bottom: 3px;
        white-space: pre-line;
        word-wrap: break-word;
        margin-top: 0;
      }

      .comment-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 0;
      }

      .reply-btn {
        display: flex;
        align-items: center;
        gap: 3px;
        background: none;
        border: none;
        color: var(--nstrc-comment-meta-color, #6c757d);
        cursor: pointer;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        transition: all 0.2s ease;
        font-weight: 500;
      }

      .reply-btn:hover {
        background: var(--nstrc-comment-hover-background);
        color: var(--nstrc-comment-text-color);
      }

      .reply-icon {
        font-size: 10px;
      }

      .reply-text {
        font-weight: 500;
      }

      .comment-replies {
        margin-top: 0;
        border-left: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        padding-left: 12px;
        margin-left: 34px; /* 26px avatar + 8px gap */
      }

      /* Ultra-Compact Inline Reply Form */
      .inline-reply-form {
        margin-top: 8px;
        padding: 8px;
        background: var(--nstrc-comment-hover-background);
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 4px;
        margin-left: 34px; /* Align with comment text */
      }

      .reply-context {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--nstrc-comment-button-background, #007bff);
        color: white;
        padding: 6px 10px;
        border-radius: 3px;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 500;
      }

      .reply-context-text {
        color: white;
      }

      .reply-input-container {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }

      .reply-input-avatar {
        flex-shrink: 0;
      }

      .reply-input-avatar .user-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--nstrc-comment-border-color, #e1e5e9);
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
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

      .reply-input-main {
        flex: 1;
        min-width: 0;
      }

      .reply-input-main textarea {
        width: 100%;
        min-height: 60px;
        padding: 12px;
        border: 2px solid var(--nstrc-comment-border-color, #e1e5e9);
        border-radius: 8px;
        background: var(--nstrc-comment-input-background, #ffffff);
        color: var(--nstrc-comment-text-color, #333333);
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        transition: all 0.2s ease;
      }

      .reply-input-main textarea:focus {
        outline: none;
        border-color: var(--nstrc-comment-button-background, #007bff);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
      }

      .reply-input-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
      }

      .reply-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .cancel-reply-btn {
        background: none;
        border: 1px solid var(--nstrc-comment-border-color, #e1e5e9);
        color: var(--nstrc-comment-meta-color, #6c757d);
        cursor: pointer;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 3px;
        transition: all 0.2s ease;
        font-weight: 500;
      }

      .cancel-reply-btn:hover {
        background: var(--nstrc-comment-hover-background);
        color: var(--nstrc-comment-text-color);
        border-color: var(--nstrc-comment-border-color, #e1e5e9);
      }

      .submit-reply-btn {
        display: flex;
        align-items: center;
        gap: 3px;
        background: var(--nstrc-comment-button-background, #007bff);
        color: white;
        border: none;
        border-radius: 3px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .submit-reply-btn:hover:not(:disabled) {
        background: #0056b3;
        transform: translateY(-1px);
      }

      .submit-reply-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .submit-icon {
        font-size: 14px;
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

      /* Responsive Design */
      @media (max-width: 768px) {
        .comment-input-container,
        .comment-content-wrapper,
        .reply-input-container {
          padding: 10px;
          gap: 8px;
        }

        .comment-avatar,
        .user-avatar {
          width: 24px;
          height: 24px;
        }

        .comment-input-footer {
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
        }

        .identity-toggle {
          justify-content: center;
        }

        .submit-comment-btn {
          width: 100%;
          justify-content: center;
        }
      }

      @media (max-width: 480px) {
        .comment-input-container,
        .comment-content-wrapper,
        .reply-input-container {
          padding: 8px;
          gap: 6px;
        }

        .comment-avatar,
        .user-avatar {
          width: 22px;
          height: 22px;
        }

        .comment-text {
          font-size: 12px;
        }

        .comment-author {
          font-size: 11px;
        }

        .comment-time {
          font-size: 10px;
        }

        .comments-title {
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }

        .comment-replies {
          margin-left: 30px; /* 22px avatar + 8px gap */
          padding-left: 10px;
        }
      }
    </style>
  `;
}
