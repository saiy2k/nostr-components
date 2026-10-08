#!/usr/bin/env node
// SPDX-License-Identifier: MIT

// Turn a saved x.com article (or a full page) into a fixture document.
// Strips scripts, nonces, and image/video URLs. Does not remove tweet text.
//
//   node browser-extension/tests/fixtures/x/sanitize.mjs incoming.html fixture.html
//
// See README.md in this folder for how to copy the article from a browser.

import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = process.argv[2];
const destPath = process.argv[3];
if (!sourcePath || !destPath) {
  console.error('usage: node sanitize.mjs <incoming.html> <fixture.html>');
  process.exit(1);
}

const html = readFileSync(sourcePath, 'utf8').replaceAll('\0', '');
const articles = extractArticles(html);
if (articles.length === 0) {
  console.error('No <article> element found. Copy the tweet article outerHTML, or save the full page.');
  process.exit(1);
}

const article = articles.reduce((largest, candidate) => (
  candidate.length > largest.length ? candidate : largest
));
const sanitized = sanitize(article);
const document = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"></head>',
  '<body>',
  '<!-- captured: REPLACE with the page URL, date, logged-in or logged-out, theme, and locale. -->',
  sanitized,
  '</body>',
  '</html>',
  ''
].join('\n');

writeFileSync(destPath, document);
console.log(`wrote ${destPath} (${articles.length} article(s) found, kept the largest)`);

function extractArticles(source) {
  const articles = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf('<article', index);
    if (start < 0) break;
    let depth = 0;
    let cursor = start;
    let closed = false;
    while (cursor < source.length) {
      if (source.startsWith('<article', cursor)) {
        depth += 1;
        const end = source.indexOf('>', cursor);
        if (end < 0) break;
        cursor = end + 1;
        continue;
      }
      if (source.startsWith('</article>', cursor)) {
        depth -= 1;
        cursor += '</article>'.length;
        if (depth === 0) {
          articles.push(source.slice(start, cursor));
          index = cursor;
          closed = true;
          break;
        }
        continue;
      }
      cursor += 1;
    }
    if (!closed) break;
  }
  return articles;
}

function sanitize(article) {
  return article
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\snonce="[^"]*"/gi, '')
    .replace(/\s(?:src|srcSet|srcset|poster)="[^"]*"/gi, '')
    .replace(/https:\/\/(?:pbs|video)\.twimg\.com\/[^"\s<>]+/gi, '')
    .replace(/\s(?:integrity|crossorigin)="[^"]*"/gi, '');
}
