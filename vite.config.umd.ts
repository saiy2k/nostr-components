import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NostrComponents',
      formats: ['umd'],
      fileName: () => 'nostr-components.umd.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
