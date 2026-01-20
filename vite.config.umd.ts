import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Plugin to ensure default export is accessible in UMD format
function ensureUMDDefaultExport(): Plugin {
  return {
    name: 'ensure-umd-default-export',
    writeBundle(options, bundle) {
      const umdFile = 'nostr-components.umd.js';
      if (umdFile in bundle) {
        const file = bundle[umdFile];
        if (file.type === 'chunk') {
          const filePath = resolve(options.dir || 'dist', file.fileName);
          let code = readFileSync(filePath, 'utf-8');
          
          // Find the sourcemap comment
          const sourcemapIndex = code.lastIndexOf('//# sourceMappingURL');
          if (sourcemapIndex !== -1) {
            const beforeSourcemap = code.substring(0, sourcemapIndex).trim();
            const sourcemap = code.substring(sourcemapIndex);
            
            // Add code to ensure default export is accessible
            // The UMD wrapper assigns exports.default, but we ensure it's accessible
            // This runs immediately after the UMD wrapper executes
            const ensureCode = `
// Ensure default export is accessible (UMD compatibility)
// The UMD wrapper should have already assigned exports.default,
// but this ensures it's accessible even if there was an error during module execution
(function() {
  if (typeof window !== 'undefined' && window.NostrComponents) {
    var nc = window.NostrComponents;
    // If default is missing, try to reconstruct it from named exports
    if (!nc.default && nc.init && typeof nc.init === 'function') {
      nc.default = {
        init: nc.init,
        NostrProfileBadge: nc.NostrProfileBadge,
        NostrPost: nc.NostrPost,
        NostrProfile: nc.NostrProfile,
        NostrFollowButton: nc.NostrFollowButton,
        NostrZap: nc.NostrZap,
        NostrComment: nc.NostrComment,
        NostrDm: nc.NostrDm,
        NostrLiveChat: nc.NostrLiveChat,
        NostrLike: nc.NostrLike,
        NostrLivestream: nc.NostrLivestream,
      };
    }
  }
})();
`;
            
            code = beforeSourcemap + ensureCode + '\n' + sourcemap;
            writeFileSync(filePath, code, 'utf-8');
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [ensureUMDDefaultExport()],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NostrComponents',
      formats: ['umd'],
      fileName: () => 'nostr-components.umd.js',
    },
    rollupOptions: {
      // Use 'auto' to include both named and default exports
      output: {
        exports: 'auto',
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
