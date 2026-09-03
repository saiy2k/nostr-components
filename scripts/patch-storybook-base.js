#!/usr/bin/env node
/** Put <base href="/"> first in <head> so nested clean URLs resolve assets. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const indexPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'storybook-static',
  'index.html'
);
if (!fs.existsSync(indexPath)) process.exit(0);
let html = fs.readFileSync(indexPath, 'utf8').replace(/<base\s+href=["']\/["']\s*\/?>/gi, '');
html = html.replace(/<head([^>]*)>/i, '<head$1>\n    <base href="/" />');
fs.writeFileSync(indexPath, html);
