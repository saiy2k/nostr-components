/**
 * Clean path-based Storybook URLs.
 *
 * Maps Storybook query routes like:
 *   /?path=/docs/zap-button--docs
 *   /?path=/story/zap-button-styling--ocean-glass-theme
 * to:
 *   /zap-button
 *   /zap-button/styling/ocean-glass-theme
 */

/** Match Storybook's CSF sanitize for stable slug generation. */
export function sanitize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ ’–—―′¿'`‘“”"″′‘’]/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^\w-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export type StorybookViewMode = 'docs' | 'story';

export interface LeafEntryLike {
  id: string;
  title: string;
  name: string;
  type: 'docs' | 'story' | string;
}

export interface StorybookPath {
  viewMode: StorybookViewMode;
  storyId: string;
}

/** Title slugs that should resolve to the site root `/`. */
const ROOT_TITLE_SLUGS = new Set(['nostr-components', 'introduction']);

/** Path prefixes that are static assets / Storybook internals, not stories. */
const STATIC_PATH_PREFIXES = [
  '/sb-',
  '/assets/',
  '/images/',
  '/themes',
  '/dist/',
  '/iframe.html',
  '/iframe',
  '/index.json',
  '/index.html',
  '/vite-inject',
  '/@',
  '/node_modules/',
  '/nostr-components',
  '/favicon',
  '/project.json',
  '/nunito-sans',
];

/** First path segments that must never be treated as story titles. */
const STATIC_FIRST_SEGMENTS = new Set([
  'iframe',
  'iframe.html',
  'sb-addons',
  'sb-common-assets',
  'sb-manager',
  'assets',
  'images',
  'themes',
  'dist',
  'static',
  'vite-inject',
  'node_modules',
  'favicon.svg',
  'favicon-wrapper.svg',
  'project.json',
  'index.json',
  'index.html',
]);

export function isStaticPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (STATIC_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    return true;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length > 0 && STATIC_FIRST_SEGMENTS.has(segments[0])) {
    return true;
  }
  const lastSegment = segments[segments.length - 1] ?? '';
  return lastSegment.includes('.');
}

export function titleToPathSegments(title: string): string[] {
  return title
    .split('/')
    .map(part => sanitize(part.trim()))
    .filter(Boolean);
}

/**
 * Convert a leaf story/docs entry into a clean URL pathname.
 * Docs for the intro page map to `/`; other docs omit the story slug.
 */
export function entryToCleanPath(entry: LeafEntryLike): string {
  const segments = titleToPathSegments(entry.title);
  const titlePath = segments.join('/');
  const isDocs = entry.type === 'docs' || entry.id.endsWith('--docs');

  if (isDocs) {
    if (segments.length === 0 || ROOT_TITLE_SLUGS.has(titlePath)) {
      return '/';
    }
    return `/${titlePath}`;
  }

  const storySlug = entry.id.includes('--')
    ? entry.id.slice(entry.id.indexOf('--') + 2)
    : sanitize(entry.name);

  return `/${titlePath}/${storySlug}`;
}

/**
 * Parse Storybook's internal `path` query value (`/docs/id` or `/story/id`).
 */
export function parseStorybookPath(pathQuery: string | null | undefined): StorybookPath | null {
  if (!pathQuery) return null;
  const cleaned = pathQuery.startsWith('/') ? pathQuery : `/${pathQuery}`;
  const match = cleaned.match(/^\/(docs|story)\/(.+)$/);
  if (!match) return null;
  return {
    viewMode: match[1] as StorybookViewMode,
    storyId: match[2],
  };
}

export function toStorybookPathQuery(viewMode: StorybookViewMode, storyId: string): string {
  return `/${viewMode}/${storyId}`;
}

/**
 * Heuristic reverse mapping used before the story index is available.
 * `/zap-button` → docs `zap-button--docs`
 * `/zap-button/nip05` → story `zap-button--nip05`
 * `/zap-button/styling/ocean-glass-theme` → story `zap-button-styling--ocean-glass-theme`
 */
export function cleanPathToStorybookPath(pathname: string): StorybookPath | null {
  if (!pathname || pathname === '/' || isStaticPath(pathname)) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean).map(sanitize).filter(Boolean);
  if (segments.length === 0) return null;

  if (segments.length === 1) {
    const titleId = segments[0];
    if (ROOT_TITLE_SLUGS.has(titleId)) {
      return { viewMode: 'docs', storyId: `${titleId}--docs` };
    }
    return { viewMode: 'docs', storyId: `${titleId}--docs` };
  }

  const storySlug = segments[segments.length - 1];
  const titleId = segments.slice(0, -1).join('-');
  return {
    viewMode: 'story',
    storyId: `${titleId}--${storySlug}`,
  };
}

export function buildCleanPathMaps(entries: Iterable<LeafEntryLike>): {
  idToClean: Map<string, string>;
  cleanToStorybook: Map<string, StorybookPath>;
} {
  const idToClean = new Map<string, string>();
  const cleanToStorybook = new Map<string, StorybookPath>();

  for (const entry of entries) {
    if (entry.type !== 'docs' && entry.type !== 'story') continue;

    const clean = entryToCleanPath(entry);
    const viewMode: StorybookViewMode = entry.type === 'docs' ? 'docs' : 'story';
    idToClean.set(entry.id, clean);

    // First writer wins so component docs keep `/zap-button` over any collision.
    if (!cleanToStorybook.has(clean)) {
      cleanToStorybook.set(clean, { viewMode, storyId: entry.id });
    }
  }

  // Explicit root aliases for the intro docs page.
  const intro = [...entries].find(
    e =>
      e.type === 'docs' &&
      ROOT_TITLE_SLUGS.has(titleToPathSegments(e.title).join('/'))
  );
  if (intro) {
    idToClean.set(intro.id, '/');
    cleanToStorybook.set('/', { viewMode: 'docs', storyId: intro.id });
    cleanToStorybook.set(
      `/${titleToPathSegments(intro.title).join('/')}`,
      { viewMode: 'docs', storyId: intro.id }
    );
  }

  return { idToClean, cleanToStorybook };
}

/**
 * Resolve a clean pathname to a Storybook path using the index map when
 * available, otherwise the deterministic heuristic.
 */
export function resolveCleanPath(
  pathname: string,
  cleanToStorybook?: Map<string, StorybookPath>
): StorybookPath | null {
  const normalized =
    pathname !== '/' && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  if (cleanToStorybook?.has(normalized)) {
    return cleanToStorybook.get(normalized) ?? null;
  }

  return cleanPathToStorybookPath(normalized);
}

/**
 * Given a Storybook path query and optional id→clean map, return the clean pathname.
 */
export function storybookPathToCleanPath(
  pathQuery: string,
  idToClean?: Map<string, string>
): string | null {
  const parsed = parseStorybookPath(pathQuery);
  if (!parsed) return null;

  if (idToClean?.has(parsed.storyId)) {
    return idToClean.get(parsed.storyId) ?? null;
  }

  // Fallback without index: flatten title id, keep docs as single segment.
  if (parsed.viewMode === 'docs' || parsed.storyId.endsWith('--docs')) {
    const titleId = parsed.storyId.replace(/--docs$/, '');
    if (ROOT_TITLE_SLUGS.has(titleId)) return '/';
    return `/${titleId}`;
  }

  const separator = parsed.storyId.indexOf('--');
  if (separator === -1) return `/${parsed.storyId}`;
  const titleId = parsed.storyId.slice(0, separator);
  const storySlug = parsed.storyId.slice(separator + 2);
  // Without hierarchy info, keep a readable two-segment form.
  return `/${titleId}/${storySlug}`;
}

/**
 * Build a query string while keeping Storybook's `path` value readable
 * (`?path=/story/...` instead of percent-encoded slashes).
 */
function buildSearch(params: URLSearchParams, pathValue?: string): string {
  const parts: string[] = [];
  if (pathValue) {
    parts.push(`path=${pathValue}`);
  }
  params.forEach((value, key) => {
    if (key === 'path') return;
    // Storybook args use unencoded `:` separators in practice.
    if (key === 'args' || key === 'globals') {
      parts.push(`${key}=${value}`);
      return;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Rewrite a full URL (string or URL) that uses `?path=` into a clean pathname URL,
 * preserving non-path query params (e.g. args, globals) and hash.
 */
export function rewriteUrlToClean(
  url: string | URL,
  idToClean?: Map<string, string>
): string | null {
  const parsed = typeof url === 'string' ? new URL(url, 'http://storybook.local') : url;
  const pathQuery = parsed.searchParams.get('path');
  if (!pathQuery) return null;

  const cleanPath = storybookPathToCleanPath(pathQuery, idToClean);
  if (cleanPath == null) return null;

  parsed.searchParams.delete('path');
  return `${cleanPath}${buildSearch(parsed.searchParams)}${parsed.hash}`;
}

/**
 * Rewrite a clean pathname URL into Storybook's `/?path=...` form.
 */
export function rewriteUrlToStorybook(
  url: string | URL,
  cleanToStorybook?: Map<string, StorybookPath>
): string | null {
  const parsed = typeof url === 'string' ? new URL(url, 'http://storybook.local') : url;
  if (parsed.searchParams.has('path')) return null;
  if (isStaticPath(parsed.pathname)) return null;

  const resolved = resolveCleanPath(parsed.pathname, cleanToStorybook);
  if (!resolved) {
    if (parsed.pathname === '/' || parsed.pathname === '') return null;
    return null;
  }

  return `/${buildSearch(
    parsed.searchParams,
    toStorybookPathQuery(resolved.viewMode, resolved.storyId)
  )}${parsed.hash}`;
}
