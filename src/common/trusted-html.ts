// SPDX-License-Identifier: MIT

const POLICY_NAME = 'nostr-components';

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
};

let trustedHTMLPolicy: TrustedHTMLPolicy | undefined;

function toTrustedHTML(markup: string): string | unknown {
  const root = globalThis as TrustedTypesGlobal;
  const factory = root.trustedTypes;
  if (!factory?.createPolicy) return markup;

  if (!trustedHTMLPolicy) {
    trustedHTMLPolicy = factory.createPolicy(POLICY_NAME, {
      createHTML(value) {
        return value;
      },
    });
  }

  return trustedHTMLPolicy.createHTML(markup);
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
