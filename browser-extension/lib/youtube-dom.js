// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const NPUB_PATTERN = /npub1[023456789acdefghjklmnpqrstuvwxyz]{58}/gi;
  let lastShortsContainer = null;
  let lastShortsVideoId = null;

  function getVideoInfo() {
    return extension.url.parseYouTubeUrl(
      typeof window !== 'undefined' ? window.location.href : ''
    );
  }

  function isShortsPage() {
    try {
      return /^\/shorts\//.test(String(window.location.pathname || ''));
    } catch (_error) {
      return false;
    }
  }

  function getContainerVideoId(container, expectedVideoId) {
    for (const attribute of ['video-id', 'data-video-id']) {
      const value = container.getAttribute?.(attribute);
      if (/^[A-Za-z0-9_-]{11}$/.test(String(value || ''))) return value;
    }

    const links = container.querySelectorAll?.([
      'a[href*="/watch?v="]',
      'a[href^="/shorts/"]',
      'a[href^="https://www.youtube.com/shorts/"]'
    ].join(',')) || [];
    for (const link of links) {
      const parsed = extension.url.parseYouTubeUrl(
        link.getAttribute?.('href') || '',
        window.location.origin
      );
      if (!parsed) continue;
      if (parsed.videoId === expectedVideoId) return parsed.videoId;
    }
    return null;
  }

  function findVideoContainer(root, videoInfo) {
    if (!root?.querySelector || !videoInfo?.videoId) return null;
    const videoId = videoInfo.videoId;
    const selectors = isShortsPage()
      ? [
          `ytd-reel-video-renderer[is-active][video-id="${videoId}"]`,
          `ytd-reel-video-renderer[is-active][data-video-id="${videoId}"]`,
          'ytd-reel-video-renderer[is-active]',
          `ytm-reel-video-renderer[is-active][video-id="${videoId}"]`,
          `ytm-reel-video-renderer[is-active][data-video-id="${videoId}"]`,
          'ytm-reel-video-renderer[is-active]'
        ]
      : [
          `ytd-watch-flexy[video-id="${videoId}"]`,
          `ytd-watch-flexy[data-video-id="${videoId}"]`,
          `ytm-watch[video-id="${videoId}"]`,
          `ytm-watch[data-video-id="${videoId}"]`,
          'ytd-watch-flexy[video-id]',
          'ytm-watch[video-id]',
          'ytm-watch'
        ];

    const checked = new Set();
    for (const selector of selectors) {
      const container = root.querySelector(selector);
      if (!container || checked.has(container)) continue;
      checked.add(container);
      const containerVideoId = getContainerVideoId(container, videoId);
      if (containerVideoId === videoId) {
        if (isShortsPage()) {
          lastShortsContainer = container;
          lastShortsVideoId = videoId;
        }
        return container;
      }
      if (!isShortsPage() && selector === 'ytm-watch' && !containerVideoId) {
        return container;
      }
      if (isShortsPage() && !containerVideoId) {
        if (
          lastShortsContainer === container &&
          lastShortsVideoId !== videoId
        ) {
          continue;
        }
        lastShortsContainer = container;
        lastShortsVideoId = videoId;
        return container;
      }
    }
    return null;
  }

  function findActionBar(root) {
    const selectors = isShortsPage()
      ? [
          'ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions',
          'ytd-reel-video-renderer[is-active] #actions',
          'ytd-reel-player-overlay-renderer #actions',
          '#actions',
          'ytm-reel-player-overlay-renderer #actions',
          'ytm-reel-player-overlay-renderer .reel-player-overlay-actions',
          'ytm-shorts-player-overlay-renderer #actions',
          'ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions'
        ]
      : [
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

  function findVideoContext(root, videoInfo) {
    const container = findVideoContainer(root, videoInfo);
    if (!container) return null;
    const actionBar = findActionBar(container);
    return actionBar ? { container: container, actionBar: actionBar } : null;
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
      'ytd-reel-player-overlay-renderer ytd-channel-name',
      'ytd-reel-player-overlay-renderer #channel-name',
      'ytd-reel-player-overlay-renderer a[href^="nostr:npub1"]',
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
    slot.setAttribute('data-youtube-surface', isShortsPage() ? 'shorts' : 'watch');
    if (extension.url.isValidNpub(recipientNpub)) {
      slot.setAttribute('data-recipient-npub', recipientNpub);
    }
    extension.componentLoader?.registerAction?.(slot, {
      kind: 'youtube',
      url: videoInfo.canonicalUrl,
      theme: theme,
      recipientNpub: recipientNpub
    });
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
    extension.componentLoader?.updateAction?.(slot, { theme: theme });
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
      extension.componentLoader?.updateAction?.(slot, {
        recipientNpub: recipientNpub
      });
    } else {
      delete slot.dataset.recipientNpub;
      extension.componentLoader?.updateAction?.(slot, {
        recipientNpub: null
      });
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

  function isDescendantOf(element, container) {
    let current = element;
    while (current) {
      if (current === container) return true;
      current = current.parentElement;
    }
    return false;
  }

  function removeStaleActions(root, videoId, activeActionBar) {
    const actions = root.querySelectorAll?.('[data-nostr-youtube-action="true"]') || [];
    for (const action of actions) {
      if (
        action.dataset.videoId !== videoId ||
        (activeActionBar && !isDescendantOf(action, activeActionBar))
      ) {
        extension.componentLoader?.revokeAction?.(action);
        action.remove();
      }
    }
  }

  extension.youtubeDom = {
    getVideoInfo,
    findVideoContainer,
    findVideoContext,
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
