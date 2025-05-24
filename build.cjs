const fs = require('node:fs');
const esbuild = require('esbuild');
const { join } = require('path');

const all = fs
  .readdirSync(process.cwd())
  .filter(
    file =>
      file.endsWith('.ts') && fs.statSync(join(process.cwd(), file)).isFile()
  );

const components = all.filter(file => file.startsWith('nostr-'));
const lib = all.filter(file => file !== 'index.ts');

console.log(components);
console.log(lib);

esbuild
  .build({
    entryPoints: components,
    bundle: true,
    sourcemap: 'external',
    outdir: 'dist/',
    format: 'iife',
  })
  .then(() => console.log('standalone components build success.'));

esbuild
  .build({
    entryPoints: ['index.ts'],
    bundle: true,
    sourcemap: 'external',
    outdir: 'dist/',
    format: 'iife',
  })
  .then(() => console.log('big bundle build success.'));

console.log(lib);

esbuild
  .build({
    entryPoints: lib,
    bundle: false,
    sourcemap: 'external',
    outdir: 'lib/',
    format: 'esm',
  })
  .then(() => console.log('lib build success.'));
