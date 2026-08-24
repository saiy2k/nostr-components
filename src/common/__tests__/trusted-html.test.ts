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
    expect((globalThis as Record<string, unknown>)[POLICY_KEY]).toBeUndefined();
  });

  it('reuses one policy across separately evaluated bundles in the same realm', async () => {
    const policyNames = new Set<string>();
    const createPolicy = vi.fn((name: string, rules) => {
      if (policyNames.has(name)) {
        throw new TypeError(`Duplicate Trusted Types policy: ${name}`);
      }
      policyNames.add(name);
      return {
        createHTML(value: string) {
          return { trustedHTML: rules.createHTML(value) };
        },
      };
    });
    vi.stubGlobal('trustedTypes', { createPolicy });
    const firstBundle = await import('../trusted-html');
    const firstTarget = {};

    firstBundle.setTrustedInnerHTML(
      firstTarget as Element,
      '<button>First bundle</button>',
    );
    vi.resetModules();

    const secondBundle = await import('../trusted-html');
    const secondTarget = {};
    secondBundle.setTrustedInnerHTML(
      secondTarget as Element,
      '<button>Second bundle</button>',
    );

    expect(createPolicy).toHaveBeenCalledOnce();
    expect(Reflect.get(firstTarget, 'innerHTML')).toEqual({
      trustedHTML: '<button>First bundle</button>',
    });
    expect(Reflect.get(secondTarget, 'innerHTML')).toEqual({
      trustedHTML: '<button>Second bundle</button>',
    });
    expect((globalThis as Record<string, unknown>)[POLICY_KEY]).toBeUndefined();
  });
});
