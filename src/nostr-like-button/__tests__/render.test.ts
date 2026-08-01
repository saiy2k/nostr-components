// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { renderLikeButton } from '../render';

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
  });
});
