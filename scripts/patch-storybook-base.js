#!/usr/bin/env node
/**
 * Ensure <base href="/"> is the first tag inside <head> so nested clean URLs
 * (e.g. /zap-button/styling/ocean-glass) still resolve ./sb-manager assets
 * from the site root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'storybook-static', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.warn('⚠️  storybook-static/index.html not found; skipping base href patch');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Drop any existing base tags (including the late manager-head copy).
html = html.replace(/<base\s+href=["']\/["']\s*\/?>/gi, '');

if (!/<head[^>]*>/i.test(html)) {
  console.error('❌ Could not find <head> in storybook-static/index.html');
  process.exit(1);
}

html = html.replace(/<head([^>]*)>/i, '<head$1>\n    <base href="/" />');

fs.writeFileSync(indexPath, html);
console.log('✅ Patched storybook-static/index.html with early <base href="/" />');
