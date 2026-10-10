// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { renderLikeButton, shouldDisableLikeButton } from '../render';
import { getLikeButtonStyles } from '../style';

describe('renderLikeButton', () => {
  it('disables the button and sets aria-busy while loading', () => {
    const html = renderLikeButton({
      isLoading: true,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: false,
      likeCount: 0,
    });

    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="What is a like?"');
    expect(html).toContain('button-text-skeleton');
  });

  it('leaves the button enabled when not loading', () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: false,
      likeCount: 0,
    });

    expect(html).not.toContain(' disabled');
    expect(html).not.toContain('aria-busy');
    expect(html).toContain('>Like</span>');
    expect(html).toContain('>0 likes</span>');
  });

  it('renders compact action-row markup with a numeric count', () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: false,
      likeCount: 12,
      hasLikes: true,
      compact: true,
    });

    expect(html).toContain('aria-label="Like this post with Nostr"');
    expect(html).toContain('>12</span>');
    expect(html).not.toContain('12 likes');
    expect(html).not.toContain('>Like</span>');
    expect(html).not.toContain('help-icon');
    expect(html).not.toContain('like-count clickable');
    expect(html.indexOf('>12</span>')).toBeLessThan(html.indexOf('</button>'));
  });

  it('marks only the standalone count as a likers-dialog target', () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: false,
      likeCount: 12,
      hasLikes: true,
      compact: false,
    });

    expect(html).toContain('class="like-count clickable"');
    expect(html).toContain('aria-label="View likers"');
  });

  it('keeps compact actions enabled while only relay startup is pending', () => {
    expect(
      shouldDisableLikeButton({
        compact: true,
        actionLoading: false,
        connectionLoading: true,
      }),
    ).toBe(false);
    expect(
      shouldDisableLikeButton({
        compact: true,
        actionLoading: true,
        connectionLoading: true,
      }),
    ).toBe(true);
  });

  it('does not paint an unknown liked state as unliked', () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: null,
      likeCount: 1,
    });

    expect(html).toContain('aria-pressed="mixed"');
    expect(html).toContain('aria-label="Like state unknown"');
    expect(html).not.toContain('aria-pressed="false"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('nostr-like-button liked');
    expect(html).not.toContain('>Like</span>');
    expect(html).not.toContain('>Liked</span>');
    expect(html).toContain('1 like');
  });

  it('keeps compact actions retryable after a background relay error', () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: true,
      errorMessage: 'Failed to load likes',
      buttonText: 'Like',
      isLiked: false,
      likeCount: 0,
      compact: true,
    });

    expect(html).not.toContain(' disabled');
    expect(html).toContain('aria-label="Failed to load likes"');
    expect(html).toContain('title="Failed to load likes"');
    expect(html).toContain('<span class="compact-error">Failed to load likes</span>');
    expect(html).not.toContain('0 likes');
  });

  it('gives compact actions a full-width target and a legible icon stroke', () => {
    const styles = getLikeButtonStyles();

    expect(styles).toMatch(
      /:host\(\[compact\]\) \.nostr-like-button \{[^}]*width: auto/s,
    );
    expect(styles).toMatch(
      /:host\(\[compact\]\.is-error\) \.nostr-like-button[\s\S]*box-shadow: inset 0 0 0 1px var\(--nostrc-color-error-text\)/,
    );
    expect(styles).toMatch(
      /:host\(\[compact\]\) \.nostr-like-button svg path \{[^}]*stroke-width: 7/s,
    );
    expect(styles).not.toContain('pointer-events: none');
  });

  it('overrides X compact geometry with a native-sized YouTube pill', () => {
    const styles = getLikeButtonStyles();

    expect(styles).toMatch(
      /:host\(\[compact\]\[data-surface="youtube"\]\)\s*\{[^}]*height: 40px/s,
    );
    expect(styles).toMatch(
      /:host\(\[compact\]\[data-surface="youtube"\]\) \.nostr-like-button\s*\{[^}]*min-width: 40px/s,
    );
  });

  it('keeps the dark liked icon on the same color as the pill label', () => {
    const styles = getLikeButtonStyles();
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: '',
      buttonText: 'Like',
      isLiked: true,
      likeCount: 1,
      theme: 'dark',
    });

    expect(styles).toContain(':host([data-theme="dark"]:not([compact]))');
    expect(styles).toContain('--nostrc-like-btn-liked-bg: #12345a');
    expect(styles).toContain('--nostrc-like-btn-liked-color: #e8f2ff');
    expect(styles).toContain('--nostrc-like-btn-liked-hover-bg: #1a3f6b');
    expect(html).toContain('fill="currentColor"');
    expect(html).not.toContain('#8ab4f8');
    expect(html).not.toContain('#1877f2');
  });
});
