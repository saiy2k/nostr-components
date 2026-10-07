// SPDX-License-Identifier: MIT

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function declarationFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) declarationFiles(path, out);
    else if (name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

function collectTypes(value, types) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.types === 'string') types.add(value.types);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') collectTypes(nested, types);
  }
}

if (!existsSync('dist')) {
  console.error('dist/ is missing. Run npm run build before checking published types.');
  process.exit(1);
}

const files = declarationFiles('dist');
const backendRef = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"][^'"]*backend\//;
const leaks = files.filter((file) => backendRef.test(readFileSync(file, 'utf8')));
if (leaks.length) {
  console.error('Declaration files import backend/:');
  for (const file of leaks) console.error(`  ${file}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const types = new Set();
if (typeof pkg.types === 'string') types.add(pkg.types);
collectTypes(pkg.exports, types);
let missing = false;
for (const typesPath of types) {
  const relative = typesPath.replace(/^\.\//, '');
  if (!existsSync(relative)) {
    console.error(`Missing types path: ${typesPath}`);
    missing = true;
  }
}
if (missing) process.exit(1);
console.log(`Published types OK (${files.length} declaration files, ${types.size} package paths).`);
