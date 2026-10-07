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

if (!existsSync('dist')) {
  console.error('dist/ is missing. Run npm run build before checking published types.');
  process.exit(1);
}

const files = declarationFiles('dist');
const leaks = files.filter((file) => readFileSync(file, 'utf8').includes('backend/'));
if (leaks.length) {
  console.error('Declaration files mention backend/:');
  for (const file of leaks) console.error(`  ${file}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const types = new Set();
if (typeof pkg.types === 'string') types.add(pkg.types);
for (const entry of Object.values(pkg.exports || {})) {
  if (entry && typeof entry === 'object' && typeof entry.types === 'string') {
    types.add(entry.types);
  }
}
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
