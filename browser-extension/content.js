// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension;
  const INJECT_DELAY_MS = 120;
  let injectionScheduled = false;
  const hydrationObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(function (entries) {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target.dataset.nostrYoutubeAction === 'true') {
            extension.youtubeDom.hydrateNostrAction(entry.target);
          } else {
            extension.dom.hydrateNostrAction(entry.target);
          }
          hydrationObserver.unobserve(entry.target);
        }
      }, { rootMargin: '600px 0px' })
    : null;

  if (!extension || !extension.componentLoader) {
    throw new Error('Nostr Like extension modules were not loaded');
  }

  function reportBackgroundError(context, error) {
    console.warn('[Nostr Like] ' + context, error);
  }

  function getPageTheme() {
    try {
      const scheme = window.getComputedStyle(document.documentElement).colorScheme;
      return String(scheme).includes('dark') ? 'dark' : 'light';
    } catch (_error) {
      return 'light';
    }
  }

  async function loadDirectoryIdentity(slot, handle) {
    try {
      const identity = await extension.directory.lookup(handle);
      extension.dom.applyDirectoryIdentity(slot, identity);
    } catch (error) {
      extension.dom.applyDirectoryIdentity(slot, null);
      reportBackgroundError('Directory lookup failed', error);
    }
  }

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
    const existingAction = extension.dom.findAction(actionBar, tweetInfo.statusId);
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

  function queryTweetArticles() {
    const tagged = document.querySelectorAll('article[data-testid="tweet"]');
    return tagged.length ? tagged : document.querySelectorAll('article');
  }

  function processTweets() {
    const articles = queryTweetArticles();
    articles.forEach(function (article) {
      try {
        injectIntoArticle(article);
      } catch (error) {
        reportBackgroundError('Could not inject a timeline action', error);
      }
    });
  }

  function processYouTubeVideo() {
    const videoInfo = extension.youtubeDom.getVideoInfo();
    if (!videoInfo) return;
    const actionBar = extension.youtubeDom.findActionBar(document);
    if (!actionBar) return;

    extension.youtubeDom.removeStaleActions(actionBar, videoInfo.videoId);
    const theme = getPageTheme();
    const recipientNpub = extension.youtubeDom.extractDeclaredNpub(document);
    const existingAction = extension.youtubeDom.findAction(actionBar, videoInfo.videoId);
    if (existingAction) {
      extension.youtubeDom.updateActionTheme(existingAction, theme);
      extension.youtubeDom.updateRecipient(existingAction, recipientNpub);
      return;
    }

    const action = extension.youtubeDom.createNostrAction(
      videoInfo,
      theme,
      recipientNpub
    );
    extension.youtubeDom.insertAfterNativeLike(actionBar, action.slot);
    if (hydrationObserver) hydrationObserver.observe(action.slot);
    else extension.youtubeDom.hydrateNostrAction(action.slot);
  }

  function processCurrentPage() {
    if (/(^|\.)youtube\.com$/.test(window.location.hostname)) {
      processYouTubeVideo();
    } else {
      processTweets();
    }
  }

  function scheduleInjection() {
    if (injectionScheduled) return;
    injectionScheduled = true;
    window.setTimeout(function () {
      injectionScheduled = false;
      processCurrentPage();
    }, INJECT_DELAY_MS);
  }

  const timelineObserver = new MutationObserver(scheduleInjection);
  const themeObserver = new MutationObserver(scheduleInjection);

  function start() {
    if (!document.body) {
      window.requestAnimationFrame(function () {
        start();
      });
      return;
    }

    timelineObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    scheduleInjection();
  }

  void extension.componentLoader.ready.then(
    function () {
      start();
      window.addEventListener('load', scheduleInjection);
      window.addEventListener('popstate', scheduleInjection);
    },
    function (error) {
      reportBackgroundError('Like component injection failed', error);
    }
  );
})();
