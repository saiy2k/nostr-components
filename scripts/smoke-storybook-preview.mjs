#!/usr/bin/env node
/**
 * Smoke-check a Storybook Hosting URL built in STORYBOOK_BUNDLE=local mode.
 *
 * Usage: node scripts/smoke-storybook-preview.mjs <base-url>
 *
 * Fails if the main bundle is missing or returns HTML (SPA fallback trap).
 */

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
const FETCH_TIMEOUT_MS = 30_000;
const BODY_SAMPLE_CHARS = 200;

if (!baseUrl) {
  console.error('Usage: node scripts/smoke-storybook-preview.mjs <base-url>');
  process.exit(1);
}

const checks = [
  { path: '/nostr-components.es.js', expectJs: true },
  { path: '/components/nostr-profile.es.js', expectJs: true },
  { path: '/themes.css', expectCss: true },
  { path: '/iframe.html', expectHtml: true },
];

function looksLikeHtml(contentType, bodySample) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  return /^\s*</.test(bodySample) && /<html|<!doctype/i.test(bodySample);
}

async function readBodySample(res, maxChars = BODY_SAMPLE_CHARS) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    return text.slice(0, maxChars);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sample = '';

  try {
    while (sample.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      sample += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors
    }
  }

  return sample.slice(0, maxChars);
}

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const contentType = res.headers.get('content-type') || '';
    const bodySample = await readBodySample(res);

    if (!res.ok) {
      console.error(`FAIL ${check.path}: HTTP ${res.status}`);
      failed = true;
      continue;
    }

    if (check.expectJs) {
      if (looksLikeHtml(contentType, bodySample)) {
        console.error(
          `FAIL ${check.path}: got HTML instead of JS (content-type=${contentType || 'missing'})`
        );
        failed = true;
        continue;
      }
      if (!contentType.includes('javascript') && !contentType.includes('ecmascript') && !/\bexport\b|\bimport\b/.test(bodySample)) {
        console.error(`FAIL ${check.path}: does not look like a JS module (content-type=${contentType || 'missing'})`);
        failed = true;
        continue;
      }
    }

    if (check.expectCss && looksLikeHtml(contentType, bodySample)) {
      console.error(`FAIL ${check.path}: got HTML instead of CSS`);
      failed = true;
      continue;
    }

    if (check.expectHtml && !looksLikeHtml(contentType, bodySample)) {
      // iframe.html should be HTML; soft-warn only if totally wrong
      console.warn(`WARN ${check.path}: unexpected content-type ${contentType || 'missing'}`);
    }

    console.log(`OK   ${check.path} (${res.status}, ${contentType || 'no content-type'})`);
  } catch (err) {
    console.error(`FAIL ${check.path}: ${err.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nStorybook preview smoke check failed.');
  process.exit(1);
}

console.log('\nStorybook preview smoke check passed.');
