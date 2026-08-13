// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});

  /** Extract the primary status URL represented by an X tweet article. */
  function getTweetInfo(article) {
    const timeLink = article.querySelector('a[href*="/status/"] time');
    if (timeLink && timeLink.closest("a")) {
      const parsedTimeLink = extension.url.parseTweetUrl(
        timeLink.closest("a").getAttribute("href"),
      );
      if (parsedTimeLink) {
        return parsedTimeLink;
      }
    }

    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
    for (const link of links) {
      const parsed = extension.url.parseTweetUrl(link.getAttribute("href"));
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  /** Locate X's native action group for a tweet. */
  function findActionBar(article) {
    const nativeLike = article.querySelector(
      '[data-testid="like"], [data-testid="unlike"]',
    );
    return nativeLike ? nativeLike.closest('div[role="group"]') : null;
  }

  /** Return the injected action for a status, if X has already rendered it. */
  function findAction(actionBar, statusId) {
    return actionBar.querySelector(
      '[data-nostr-competency-like="true"][data-status-id="' + statusId + '"]',
    );
  }

  /** Build a lightweight X-row host; hydrate the component near the viewport. */
  function createNostrAction(tweetInfo, theme) {
    const slot = document.createElement("div");
    slot.className = "nostr-competency-action-slot";
    slot.setAttribute("data-nostr-competency-like", "true");
    slot.setAttribute("data-status-id", tweetInfo.statusId);
    slot.setAttribute("data-author-handle", tweetInfo.username);
    slot.setAttribute("data-directory-status", "loading");
    slot.setAttribute("data-status-url", tweetInfo.canonicalUrl);
    slot.setAttribute("data-theme", theme);
    // X treats unhandled clicks inside a tweet as navigation. Contain clicks
    // across the full action slot, including loading and re-render gaps.
    slot.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });

    return { slot: slot, component: null };
  }

  /** Instantiate the real component once a timeline action approaches view. */
  function hydrateNostrAction(slot) {
    const existing = slot.querySelector("nostr-like-button");
    if (existing) return existing;
    const component = document.createElement("nostr-like-button");
    component.setAttribute("url", slot.dataset.statusUrl);
    component.setAttribute("compact", "");
    component.setAttribute("data-theme", slot.dataset.theme || "light");
    slot.appendChild(component);
    return component;
  }

  /** Keep injected components in sync with X's live color-scheme switch. */
  function updateActionTheme(slot, theme) {
    slot.dataset.theme = theme;
    const component = slot.querySelector("nostr-like-button");
    if (component && component.getAttribute("data-theme") !== theme) {
      component.setAttribute("data-theme", theme);
    }
  }

  /** Find the action-bar child that owns a nested native control. */
  function directChildContaining(actionBar, descendant) {
    let current = descendant;
    while (current && current.parentElement !== actionBar) {
      current = current.parentElement;
    }
    return current && current.parentElement === actionBar ? current : null;
  }

  /** Insert directly after X's Like control and before the following action. */
  function insertAfterNativeLike(actionBar, slot) {
    const nativeLike = actionBar.querySelector(
      '[data-testid="like"], [data-testid="unlike"]',
    );
    const likeContainer = nativeLike
      ? directChildContaining(actionBar, nativeLike)
      : null;
    if (likeContainer) {
      actionBar.insertBefore(slot, likeContainer.nextSibling);
      return;
    }
    actionBar.appendChild(slot);
  }

  /** Attach sanitized Firestore identity metadata for future author actions. */
  function applyDirectoryIdentity(slot, identity) {
    if (!identity) {
      slot.dataset.directoryStatus = "invalid";
      return;
    }
    slot.dataset.directoryStatus = identity.verified
      ? "verified"
      : identity.found
        ? "candidate"
        : "not-found";
    slot.dataset.directorySource = identity.source || "unknown";
    if (identity.activeIdentity && identity.activeIdentity.npub) {
      slot.dataset.authorNpub = identity.activeIdentity.npub;
    }
  }

  extension.dom = {
    getTweetInfo: getTweetInfo,
    findActionBar: findActionBar,
    findAction: findAction,
    createNostrAction: createNostrAction,
    hydrateNostrAction: hydrateNostrAction,
    updateActionTheme: updateActionTheme,
    insertAfterNativeLike: insertAfterNativeLike,
    applyDirectoryIdentity: applyDirectoryIdentity,
  };
})();
