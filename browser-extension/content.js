// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension;
  const INJECT_DELAY_MS = 120;
  let injectTimer = null;

  if (!extension) {
    throw new Error("Nostr Like extension modules were not loaded");
  }

  /** Create isolated UI and account state for one injected post action. */
  function createState(tweetInfo) {
    return {
      canonicalUrl: tweetInfo.canonicalUrl,
      statusId: tweetInfo.statusId,
      pubkey: null,
      liked: false,
      likeCount: 0,
      busy: false,
      initialized: false,
      initPromise: null,
      directoryIdentity: null,
    };
  }

  /** Refresh reaction count and liked state against the active NIP-07 account. */
  async function synchronizeReactionState(button, state, options) {
    const force = !!(options && options.force);
    const silent = !!(options && options.silent);

    if (state.initialized && !force) {
      return;
    }

    if (state.initPromise) {
      await state.initPromise;
      if (!force) {
        return;
      }
    }

    state.initPromise = (async function () {
      const storedPubkey = silent
        ? await extension.storage.getKnownPubkey()
        : null;

      if (storedPubkey) {
        const storedLiked = await extension.storage.getReactionState(
          state.canonicalUrl,
          storedPubkey,
        );
        if (storedLiked !== null) {
          state.pubkey = storedPubkey;
          state.liked = storedLiked;
          extension.dom.renderButtonState(button, state);
        }
      }

      const eventsPromise = extension.reactions.fetchEvents(
        state.canonicalUrl,
        { force: force },
      );
      let activePubkey = null;

      try {
        activePubkey = await extension.bridge.getCurrentUserPubkey();
        await extension.storage.setKnownPubkey(activePubkey);
      } catch (error) {
        if (!silent) {
          throw error;
        }
      }

      const events = await eventsPromise;
      const summary = extension.reactions.summarize(
        events,
        activePubkey || storedPubkey,
      );
      state.likeCount = summary.likeCount;

      if (activePubkey) {
        state.pubkey = activePubkey;
        state.liked = summary.isLiked;
        await extension.storage.setReactionState(
          state.canonicalUrl,
          activePubkey,
          state.liked,
        );
      }

      state.initialized = true;
      extension.dom.renderButtonState(button, state);
    })()
      .catch(function (error) {
        if (!silent) {
          throw error;
        }
      })
      .finally(function () {
        state.initPromise = null;
      });

    return state.initPromise;
  }

  /** Confirm, sign, publish, and persist a Like or Unlike interaction. */
  async function handleReactionClick(button, state, tweetInfo) {
    if (state.busy) {
      return;
    }

    state.busy = true;
    extension.dom.renderButtonState(button, state);

    try {
      await synchronizeReactionState(button, state, {
        force: true,
        silent: false,
      });

      if (state.liked) {
        const confirmed = window.confirm(
          "You have already liked this post with Nostr. Do you want to unlike it?",
        );
        if (!confirmed) {
          return;
        }
      }

      const nextLiked = !state.liked;
      const unsignedEvent = extension.reactions.createReactionEvent(
        tweetInfo.canonicalUrl,
        nextLiked ? "+" : "-",
      );
      const response = await extension.bridge.sendRequest("SIGN_EVENT", {
        event: unsignedEvent,
      });
      const signedEvent = response.signedEvent;

      if (!signedEvent || signedEvent.pubkey !== state.pubkey) {
        throw new Error(
          "The active NIP-07 account changed while signing; please try again",
        );
      }

      const publishResult = await extension.relayPool.publish(signedEvent);
      if (!publishResult.ok) {
        throw new Error("No relay acknowledged the reaction");
      }

      state.liked = nextLiked;
      state.likeCount = Math.max(0, state.likeCount + (nextLiked ? 1 : -1));
      state.initialized = true;
      extension.reactions.applyPublishedEvent(state.canonicalUrl, signedEvent);
      await extension.storage.setReactionState(
        state.canonicalUrl,
        state.pubkey,
        state.liked,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Nostr error";
      window.alert(
        "Nostr Like could not complete.\n\n" +
          message +
          "\n\nMake sure a NIP-07 extension such as Alby or nos2x is installed and unlocked.",
      );
    } finally {
      state.busy = false;
      extension.dom.renderButtonState(button, state);
    }
  }

  /** Resolve Firestore author metadata without gating the author-independent Like UI. */
  async function loadDirectoryIdentity(slot, state, handle) {
    const identity = await extension.directory.lookup(handle);
    state.directoryIdentity = identity;
    extension.dom.applyDirectoryIdentity(slot, identity);
  }

  /** Inject one Nostr Like action into a tweet when it is not already present. */
  async function injectIntoArticle(article) {
    const tweetInfo = extension.dom.getTweetInfo(article);
    if (!tweetInfo) {
      return;
    }

    const actionBar = extension.dom.findActionBar(article);
    if (!actionBar || extension.dom.hasAction(actionBar, tweetInfo.statusId)) {
      return;
    }

    const state = createState(tweetInfo);
    const action = extension.dom.createNostrAction(
      tweetInfo,
      function (button) {
        void handleReactionClick(button, state, tweetInfo);
      },
    );

    extension.dom.insertAfterNativeLike(actionBar, action.slot);
    extension.dom.renderButtonState(action.button, state);
    void synchronizeReactionState(action.button, state, { silent: true });
    void loadDirectoryIdentity(action.slot, state, tweetInfo.username);
  }

  /** Process all currently rendered X tweet articles. */
  function processTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(function (article) {
      void injectIntoArticle(article);
    });
  }

  /** Debounce DOM-driven injection scans. */
  function scheduleInjection() {
    window.clearTimeout(injectTimer);
    injectTimer = window.setTimeout(processTweets, INJECT_DELAY_MS);
  }

  const observer = new MutationObserver(scheduleInjection);

  /** Attach the SPA observer after the document body becomes available. */
  function startObserver() {
    if (!document.body) {
      window.requestAnimationFrame(startObserver);
      return;
    }

    observer.observe(document.body, { childList: true, subtree: true });
    scheduleInjection();
  }

  startObserver();
  window.addEventListener("load", scheduleInjection);
  window.addEventListener("popstate", scheduleInjection);
})();
