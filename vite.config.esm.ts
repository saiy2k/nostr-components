import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
        'nostr-zap': resolve(__dirname, 'src/nostr-zap/nostr-zap.ts'),
      },
      output: [
        {
          entryFileNames: (chunkInfo) => 
            chunkInfo.name === 'index'
            ? 'nostr-components.es.js'
            : `components/[name].es.js`,
          format: 'es',
          inlineDynamicImports: false,
        },
      ],
    },
    lib: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
