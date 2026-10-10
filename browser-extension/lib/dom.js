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

  function linkHasTime(link) {
    return typeof link.querySelector === 'function' &&
      Boolean(link.querySelector('time'));
  }

  function getTweetInfo(article) {
    const parsedLinks = [];
    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
    for (const link of links) {
      const parsed = extension.url.parseTweetUrl(link.getAttribute('href'));
      if (!parsed) continue;
      parsedLinks.push({
        info: parsed,
        depth: nestingDepth(link, article),
        hasTime: linkHasTime(link)
      });
    }
    if (parsedLinks.length === 0) {
      return null;
    }

    let shallowestDepth = Number.POSITIVE_INFINITY;
    for (const entry of parsedLinks) {
      if (entry.depth < shallowestDepth) shallowestDepth = entry.depth;
    }

    const page = extension.url.parseTweetUrl(
      typeof window !== 'undefined' ? window.location.href : ''
    );
    // The address bar is the post the reader opened. A timestamp earlier in
    // the article can belong to a quote, and /i/status or twitter.com links
    // are a different zap target than https://x.com/{handle}/status/{id}.
    if (page) {
      const pageIsThisPost = parsedLinks.some(function (entry) {
        return entry.info.statusId === page.statusId &&
          entry.depth === shallowestDepth;
      });
      if (pageIsThisPost) {
        if (page.username !== 'i') return page;
        const named = parsedLinks.find(function (entry) {
          return entry.info.statusId === page.statusId &&
            entry.info.username !== 'i' &&
            entry.depth === shallowestDepth;
        });
        return named ? named.info : page;
      }
    }

    const timeLinks = parsedLinks.filter(function (entry) {
      return entry.hasTime;
    });
    const candidates = timeLinks.length > 0 ? timeLinks : parsedLinks;
    candidates.sort(function (left, right) {
      return left.depth - right.depth;
    });
    return candidates[0].info;
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

  function createNostrAction(tweetInfo, theme, recipientNpub) {
    const slot = document.createElement('div');
    slot.className = 'nostr-competency-action-slot';
    slot.setAttribute('data-nostr-competency-like', 'true');
    slot.setAttribute('data-status-id', tweetInfo.statusId);
    slot.setAttribute('data-author-handle', tweetInfo.username);
    slot.setAttribute('data-directory-status', 'loading');
    slot.setAttribute('data-status-url', tweetInfo.canonicalUrl);
    slot.setAttribute('data-theme', theme);
    const recipient = extension.url.isValidNpub(recipientNpub) ? recipientNpub : null;
    if (recipient) {
      slot.setAttribute('data-zap-recipient-npub', recipient);
      slot.setAttribute('data-directory-status', 'verified');
    }
    extension.componentLoader?.registerAction?.(slot, {
      kind: 'x',
      url: tweetInfo.canonicalUrl,
      theme: theme,
      recipientNpub: recipient
    });
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
    if (existing) {
      pinActionOrder(slot);
      return existing;
    }
    const component = document.createElement('nostr-like-button');
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    slot.appendChild(component);
    syncZapComponent(slot);
    pinActionOrder(slot);
    return component;
  }

  function placeActionControl(slot, child, previous) {
    if (!child || typeof slot.insertBefore !== 'function') return;
    const children = slot.children;
    if (!children) return;
    const currentIndex = Array.prototype.indexOf.call(children, child);
    const desiredIndex = previous
      ? Array.prototype.indexOf.call(children, previous) + 1
      : 0;
    if (currentIndex === desiredIndex) return;
    const reference = desiredIndex < children.length ? children[desiredIndex] : null;
    if (reference === child) return;
    slot.insertBefore(child, reference);
  }

  function pinActionOrder(slot) {
    const like = slot.querySelector('nostr-like-button');
    const zap = slot.querySelector('nostr-zap-button');
    placeActionControl(slot, like, null);
    if (zap) placeActionControl(slot, zap, like);
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
      placeActionControl(slot, slot.querySelector('nostr-like-button'), null);
      return null;
    }
    const shouldAppend = !component;
    if (!component) component = document.createElement('nostr-zap-button');
    component.setAttribute('npub', npub);
    component.setAttribute('url', slot.dataset.statusUrl);
    component.setAttribute('compact', '');
    component.setAttribute('data-theme', slot.dataset.theme || 'light');
    if (shouldAppend) slot.appendChild(component);
    pinActionOrder(slot);
    return component;
  }

  const directoryLookupEpochs = new WeakMap();

  function beginDirectoryLookup(slot) {
    const epoch = (directoryLookupEpochs.get(slot) || 0) + 1;
    directoryLookupEpochs.set(slot, epoch);
    return epoch;
  }

  function isCurrentDirectoryLookup(slot, epoch) {
    return directoryLookupEpochs.get(slot) === epoch;
  }

  function retargetAction(slot, tweetInfo) {
    const urlChanged = slot.dataset.statusUrl !== tweetInfo.canonicalUrl;
    const handleChanged = slot.dataset.authorHandle !== tweetInfo.username;
    if (!urlChanged && !handleChanged) return false;
    slot.setAttribute('data-status-id', tweetInfo.statusId);
    slot.setAttribute('data-author-handle', tweetInfo.username);
    slot.setAttribute('data-status-url', tweetInfo.canonicalUrl);
    if (handleChanged) {
      slot.setAttribute('data-directory-status', 'loading');
      delete slot.dataset.zapRecipientNpub;
    }
    extension.componentLoader?.updateAction?.(slot, {
      url: tweetInfo.canonicalUrl,
      ...(handleChanged ? { recipientNpub: null } : {})
    });
    if (typeof slot.querySelector === 'function' && slot.querySelector('nostr-like-button')) {
      hydrateNostrAction(slot);
    }
    return handleChanged;
  }

  function updateActionTheme(slot, theme) {
    slot.dataset.theme = theme;
    extension.componentLoader?.updateAction?.(slot, { theme: theme });
    const component = slot.querySelector('nostr-like-button');
    if (component && component.getAttribute('data-theme') !== theme) {
      component.setAttribute('data-theme', theme);
    }
    const zapComponent = slot.querySelector('nostr-zap-button');
    if (zapComponent && zapComponent.getAttribute('data-theme') !== theme) {
      zapComponent.setAttribute('data-theme', theme);
    }
    const invite = slot.querySelector('button.nostr-zap-invite');
    if (invite && invite.getAttribute('data-theme') !== theme) {
      invite.setAttribute('data-theme', theme);
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

  function syncZapInvite(slot, identity) {
    if (typeof extension.zapInvite?.syncButton !== 'function') return;
    extension.zapInvite.syncButton(slot, extension.zapInvite.classify(identity));
  }

  function applyDirectoryIdentity(slot, identity) {
    if (!identity) {
      slot.dataset.directoryStatus = 'invalid';
      delete slot.dataset.zapRecipientNpub;
      extension.componentLoader?.updateAction?.(slot, {
        recipientNpub: null
      });
      if (slot.querySelector('nostr-like-button')) syncZapComponent(slot);
      syncZapInvite(slot, null);
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
      extension.componentLoader?.updateAction?.(slot, {
        recipientNpub: activeIdentity.npub
      });
    } else {
      delete slot.dataset.zapRecipientNpub;
      extension.componentLoader?.updateAction?.(slot, {
        recipientNpub: null
      });
    }
    if (slot.querySelector('nostr-like-button')) syncZapComponent(slot);
    syncZapInvite(slot, identity);
  }

  extension.dom = {
    getTweetInfo: getTweetInfo,
    findActionBar: findActionBar,
    findAction: findAction,
    createNostrAction: createNostrAction,
    hydrateNostrAction: hydrateNostrAction,
    updateActionTheme: updateActionTheme,
    retargetAction: retargetAction,
    beginDirectoryLookup: beginDirectoryLookup,
    isCurrentDirectoryLookup: isCurrentDirectoryLookup,
    insertAfterNativeLike: insertAfterNativeLike,
    applyDirectoryIdentity: applyDirectoryIdentity
  };
})();
