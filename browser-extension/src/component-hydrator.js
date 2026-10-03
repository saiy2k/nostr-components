// SPDX-License-Identifier: MIT

import {
  bindTrustedActionContext,
  revokeTrustedActionContext,
} from '../../src/common/trusted-action-context';

export const COMPONENT_HYDRATION_EVENT_PREFIX = 'nostr-components-hydrate:';

const NPUB_PATTERN = /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/;
const ACTION_ID_PATTERN = /^[0-9a-f]{64}$/;
const ownedComponents = new WeakSet();
const ownsComponent = ownedComponents.has.bind(ownedComponents);
const rememberComponent = ownedComponents.add.bind(ownedComponents);
const forgetComponent = ownedComponents.delete.bind(ownedComponents);
const elementPrototype = globalThis.Element?.prototype;
const nativeQuerySelector = elementPrototype?.querySelector;
const nativeAppendChild = elementPrototype?.appendChild;
const nativeInsertBefore = elementPrototype?.insertBefore;
const nativeRemove = elementPrototype?.remove;
const nativeSetAttribute = elementPrototype?.setAttribute;
const childrenGetter = Object.getOwnPropertyDescriptor(
  elementPrototype || {},
  'children',
)?.get;
const eventTargetPrototype = globalThis.EventTarget?.prototype;
const nativeAddEventListener = eventTargetPrototype?.addEventListener;
const watchedSlots = new WeakSet();
const isWatchedSlot = watchedSlots.has.bind(watchedSlots);
const rememberWatchedSlot = watchedSlots.add.bind(watchedSlots);
const targetGetter = Object.getOwnPropertyDescriptor(
  globalThis.Event?.prototype || {},
  'target',
)?.get;
const detailGetter = Object.getOwnPropertyDescriptor(
  globalThis.CustomEvent?.prototype || {},
  'detail',
)?.get;
const readEventTarget = targetGetter
  ? Function.call.bind(targetGetter)
  : event => event.target;
const readEventDetail = detailGetter
  ? Function.call.bind(detailGetter)
  : event => event.detail;

function querySelector(element, selector) {
  return nativeQuerySelector
    ? nativeQuerySelector.call(element, selector)
    : element.querySelector(selector);
}

function appendChild(element, child) {
  return nativeAppendChild
    ? nativeAppendChild.call(element, child)
    : element.appendChild(child);
}

function readChildren(element) {
  const children = childrenGetter ? childrenGetter.call(element) : element.children;
  return children ? Array.prototype.slice.call(children) : [];
}

function insertBefore(parent, child, reference) {
  const next = reference || null;
  return nativeInsertBefore
    ? nativeInsertBefore.call(parent, child, next)
    : parent.insertBefore(child, next);
}

/**
 * Keep Like in the leading slot and Zap immediately after it.
 * Directory lookup can insert the lightning control before hydration.
 */
function placeActionControl(slot, child, previous) {
  if (!child) return;
  const children = readChildren(slot);
  const currentIndex = children.indexOf(child);
  const desiredIndex = previous ? children.indexOf(previous) + 1 : 0;
  if (currentIndex === desiredIndex) return;
  const reference =
    desiredIndex < children.length ? children[desiredIndex] : null;
  if (reference === child) return;
  insertBefore(slot, child, reference);
}

function discardComponent(component) {
  forgetComponent(component);
  revokeTrustedActionContext(component);
  if (nativeRemove) nativeRemove.call(component);
  else component.remove?.();
}

function setAttribute(element, name, value) {
  if (nativeSetAttribute) nativeSetAttribute.call(element, name, value);
  else element.setAttribute(name, value);
}

function discardOwnedChildren(slot) {
  for (const selector of ['nostr-like-button', 'nostr-zap-button']) {
    let component = querySelector(slot, selector);
    let guard = 0;
    while (component && guard < 16) {
      if (ownsComponent(component)) discardComponent(component);
      else if (nativeRemove) nativeRemove.call(component);
      else component.remove?.();
      component = querySelector(slot, selector);
      guard += 1;
    }
  }
}

function watchSlotForRevocation(slot, eventName) {
  if (isWatchedSlot(slot)) return;
  rememberWatchedSlot(slot);
  const revoke = function (event) {
    let target;
    try {
      target = readEventTarget(event);
    } catch (_error) {
      return;
    }
    if (target === slot) discardOwnedChildren(slot);
  };
  if (nativeAddEventListener) {
    nativeAddEventListener.call(slot, eventName, revoke);
  } else {
    slot.addEventListener(eventName, revoke);
  }
}

function normalizeContext(value) {
  if (
    !value ||
    (value.kind !== 'x' && value.kind !== 'youtube') ||
    !ACTION_ID_PATTERN.test(String(value.actionId || '')) ||
    typeof value.url !== 'string' ||
    !value.url.startsWith('https://')
  ) {
    return null;
  }
  const recipientNpub =
    typeof value.recipientNpub === 'string' &&
    NPUB_PATTERN.test(value.recipientNpub)
      ? value.recipientNpub
      : null;
  return {
    actionId: value.actionId,
    kind: value.kind,
    url: value.url,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    recipientNpub: recipientNpub,
  };
}

function bindContext(component, context) {
  bindTrustedActionContext(component, {
    actionId: context.actionId,
    kind: context.kind,
    url: context.url,
    recipientNpub: context.recipientNpub,
  });
}

function setCommonAttributes(component, context) {
  setAttribute(component, 'url', context.url);
  setAttribute(component, 'compact', '');
  setAttribute(component, 'data-theme', context.theme);
  if (context.kind === 'youtube') {
    setAttribute(component, 'data-surface', 'youtube');
  }
}

function constructRegisteredElement(registry, tagName) {
  const ComponentConstructor = registry?.get(tagName);
  return typeof ComponentConstructor === 'function'
    ? new ComponentConstructor()
    : null;
}

/**
 * Hydrate one isolated-world action slot from the page's MAIN world.
 *
 * YouTube's custom-elements-es5-adapter breaks document.createElement() for
 * native class-based third-party elements. Constructing the registered class
 * with `new` bypasses that adapter path.
 */
export function hydrateActionSlot(
  slot,
  suppliedContext,
  registry = globalThis.customElements,
) {
  if (!slot) return false;
  const context = normalizeContext(suppliedContext);
  if (!context) return false;

  let like = querySelector(slot, 'nostr-like-button');
  if (like && !ownsComponent(like)) {
    discardComponent(like);
    like = null;
  }
  if (!like) {
    like = constructRegisteredElement(registry, 'nostr-like-button');
    if (!like) return false;
    rememberComponent(like);
    bindContext(like, context);
    setCommonAttributes(like, context);
    appendChild(slot, like);
  } else {
    bindContext(like, context);
    setCommonAttributes(like, context);
  }

  const recipientNpub = context.recipientNpub;
  let zap = querySelector(slot, 'nostr-zap-button');
  if (zap && !ownsComponent(zap)) {
    discardComponent(zap);
    zap = null;
  }
  if (!recipientNpub) {
    if (zap) discardComponent(zap);
    placeActionControl(slot, like, null);
    return true;
  }

  const shouldAppendZap = !zap;
  if (shouldAppendZap) {
    zap = constructRegisteredElement(registry, 'nostr-zap-button');
    if (!zap) {
      placeActionControl(slot, like, null);
      return false;
    }
    rememberComponent(zap);
  }
  bindContext(zap, context);
  setCommonAttributes(zap, context);
  setAttribute(zap, 'npub', recipientNpub);
  if (shouldAppendZap) appendChild(slot, zap);
  placeActionControl(slot, like, null);
  placeActionControl(slot, zap, like);
  return true;
}

export function installComponentHydrator({
  channel,
  root = globalThis.document,
  registry = globalThis.customElements,
} = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(channel || ''))) {
    throw new Error('Invalid component hydration channel');
  }

  const eventName = COMPONENT_HYDRATION_EVENT_PREFIX + channel;
  const revocationEventName = 'nostr-components-revoke:' + channel;
  const getRegistered = registry?.get?.bind(registry);
  const capturedRegistry = { get: getRegistered };
  const handler = function (event) {
    let target;
    let detail;
    try {
      target = readEventTarget(event);
      detail = readEventDetail(event);
    } catch (_error) {
      return;
    }
    watchSlotForRevocation(target, revocationEventName);
    hydrateActionSlot(target, detail, capturedRegistry);
  };
  root.addEventListener(eventName, handler, true);

  return Object.freeze({
    eventName: eventName,
    dispose: function () {
      root.removeEventListener(eventName, handler, true);
    },
  });
}
