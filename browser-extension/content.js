// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension;
  const INJECT_DELAY_MS = 120;
  let injectionScheduled = false;
  const hydrationObserver =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(
          function (entries) {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              extension.dom.hydrateNostrAction(entry.target);
              hydrationObserver.unobserve(entry.target);
            }
          },
          { rootMargin: "600px 0px" },
        )
      : null;

  if (!extension || !extension.componentLoader) {
    throw new Error("Nostr Like extension modules were not loaded");
  }

  /** Report non-interactive failures without interrupting timeline rendering. */
  function reportBackgroundError(context, error) {
    console.warn("[Nostr Like] " + context, error);
  }

  /** Read X's active color scheme for the component's theme attribute. */
  function getPageTheme() {
    try {
      const scheme = window.getComputedStyle(
        document.documentElement,
      ).colorScheme;
      return String(scheme).includes("dark") ? "dark" : "light";
    } catch (_error) {
      return "light";
    }
  }

  /** Resolve Firestore author metadata without gating the Like component. */
  async function loadDirectoryIdentity(slot, handle) {
    try {
      const identity = await extension.directory.lookup(handle);
      extension.dom.applyDirectoryIdentity(slot, identity);
    } catch (error) {
      extension.dom.applyDirectoryIdentity(slot, null);
      reportBackgroundError("Directory lookup failed", error);
    }
  }

  /** Inject the repository's Nostr Like component into one rendered post. */
  function injectIntoArticle(article) {
    const tweetInfo = extension.dom.getTweetInfo(article);
    if (!tweetInfo) {
      return;
    }

    const actionBar = extension.dom.findActionBar(article);
    if (!actionBar) {
      return;
    }

    const theme = getPageTheme();
    const existingAction = extension.dom.findAction(
      actionBar,
      tweetInfo.statusId,
    );
    if (existingAction) {
      extension.dom.updateActionTheme(existingAction, theme);
      return;
    }

    const action = extension.dom.createNostrAction(tweetInfo, theme);
    extension.dom.insertAfterNativeLike(actionBar, action.slot);
    if (hydrationObserver) {
      hydrationObserver.observe(action.slot);
    } else {
      extension.dom.hydrateNostrAction(action.slot);
    }
    void loadDirectoryIdentity(action.slot, tweetInfo.username);
  }

  /** Process original posts, reposts, and quoted statuses currently in the DOM. */
  function processTweets() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(function (article) {
      try {
        injectIntoArticle(article);
      } catch (error) {
        reportBackgroundError("Could not inject a timeline action", error);
      }
    });
  }

  /** Bound DOM-driven scans even while X mutates the timeline continuously. */
  function scheduleInjection() {
    if (injectionScheduled) return;
    injectionScheduled = true;
    window.setTimeout(function () {
      injectionScheduled = false;
      processTweets();
    }, INJECT_DELAY_MS);
  }

  const timelineObserver = new MutationObserver(scheduleInjection);
  const themeObserver = new MutationObserver(scheduleInjection);

  /** Observe X only after the manifest-loaded component has been registered. */
  function start() {
    if (!document.body) {
      window.requestAnimationFrame(function () {
        start();
      });
      return;
    }

    timelineObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    scheduleInjection();
  }

  void extension.componentLoader.ready.then(
    function () {
      start();
      window.addEventListener("load", scheduleInjection);
      window.addEventListener("popstate", scheduleInjection);
    },
    function (error) {
      reportBackgroundError("Like component injection failed", error);
    },
  );
})();
