// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const NPUB_PATTERN = /npub1[023456789acdefghjklmnpqrstuvwxyz]{58}/gi;

  function getVideoInfo() {
    return extension.url.parseYouTubeUrl(
      typeof window !== 'undefined' ? window.location.href : ''
    );
  }

  function findActionBar(root) {
    const selectors = [
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      'ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions'
    ];
    for (const selector of selectors) {
      const actionBar = root.querySelector(selector);
      if (actionBar) return actionBar;
    }
    return null;
  }

  function findAction(actionBar, videoId) {
    return actionBar.querySelector(
      '[data-nostr-youtube-action="true"][data-video-id="' + videoId + '"]'
    );
  }

  function extractDeclaredNpub(root) {
    const candidates = root.querySelectorAll([
      '#owner ytd-channel-name',
      '#owner #channel-name',
      '#owner a[href^="nostr:npub1"]',
      'ytd-video-owner-renderer ytd-channel-name',
      'ytd-video-owner-renderer a[href^="nostr:npub1"]',
      'ytm-slim-owner-renderer'
    ].join(','));
    for (const candidate of candidates) {
      const text = String(
        candidate.getAttribute?.('content') ||
        candidate.getAttribute?.('href') ||
        candidate.textContent ||
        ''
      );
      const matches = text.match(NPUB_PATTERN) || [];
      for (const match of matches) {
        if (extension.url.isValidNpub(match)) return match;
      }
    }
    return null;
  }

  function resolveRecipientNpub(root) {
    return extractDeclaredNpub(root);
  }

  function stopActionNavigation(slot) {
    slot.addEventListener('click', function (event) {
      event.stopPropagation();
    });
  }

  function createNostrAction(videoInfo, theme, recipientNpub) {
    const slot = document.createElement('div');
    slot.className = 'nostr-youtube-action-slot';
    slot.setAttribute('data-nostr-youtube-action', 'true');
    slot.setAttribute('data-video-id', videoInfo.videoId);
    slot.setAttribute('data-status-url', videoInfo.canonicalUrl);
    slot.setAttribute('data-theme', theme);
    if (extension.url.isValidNpub(recipientNpub)) {
      slot.setAttribute('data-recipient-npub', recipientNpub);
    }
    stopActionNavigation(slot);
    return { slot: slot };
  }

  function createLikeComponent(slot) {
    const component = document.createElement('nostr-like-button');
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-surface', 'youtube');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    slot.appendChild(component);
    return component;
  }

  function syncZapComponent(slot) {
    if (typeof extension.componentLoader?.hydrate === 'function') {
      extension.componentLoader.hydrate(slot);
      return slot.querySelector('nostr-zap-button');
    }

    let component = slot.querySelector('nostr-zap-button');
    const npub = slot.dataset.recipientNpub;
    if (!extension.url.isValidNpub(npub)) {
      component?.remove();
      return null;
    }
    const shouldAppend = !component;
    if (!component) component = document.createElement('nostr-zap-button');
    component.setAttribute('npub', npub);
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-surface', 'youtube');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    if (shouldAppend) slot.appendChild(component);
    return component;
  }

  function hydrateNostrAction(slot) {
    if (typeof extension.componentLoader?.hydrate === 'function') {
      extension.componentLoader.hydrate(slot);
      return slot.querySelector('nostr-like-button');
    }

    const like = slot.querySelector('nostr-like-button') || createLikeComponent(slot);
    syncZapComponent(slot);
    return like;
  }

  function updateActionTheme(slot, theme) {
    slot.dataset.theme = theme;
    for (const selector of ['nostr-like-button', 'nostr-zap-button']) {
      const component = slot.querySelector(selector);
      if (component && component.getAttribute('data-theme') !== theme) {
        component.setAttribute('data-theme', theme);
      }
    }
  }

  function updateRecipient(slot, recipientNpub) {
    if (extension.url.isValidNpub(recipientNpub)) {
      slot.dataset.recipientNpub = recipientNpub;
    } else {
      delete slot.dataset.recipientNpub;
    }
    if (slot.querySelector('nostr-like-button')) syncZapComponent(slot);
  }

  function findNativeLike(actionBar) {
    return actionBar.querySelector([
      'like-button-view-model button',
      '#segmented-like-button button',
      'button[aria-label^="like this video" i]',
      'button[aria-label^="like" i]'
    ].join(','));
  }

  function directChildContaining(actionBar, descendant) {
    let current = descendant;
    while (current && current.parentElement !== actionBar) {
      current = current.parentElement;
    }
    return current && current.parentElement === actionBar ? current : null;
  }

  function insertAfterNativeLike(actionBar, slot) {
    const nativeLike = findNativeLike(actionBar);
    const likeContainer = nativeLike
      ? directChildContaining(actionBar, nativeLike)
      : null;
    if (likeContainer) {
      actionBar.insertBefore(slot, likeContainer.nextSibling);
      return;
    }
    actionBar.appendChild(slot);
  }

  function removeStaleActions(actionBar, videoId) {
    const actions = actionBar.querySelectorAll?.('[data-nostr-youtube-action="true"]') || [];
    for (const action of actions) {
      if (action.dataset.videoId !== videoId) action.remove();
    }
  }

  extension.youtubeDom = {
    getVideoInfo,
    findActionBar,
    findAction,
    extractDeclaredNpub,
    resolveRecipientNpub,
    createNostrAction,
    hydrateNostrAction,
    updateActionTheme,
    updateRecipient,
    insertAfterNativeLike,
    removeStaleActions
  };
})();
