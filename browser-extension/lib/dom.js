// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};

  function nestingDepth(node, ancestor) {
    let depth = 0;
    let current = node;
    while (current && current !== ancestor) {
      depth += 1;
      current = current.parentElement;
    }
    return current === ancestor ? depth : Number.POSITIVE_INFINITY;
  }

  function getTweetInfo(article) {
    const timeLink = article.querySelector('a[href*="/status/"] time');
    if (timeLink && timeLink.closest('a')) {
      const parsedTimeLink = extension.url.parseTweetUrl(
        timeLink.closest('a').getAttribute('href')
      );
      if (parsedTimeLink) {
        return parsedTimeLink;
      }
    }

    const parsedLinks = [];
    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
    for (const link of links) {
      const parsed = extension.url.parseTweetUrl(link.getAttribute('href'));
      if (!parsed) continue;
      parsedLinks.push({
        info: parsed,
        depth: nestingDepth(link, article)
      });
    }
    if (parsedLinks.length === 0) {
      return null;
    }

    const page = extension.url.parseTweetUrl(
      typeof window !== 'undefined' ? window.location.href : ''
    );
    if (page) {
      const matchingPage = parsedLinks.find(function (entry) {
        return entry.info.statusId === page.statusId;
      });
      if (matchingPage) {
        return matchingPage.info;
      }
    }

    parsedLinks.sort(function (left, right) {
      return left.depth - right.depth;
    });
    return parsedLinks[0].info;
  }

  function isLikeAriaLabel(value) {
    const label = String(value || '').trim().toLowerCase();
    return (
      label === 'like' ||
      label.startsWith('like ') ||
      label.startsWith('liked') ||
      label.startsWith('unlike')
    );
  }

  function findLikeControl(root) {
    const nativeLike = root.querySelector(
      '[data-testid="like"], [data-testid="unlike"]'
    );
    if (nativeLike) {
      return nativeLike;
    }

    const buttons = root.querySelectorAll('button');
    for (let index = 0; index < buttons.length; index += 1) {
      if (isLikeAriaLabel(buttons[index].getAttribute('aria-label'))) {
        return buttons[index];
      }
    }
    return null;
  }

  function isActionRow(node, likeControl) {
    if (!node || node === likeControl) {
      return false;
    }
    const childCount = node.children ? node.children.length : 0;
    if (childCount < 3 || childCount > 8) {
      return false;
    }
    const buttons = node.querySelectorAll('button');
    let hasLike = false;
    let hasPeer = false;
    for (let index = 0; index < buttons.length; index += 1) {
      const label = String(buttons[index].getAttribute('aria-label') || '')
        .trim()
        .toLowerCase();
      if (isLikeAriaLabel(label)) hasLike = true;
      if (label === 'reply' || label.startsWith('reply ') ||
          label === 'repost' || label.startsWith('repost ')) {
        hasPeer = true;
      }
    }
    return hasLike && hasPeer;
  }

  function findActionBar(article) {
    const likeControl = findLikeControl(article);
    if (!likeControl) {
      return null;
    }
    if (typeof likeControl.closest === 'function') {
      const group = likeControl.closest('div[role="group"]');
      if (group) {
        return group;
      }
    }

    let current = likeControl.parentElement;
    while (current && current !== article) {
      if (isActionRow(current, likeControl)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function findAction(actionBar, statusId) {
    return actionBar.querySelector(
      '[data-nostr-competency-like="true"][data-status-id="' + statusId + '"]'
    );
  }

  function createNostrAction(tweetInfo, theme) {
    const slot = document.createElement('div');
    slot.className = 'nostr-competency-action-slot';
    slot.setAttribute('data-nostr-competency-like', 'true');
    slot.setAttribute('data-status-id', tweetInfo.statusId);
    slot.setAttribute('data-author-handle', tweetInfo.username);
    slot.setAttribute('data-directory-status', 'loading');
    slot.setAttribute('data-status-url', tweetInfo.canonicalUrl);
    slot.setAttribute('data-theme', theme);
    // X treats unhandled clicks inside a tweet as navigation. Contain clicks
    // across the full action slot, including loading and re-render gaps.
    slot.addEventListener('click', function (event) {
      event.stopPropagation();
    });

    return { slot: slot, component: null };
  }

  function hydrateNostrAction(slot) {
    if (typeof extension.componentLoader?.hydrate === 'function') {
      extension.componentLoader.hydrate(slot);
      return slot.querySelector('nostr-like-button');
    }

    const existing = slot.querySelector('nostr-like-button');
    if (existing) return existing;
    const component = document.createElement('nostr-like-button');
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    slot.appendChild(component);
    syncZapComponent(slot);
    return component;
  }

  function syncZapComponent(slot) {
    if (typeof extension.componentLoader?.hydrate === 'function') {
      extension.componentLoader.hydrate(slot);
      return slot.querySelector('nostr-zap-button');
    }

    let component = slot.querySelector('nostr-zap-button');
    const npub = slot.dataset.zapRecipientNpub;
    if (!extension.url.isValidNpub(npub)) {
      component?.remove();
      return null;
    }
    const shouldAppend = !component;
    if (!component) component = document.createElement('nostr-zap-button');
    component.setAttribute('npub', npub);
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    if (shouldAppend) slot.appendChild(component);
    return component;
  }

  function updateActionTheme(slot, theme) {
    slot.dataset.theme = theme;
    const component = slot.querySelector('nostr-like-button');
    if (component && component.getAttribute('data-theme') !== theme) {
      component.setAttribute('data-theme', theme);
    }
    const zapComponent = slot.querySelector('nostr-zap-button');
    if (zapComponent && zapComponent.getAttribute('data-theme') !== theme) {
      zapComponent.setAttribute('data-theme', theme);
    }
  }

  function directChildContaining(actionBar, descendant) {
    let current = descendant;
    while (current && current.parentElement !== actionBar) {
      current = current.parentElement;
    }
    return current && current.parentElement === actionBar ? current : null;
  }

  function insertAfterNativeLike(actionBar, slot) {
    const likeControl = findLikeControl(actionBar);
    const likeContainer = likeControl
      ? directChildContaining(actionBar, likeControl)
      : null;
    if (likeContainer) {
      actionBar.insertBefore(slot, likeContainer.nextSibling);
      return;
    }
    actionBar.appendChild(slot);
  }

  function applyDirectoryIdentity(slot, identity) {
    if (!identity) {
      slot.dataset.directoryStatus = 'invalid';
      delete slot.dataset.zapRecipientNpub;
      if (slot.querySelector('nostr-like-button')) syncZapComponent(slot);
      return;
    }
    slot.dataset.directoryStatus = identity.verified
      ? 'verified'
      : identity.found
        ? 'candidate'
        : 'not-found';
    slot.dataset.directorySource = identity.source || 'unknown';
    if (identity.activeIdentity && identity.activeIdentity.npub) {
      slot.dataset.authorNpub = identity.activeIdentity.npub;
    }
    const activeIdentity = identity.activeIdentity;
    if (
      identity.verified === true &&
      activeIdentity?.zappable === true &&
      extension.url.isValidNpub(activeIdentity.npub)
    ) {
      slot.dataset.zapRecipientNpub = activeIdentity.npub;
    } else {
      delete slot.dataset.zapRecipientNpub;
    }
    if (slot.querySelector('nostr-like-button')) syncZapComponent(slot);
  }

  extension.dom = {
    getTweetInfo: getTweetInfo,
    findActionBar: findActionBar,
    findAction: findAction,
    createNostrAction: createNostrAction,
    hydrateNostrAction: hydrateNostrAction,
    updateActionTheme: updateActionTheme,
    insertAfterNativeLike: insertAfterNativeLike,
    applyDirectoryIdentity: applyDirectoryIdentity
  };
})();
