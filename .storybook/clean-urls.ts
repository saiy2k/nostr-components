/**
 * Clean Storybook URLs: /?path=/story/zap-button-styling--ocean-glass
 *                     → /zap-button/styling/ocean-glass
 */
import { addons, type API } from 'storybook/manager-api';
import {
  CURRENT_STORY_WAS_SET,
  SET_INDEX,
  STORY_INDEX_INVALIDATED,
} from 'storybook/internal/core-events';
import type { API_IndexHash } from 'storybook/internal/types';

export type ViewMode = 'docs' | 'story';
export type SbPath = { viewMode: ViewMode; storyId: string };
export type Entry = { id: string; title: string; name: string; type: string };

const ROOT = new Set(['nostr-components', 'introduction']);
const STATIC_RE =
  /^\/(sb-|assets\/|images\/|themes|dist\/|iframe|index\.|vite-inject|@|node_modules\/|nostr-components|favicon|project\.json|nunito-sans)/;

export const sanitize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ ’–—―′¿'`‘“”"″′‘’']/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^\w-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/(^-|-$)/g, '');

export const isStaticPath = (pathname: string) => {
  if (!pathname || pathname === '/') return false;
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return STATIC_RE.test(p) || (p.split('/').pop() ?? '').includes('.');
};

const titleSegs = (title: string) =>
  title.split('/').map(t => sanitize(t.trim())).filter(Boolean);

export const entryToCleanPath = (e: Entry) => {
  const segs = titleSegs(e.title);
  const titlePath = segs.join('/');
  if (e.type === 'docs' || e.id.endsWith('--docs')) {
    return !segs.length || ROOT.has(titlePath) ? '/' : `/${titlePath}`;
  }
  const slug = e.id.includes('--') ? e.id.slice(e.id.indexOf('--') + 2) : sanitize(e.name);
  return `/${titlePath}/${slug}`;
};

export const parseStorybookPath = (q?: string | null): SbPath | null => {
  const m = (q?.startsWith('/') ? q : `/${q ?? ''}`).match(/^\/(docs|story)\/(.+)$/);
  return m ? { viewMode: m[1] as ViewMode, storyId: m[2] } : null;
};

/** Heuristic used before index.json is available. */
export const cleanPathToStorybookPath = (pathname: string): SbPath | null => {
  if (!pathname || pathname === '/' || isStaticPath(pathname)) return null;
  const segs = pathname.split('/').filter(Boolean).map(sanitize).filter(Boolean);
  if (!segs.length) return null;
  if (segs.length === 1) return { viewMode: 'docs', storyId: `${segs[0]}--docs` };
  return {
    viewMode: 'story',
    storyId: `${segs.slice(0, -1).join('-')}--${segs[segs.length - 1]}`,
  };
};

export const buildCleanPathMaps = (entries: Iterable<Entry>) => {
  const idToClean = new Map<string, string>();
  const cleanToSb = new Map<string, SbPath>();
  for (const e of entries) {
    if (e.type !== 'docs' && e.type !== 'story') continue;
    const clean = entryToCleanPath(e);
    idToClean.set(e.id, clean);
    if (!cleanToSb.has(clean)) {
      cleanToSb.set(clean, { viewMode: e.type as ViewMode, storyId: e.id });
    }
  }
  const intro = [...entries].find(
    e => e.type === 'docs' && ROOT.has(titleSegs(e.title).join('/'))
  );
  if (intro) {
    idToClean.set(intro.id, '/');
    cleanToSb.set('/', { viewMode: 'docs', storyId: intro.id });
    cleanToSb.set(`/${titleSegs(intro.title).join('/')}`, {
      viewMode: 'docs',
      storyId: intro.id,
    });
  }
  return { idToClean, cleanToSb };
};

export const resolveCleanPath = (
  pathname: string,
  cleanToSb?: Map<string, SbPath>
) => {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return cleanToSb?.get(p) ?? cleanPathToStorybookPath(p);
};

export const storybookPathToCleanPath = (
  pathQuery: string,
  idToClean?: Map<string, string>
) => {
  const parsed = parseStorybookPath(pathQuery);
  if (!parsed) return null;
  if (idToClean?.has(parsed.storyId)) return idToClean.get(parsed.storyId)!;
  if (parsed.viewMode === 'docs' || parsed.storyId.endsWith('--docs')) {
    const id = parsed.storyId.replace(/--docs$/, '');
    return ROOT.has(id) ? '/' : `/${id}`;
  }
  const i = parsed.storyId.indexOf('--');
  return i === -1
    ? `/${parsed.storyId}`
    : `/${parsed.storyId.slice(0, i)}/${parsed.storyId.slice(i + 2)}`;
};

const search = (params: URLSearchParams, path?: string) => {
  const parts = path ? [`path=${path}`] : [];
  params.forEach((v, k) => {
    if (k === 'path') return;
    parts.push(k === 'args' || k === 'globals' ? `${k}=${v}` : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
};

export const rewriteUrlToClean = (url: string | URL, idToClean?: Map<string, string>) => {
  const u = typeof url === 'string' ? new URL(url, 'http://sb.local') : url;
  const q = u.searchParams.get('path');
  if (!q) return null;
  const clean = storybookPathToCleanPath(q, idToClean);
  if (clean == null) return null;
  u.searchParams.delete('path');
  return `${clean}${search(u.searchParams)}${u.hash}`;
};

export const rewriteUrlToStorybook = (
  url: string | URL,
  cleanToSb?: Map<string, SbPath>
) => {
  const u = typeof url === 'string' ? new URL(url, 'http://sb.local') : url;
  if (u.searchParams.has('path') || isStaticPath(u.pathname)) return null;
  const r = resolveCleanPath(u.pathname, cleanToSb);
  if (!r) return null;
  return `/${search(u.searchParams, `/${r.viewMode}/${r.storyId}`)}${u.hash}`;
};

// --- manager sync ---

let idToClean = new Map<string, string>();
let cleanToSb = new Map<string, SbPath>();
let syncing = false;
let rawPush: History['pushState'];
let rawReplace: History['replaceState'];

const applyMaps = (entries: Entry[]) => {
  if (!entries.length) return;
  ({ idToClean, cleanToSb } = buildCleanPathMaps(entries));
};

const leafEntries = (index?: API_IndexHash): Entry[] =>
  !index
    ? []
    : Object.values(index)
        .filter(e => (e.type === 'docs' || e.type === 'story') && 'title' in e)
        .map(e => ({
          id: e.id,
          title: String((e as { title: string }).title),
          name: e.name,
          type: e.type,
        }));

const polish = () => {
  if (syncing || idToClean.size === 0 || !location.search.includes('path=')) return;
  const next = rewriteUrlToClean(location.href, idToClean);
  if (!next || next === `${location.pathname}${location.search}${location.hash}`) return;
  syncing = true;
  try {
    rawReplace.call(history, history.state, '', next);
  } finally {
    syncing = false;
  }
};

const selectClean = (api: API) => {
  if (location.search.includes('path=') || isStaticPath(location.pathname)) return;
  if (location.pathname === '/' || !location.pathname) return;
  const r = resolveCleanPath(location.pathname, cleanToSb);
  if (!r) return;
  const s = api.getState?.() as { storyId?: string; viewMode?: string } | undefined;
  if (s?.storyId === r.storyId && s?.viewMode === r.viewMode) return;
  syncing = true;
  try {
    api.selectStory(r.storyId, undefined, { viewMode: r.viewMode });
  } catch {
    /* index still hydrating */
  } finally {
    requestAnimationFrame(() => {
      syncing = false;
      polish();
    });
  }
};

const patchHistory = () => {
  rawPush = history.pushState.bind(history);
  rawReplace = history.replaceState.bind(history);
  const wrap =
    (orig: History['pushState']): History['pushState'] =>
    (state, title, url) => {
      if (syncing || url == null || idToClean.size === 0) return orig(state, title, url as string);
      return orig(state, title, rewriteUrlToClean(String(url), idToClean) ?? url);
    };
  history.pushState = wrap(rawPush);
  history.replaceState = wrap(rawReplace);
};

export function initCleanUrls() {
  patchHistory();
  addons.register('nostr-components/clean-urls', api => {
    const refresh = () => {
      applyMaps(leafEntries((api.getState?.() as { index?: API_IndexHash })?.index));
      polish();
    };
    api.on(SET_INDEX, refresh);
    api.on(STORY_INDEX_INVALIDATED, refresh);
    api.on(CURRENT_STORY_WAS_SET, () => {
      refresh();
      requestAnimationFrame(polish);
    });
    addEventListener('popstate', () => {
      if (syncing) return;
      location.search.includes('path=') ? polish() : selectClean(api);
    });
    fetch('/index.json')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.entries) return;
        applyMaps(
          Object.values(data.entries as Record<string, Entry>).filter(
            e => e.type === 'docs' || e.type === 'story'
          )
        );
        polish();
        selectClean(api);
      })
      .catch(() => {});
    refresh();
    selectClean(api);
    const t = setInterval(() => {
      refresh();
      if (idToClean.size) {
        selectClean(api);
        clearInterval(t);
      }
    }, 100);
    setTimeout(() => clearInterval(t), 8000);
  });
}
