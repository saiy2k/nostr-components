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
    return article.querySelector('div[role="group"]');
  }

  /** Check whether the current status already has an injected Like action. */
  function hasAction(actionBar, statusId) {
    return !!actionBar.querySelector(
      '[data-nostr-competency-like="true"][data-status-id="' + statusId + '"]',
    );
  }

  /** Render count, accessibility, busy, and liked state on the action button. */
  function renderButtonState(button, state) {
    const count = button.querySelector(".nostr-competency-action-count");
    button.dataset.liked = state.liked ? "true" : "false";
    button.dataset.busy = state.busy ? "true" : "false";
    button.disabled = state.busy;
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.setAttribute(
      "aria-label",
      (state.liked
        ? "Unlike this post with Nostr"
        : "Like this post with Nostr") +
        ". " +
        state.likeCount +
        " Nostr likes.",
    );
    button.setAttribute(
      "title",
      state.busy
        ? "Sending Nostr reaction..."
        : state.liked
          ? "Liked with Nostr"
          : "Like with Nostr",
    );
    if (count) {
      count.textContent = String(state.likeCount);
    }
  }

  /** Build the native-looking Nostr Like action and count display. */
  function createNostrAction(tweetInfo, onClick) {
    const slot = document.createElement("div");
    slot.className = "nostr-competency-action-slot";
    slot.setAttribute("data-nostr-competency-like", "true");
    slot.setAttribute("data-status-id", tweetInfo.statusId);
    slot.setAttribute("data-author-handle", tweetInfo.username);
    slot.setAttribute("data-directory-status", "loading");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nostr-competency-action-button";

    const iconWrap = document.createElement("span");
    iconWrap.className = "nostr-competency-action-icon-wrap";

    const icon = document.createElement("span");
    icon.className = "nostr-competency-action-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" class="nostr-competency-action-svg">' +
      '<path d="M7.5 10.75H4.75v8.5H7.5m0-8.5 3.48-6.31a1.52 1.52 0 0 1 2.84.94l-.36 3.12h3.8c1.2 0 2.08 1.13 1.79 2.3l-1.46 5.94a2.25 2.25 0 0 1-2.18 1.71H7.5"></path>' +
      "</svg>";

    const count = document.createElement("span");
    count.className = "nostr-competency-action-count";
    count.setAttribute("aria-hidden", "true");
    count.textContent = "0";

    iconWrap.appendChild(icon);
    button.appendChild(iconWrap);
    button.appendChild(count);
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      onClick(button);
    });
    slot.appendChild(button);

    return { slot: slot, button: button };
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
    hasAction: hasAction,
    renderButtonState: renderButtonState,
    createNostrAction: createNostrAction,
    insertAfterNativeLike: insertAfterNativeLike,
    applyDirectoryIdentity: applyDirectoryIdentity,
  };
})();
