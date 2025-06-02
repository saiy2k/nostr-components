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
    rollupOptions: {
      external: ['lit', 'dayjs'],
      output: {
        globals: {
          lit: 'Lit',
          dayjs: 'dayjs',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
