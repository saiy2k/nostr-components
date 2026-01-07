import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true, // Creates a single index.d.ts entry file
      outDir: 'dist',
    })
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
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
        'nostr-zap-button': resolve(__dirname, 'src/nostr-zap/nostr-zap.ts'),
        'nostr-comment': resolve(__dirname, 'src/nostr-comment/nostr-comment.ts'),
        'nostr-dm': resolve(__dirname, 'src/nostr-dm/nostr-dm.ts'),
        'nostr-live-chat': resolve(__dirname, 'src/nostr-live-chat/nostr-live-chat.ts'),
        'nostr-like-button': resolve(__dirname, 'src/nostr-like/nostr-like.ts'),
      },
      external: [],
      preserveEntrySignatures: 'exports-only',
      output: [
        {
          entryFileNames: (chunkInfo) => 
            chunkInfo.name === 'index'
            ? 'nostr-components.es.js'
            : `components/[name].es.js`,
          format: 'es',
          inlineDynamicImports: false,
          exports: 'auto',
        },
      ],
    },
    lib: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
