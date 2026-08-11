#!/usr/bin/env node
/**
 * Smoke-check a Storybook Hosting URL built in STORYBOOK_BUNDLE=local mode.
 *
 * Usage: node scripts/smoke-storybook-preview.mjs <base-url>
 *
 * Fails if the main bundle is missing or returns HTML (SPA fallback trap).
 */

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('Usage: node scripts/smoke-storybook-preview.mjs <base-url>');
  process.exit(1);
}

const checks = [
  { path: '/nostr-components.es.js', expectJs: true },
  { path: '/themes.css', expectCss: true },
  { path: '/iframe.html', expectHtml: true },
];

function looksLikeHtml(contentType, bodySample) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  return /^\s*</.test(bodySample) && /<html|<!doctype/i.test(bodySample);
}

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const contentType = res.headers.get('content-type') || '';
    const sample = await res.text();
    const bodySample = sample.slice(0, 200);

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

    if (check.expectHtml && !looksLikeHtml(contentType, bodySample) && !contentType.includes('text/html')) {
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
