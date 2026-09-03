// SPDX-License-Identifier: MIT

export const COMPONENT_HYDRATION_EVENT_PREFIX = 'nostr-components-hydrate:';

function setCommonAttributes(component, slot) {
  component.setAttribute('url', slot.dataset.statusUrl || '');
  component.setAttribute('compact', '');
  component.setAttribute('data-theme', slot.dataset.theme || 'light');
  if (slot.dataset.nostrYoutubeAction === 'true') {
    component.setAttribute('data-surface', 'youtube');
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
export function hydrateActionSlot(slot, registry = globalThis.customElements) {
  if (
    !slot ||
    (
      slot.dataset?.nostrYoutubeAction !== 'true' &&
      slot.dataset?.nostrCompetencyLike !== 'true'
    )
  ) {
    return false;
  }

  let like = slot.querySelector('nostr-like-button');
  if (!like) {
    like = constructRegisteredElement(registry, 'nostr-like-button');
    if (!like) return false;
    slot.appendChild(like);
  }
  setCommonAttributes(like, slot);

  const recipientNpub =
    slot.dataset.recipientNpub || slot.dataset.zapRecipientNpub || '';
  let zap = slot.querySelector('nostr-zap-button');
  if (!recipientNpub) {
    zap?.remove();
    return true;
  }

  if (!zap) {
    zap = constructRegisteredElement(registry, 'nostr-zap-button');
    if (!zap) return false;
    slot.appendChild(zap);
  }
  setCommonAttributes(zap, slot);
  zap.setAttribute('npub', recipientNpub);
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
  const handler = function (event) {
    hydrateActionSlot(event.target, registry);
  };
  root.addEventListener(eventName, handler, true);

  return Object.freeze({
    eventName: eventName,
    dispose: function () {
      root.removeEventListener(eventName, handler, true);
    },
  });
}
