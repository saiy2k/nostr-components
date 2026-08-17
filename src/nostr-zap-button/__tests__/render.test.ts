// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { renderZapButton } from '../render';

describe('renderZapButton', () => {
  it('disables the button and sets aria-busy while loading', () => {
    const html = renderZapButton({
      isLoading: true,
      isError: false,
      isSuccess: false,
      errorMessage: '',
      buttonText: 'Zap',
      totalZapAmount: null,
      isAmountLoading: false,
    });

    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="What is a zap?"');
    expect(html).toContain('button-text-skeleton');
  });

  it('leaves the button enabled when not loading', () => {
    const html = renderZapButton({
      isLoading: false,
      isError: false,
      isSuccess: false,
      errorMessage: '',
      buttonText: 'Zap',
      totalZapAmount: null,
      isAmountLoading: false,
    });

    expect(html).not.toContain(' disabled');
    expect(html).not.toContain('aria-busy');
    expect(html).toContain('>Zap</span>');
  });

  it('renders an icon-only compact action with an accessible label and count', () => {
    const html = renderZapButton({
      isLoading: false,
      isError: false,
      isSuccess: false,
      errorMessage: '',
      buttonText: 'Zap',
      totalZapAmount: 21,
      isAmountLoading: false,
      hasZaps: true,
      compact: true,
    });

    expect(html).toContain('class="nostr-zap-button-container compact"');
    expect(html).toContain('aria-label="Zap"');
    expect(html).toContain('>21</span>');
    expect(html).not.toContain('What is a zap?');
    expect(html).not.toContain('>Zap</span>');
  });
});
