/**
 * Sync browser URL pathname with Storybook's internal ?path= routing.
 *
 * Approach:
 * 1. manager-head.html rewrites clean paths → ?path= before boot
 * 2. This module patches history so Storybook navigations become clean paths
 * 3. On popstate / deep links, selectStory keeps Storybook in sync
 */
import { addons } from 'storybook/manager-api';
import {
  CURRENT_STORY_WAS_SET,
  SET_INDEX,
  STORY_INDEX_INVALIDATED,
} from 'storybook/internal/core-events';
import type { API } from 'storybook/manager-api';
import type { API_HashEntry, API_IndexHash } from 'storybook/internal/types';
import {
  buildCleanPathMaps,
  isStaticPath,
  resolveCleanPath,
  rewriteUrlToClean,
  type LeafEntryLike,
  type StorybookPath,
} from './clean-urls';

let idToClean = new Map<string, string>();
let cleanToStorybook = new Map<string, StorybookPath>();
let syncing = false;
let originalPush: History['pushState'];
let originalReplace: History['replaceState'];

function leafEntriesFromIndex(index: API_IndexHash | undefined): LeafEntryLike[] {
  if (!index) return [];
  return Object.values(index)
    .filter((entry): entry is API_HashEntry & { title: string } => {
      return (
        (entry.type === 'docs' || entry.type === 'story') &&
        'title' in entry &&
        typeof (entry as { title?: unknown }).title === 'string'
      );
    })
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      type: entry.type,
    }));
}

function updateMaps(api: API): void {
  const state = api.getState?.() as { index?: API_IndexHash } | undefined;
  const entries = leafEntriesFromIndex(state?.index);
  if (entries.length === 0) return;
  const maps = buildCleanPathMaps(entries);
  idToClean = maps.idToClean;
  cleanToStorybook = maps.cleanToStorybook;
}

function polishToCleanUrl(): void {
  if (syncing) return;
  if (!window.location.search.includes('path=')) return;
  // Wait for the story index so nested titles become /zap-button/styling/...
  if (idToClean.size === 0) return;

  const rewritten = rewriteUrlToClean(window.location.href, idToClean);
  if (!rewritten) return;

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === rewritten) return;

  syncing = true;
  try {
    originalReplace.call(window.history, window.history.state, '', rewritten);
  } finally {
    syncing = false;
  }
}

function selectFromCleanPath(api: API): boolean {
  if (window.location.search.includes('path=')) return false;
  if (isStaticPath(window.location.pathname)) return false;

  const pathname = window.location.pathname;
  if (pathname === '/' || pathname === '') return false;

  const resolved = resolveCleanPath(pathname, cleanToStorybook);
  if (!resolved) return false;

  const state = api.getState?.() as
    | { storyId?: string; viewMode?: string }
    | undefined;
  if (
    state?.storyId === resolved.storyId &&
    state?.viewMode === resolved.viewMode
  ) {
    return true;
  }

  syncing = true;
  try {
    api.selectStory(resolved.storyId, undefined, {
      viewMode: resolved.viewMode,
    });
  } catch {
    // Ignore transient misses while the index is still hydrating.
  } finally {
    requestAnimationFrame(() => {
      syncing = false;
      polishToCleanUrl();
    });
  }
  return true;
}

function patchHistory(): void {
  originalPush = window.history.pushState.bind(window.history);
  originalReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = (state, title, url) => {
    if (syncing || url == null || idToClean.size === 0) {
      return originalPush(state, title, url as string | URL | null | undefined);
    }
    const rewritten = rewriteUrlToClean(String(url), idToClean);
    return originalPush(state, title, rewritten ?? url);
  };

  window.history.replaceState = (state, title, url) => {
    if (syncing || url == null || idToClean.size === 0) {
      return originalReplace(
        state,
        title,
        url as string | URL | null | undefined
      );
    }
    const rewritten = rewriteUrlToClean(String(url), idToClean);
    return originalReplace(state, title, rewritten ?? url);
  };
}

/**
 * Also fetch index.json directly so maps work even if getState timing differs.
 */
async function hydrateMapsFromIndexJson(): Promise<void> {
  try {
    const res = await fetch('/index.json', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      entries?: Record<string, LeafEntryLike>;
    };
    const entries = Object.values(data.entries ?? {}).filter(
      e => e.type === 'docs' || e.type === 'story'
    );
    if (!entries.length) return;
    const maps = buildCleanPathMaps(entries);
    idToClean = maps.idToClean;
    cleanToStorybook = maps.cleanToStorybook;
  } catch {
    // ignore — API state remains the primary source
  }
}

export function initCleanUrls(): void {
  patchHistory();

  addons.register('nostr-components/clean-urls', api => {
    const refreshMaps = () => {
      updateMaps(api);
      polishToCleanUrl();
    };

    api.on(SET_INDEX, refreshMaps);
    api.on(STORY_INDEX_INVALIDATED, refreshMaps);
    api.on(CURRENT_STORY_WAS_SET, () => {
      updateMaps(api);
      requestAnimationFrame(() => polishToCleanUrl());
    });

    window.addEventListener('popstate', () => {
      if (syncing) return;
      if (window.location.search.includes('path=')) {
        polishToCleanUrl();
        return;
      }
      selectFromCleanPath(api);
    });

    void hydrateMapsFromIndexJson().then(() => {
      polishToCleanUrl();
      selectFromCleanPath(api);
    });

    refreshMaps();
    selectFromCleanPath(api);

    const interval = window.setInterval(() => {
      updateMaps(api);
      if (idToClean.size > 0) {
        polishToCleanUrl();
        selectFromCleanPath(api);
        window.clearInterval(interval);
      }
    }, 100);
    window.setTimeout(() => window.clearInterval(interval), 8000);
  });
}
