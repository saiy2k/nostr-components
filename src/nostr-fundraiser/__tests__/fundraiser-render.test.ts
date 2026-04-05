// SPDX-License-Identifier: MIT

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderFundraiser } from '../render';
import type { ParsedFundraiserEvent } from '../fundraiser-utils';

const previewFundraiser: ParsedFundraiserEvent = {
  content: 'Help fund the next round of extension work for like and zap buttons on mainstream apps.',
  title: 'Support browser extension work',
  description: 'Help fund the next round of extension work for like and zap buttons on mainstream apps.',
  summary: 'Support browser extension work',
  targetAmountMsats: 21_000_000,
  targetAmountSats: 21_000,
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  resourceUrl: 'https://github.com/saiy2k/nostr-components/issues/11',
  beneficiaryZapTags: [],
};

const baseOptions = {
  isLoading: false,
  isError: false,
  errorMessage: '',
  author: {
    displayName: 'Open Source Builder',
  },
  parsedFundraiser: previewFundraiser,
  totalRaised: 12_600,
  donorCount: 18,
  percentRaised: 60,
  remainingAmount: 8_400,
  isClosed: false,
  isDonationsLoading: false,
  donationErrorMessage: '',
  actionErrorMessage: '',
  actionLabel: 'Support this fundraiser',
  createdAtLabel: 'Preview fixture',
};

const originalDocument = globalThis.document;

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('renderFundraiser', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => {
          let text = '';

          return {
            set textContent(value: string) {
              text = String(value ?? '');
            },
            get textContent() {
              return text;
            },
            get innerHTML() {
              return escapeForHtml(text);
            },
          };
        },
      },
    });
  });

  afterAll(() => {
    if (typeof originalDocument === 'undefined') {
      delete (globalThis as { document?: Document }).document;
      return;
    }

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  it('renders the missing identifier validation error clearly', () => {
    const html = renderFundraiser({
      ...baseOptions,
      isError: true,
      errorMessage: 'Provide hex, noteid, or eventid attribute',
      parsedFundraiser: null,
    });

    expect(html).toContain('fundraiser-error-state');
    expect(html).toContain('Provide hex, noteid, or eventid attribute');
  });

  it('renders a visible fundraiser preview with progress, donors, and link', () => {
    const html = renderFundraiser(baseOptions);

    expect(html).toContain('Support browser extension work');
    expect(html).toContain('12,600 sats');
    expect(html).toContain('18 donors');
    expect(html).toContain('60% funded');
    expect(html).toContain('Preview fixture');
    expect(html).toContain('Learn more');
  });

  it('shows the donor loading state when donations are still being fetched', () => {
    const html = renderFundraiser({
      ...baseOptions,
      donorCount: 0,
      isDonationsLoading: true,
    });

    expect(html).toContain('Loading donors...');
  });
});
