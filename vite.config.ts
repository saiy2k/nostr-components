import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true, // Creates a single index.d.ts entry file
      //   // Optional: Specify the tsconfig file if it's not standard
      //   // tsConfigFilePath: './tsconfig.build.json'
    })
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      // Multiple entry points: main bundle and per-component bundles
      input: {
        index: resolve(__dirname, 'src/index.ts'),
        'nostr-follow-button': resolve(
          __dirname,
          'src/nostr-follow-button/nostr-follow-button.ts'
        ),
        'nostr-post': resolve(__dirname, 'src/nostr-post/nostr-post.ts'),
        'nostr-profile': resolve(
          __dirname,
          'src/nostr-profile/nostr-profile.ts'
        ),
        'nostr-profile-badge': resolve(
          __dirname,
          'src/nostr-profile-badge/nostr-profile-badge.ts'
        ),
      },
      output: [
        {
          // ESM output for all entries
          entryFileNames: chunkInfo => {
            if (chunkInfo.name === 'index') return 'nostr-components.es.js';
            return `components/[name].es.js`;
          },
          format: 'es',
          inlineDynamicImports: false,
        },
        {
          // UMD output ONLY for the main entry
          entryFileNames: () => 'nostr-components.umd.js',
          format: 'umd',
          inlineDynamicImports: false,
          name: 'NostrComponents',
        },
      ],
    },
    lib: false, // Disable lib mode to allow multiple entries
    outDir: 'dist',
    emptyOutDir: true,
  },
});
