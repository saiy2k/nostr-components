// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';

const POLICY_KEY = '__nostrComponentsTrustedHTMLPolicy';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>)[POLICY_KEY];
  vi.resetModules();
});

describe('Trusted Types HTML rendering', () => {
  it('passes TrustedHTML to enforced innerHTML and outerHTML sinks', async () => {
    const createPolicy = vi.fn((_name, rules) => ({
      createHTML(value: string) {
        return { trustedHTML: rules.createHTML(value) };
      },
    }));
    vi.stubGlobal('trustedTypes', { createPolicy });

    const { setTrustedInnerHTML, setTrustedOuterHTML } = await import('../trusted-html');
    let assignedInner: unknown;
    let assignedOuter: unknown;
    const innerTarget = Object.defineProperty({}, 'innerHTML', {
      set(value) {
        if (typeof value === 'string') throw new TypeError('TrustedHTML required');
        assignedInner = value;
      },
    });
    const outerTarget = Object.defineProperty({}, 'outerHTML', {
      set(value) {
        if (typeof value === 'string') throw new TypeError('TrustedHTML required');
        assignedOuter = value;
      },
    });

    setTrustedInnerHTML(innerTarget as ShadowRoot, '<button>Like</button>');
    setTrustedOuterHTML(outerTarget as Element, '<article>Profile</article>');

    expect(createPolicy).toHaveBeenCalledOnce();
    expect(assignedInner).toEqual({ trustedHTML: '<button>Like</button>' });
    expect(assignedOuter).toEqual({ trustedHTML: '<article>Profile</article>' });
  });
});
