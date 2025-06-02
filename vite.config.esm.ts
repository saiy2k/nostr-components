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
      },
      external: ['lit', 'dayjs'],
      output: [
        {
          entryFileNames: chunkInfo => {
            if (chunkInfo.name === 'index') return 'nostr-components.es.js';
            return `components/[name].es.js`;
          },
          format: 'es',
          inlineDynamicImports: false,
          globals: {
            lit: 'Lit',
            dayjs: 'dayjs',
          },
        },
      ],
    },
    lib: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
