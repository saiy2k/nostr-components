// SPDX-License-Identifier: MIT

const POLICY_NAME = 'nostr-components';
const POLICY_CACHE_KEY = Symbol.for('nostr-components.trusted-html-policy-cache');

type TrustedHTMLPolicy = {
  createHTML(value: string): unknown;
};

type TrustedTypesFactory = {
  createPolicy(
    name: string,
    rules: { createHTML(value: string): string },
  ): TrustedHTMLPolicy;
};

type TrustedTypesGlobal = typeof globalThis & {
  trustedTypes?: TrustedTypesFactory;
  [key: symbol]: unknown;
};

type TrustedHTMLPolicyCache = WeakMap<TrustedTypesFactory, TrustedHTMLPolicy>;

function getRealmPolicyCache(root: TrustedTypesGlobal): TrustedHTMLPolicyCache {
  const existing = root[POLICY_CACHE_KEY];
  if (existing instanceof WeakMap) {
    return existing as TrustedHTMLPolicyCache;
  }

  const cache: TrustedHTMLPolicyCache = new WeakMap();
  Object.defineProperty(root, POLICY_CACHE_KEY, {
    configurable: false,
    enumerable: false,
    value: cache,
    writable: false,
  });
  return cache;
}

function getTrustedHTMLPolicy(
  root: TrustedTypesGlobal,
  factory: TrustedTypesFactory,
): TrustedHTMLPolicy {
  const cache = getRealmPolicyCache(root);
  const cached = cache.get(factory);
  if (cached) return cached;

  const policy = factory.createPolicy(POLICY_NAME, {
    createHTML(value) {
      return value;
    },
  });
  cache.set(factory, policy);
  return policy;
}

function toTrustedHTML(markup: string): string | unknown {
  const root = globalThis as TrustedTypesGlobal;
  const factory = root.trustedTypes;
  if (!factory?.createPolicy) return markup;

  return getTrustedHTMLPolicy(root, factory).createHTML(markup);
}

/** Assign library-rendered markup through a scoped Trusted Types policy. */
export function setTrustedInnerHTML(
  target: Element | ShadowRoot,
  markup: string,
): void {
  Reflect.set(target, 'innerHTML', toTrustedHTML(markup));
}

/** Replace library-rendered markup through the same scoped policy. */
export function setTrustedOuterHTML(target: Element, markup: string): void {
  Reflect.set(target, 'outerHTML', toTrustedHTML(markup));
}
