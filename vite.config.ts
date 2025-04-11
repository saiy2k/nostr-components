import { defineConfig } from 'vite';
// import dts from 'vite-plugin-dts'; 
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // dts({
    //   insertTypesEntry: true, // Creates a single index.d.ts entry file
    //   // Optional: Specify the tsconfig file if it's not standard
    //   // tsConfigFilePath: './tsconfig.build.json'
    // })
  ],
  build: {
    sourcemap: true, // Generate source maps for debugging
    lib: {
      // Library entry point
      entry: resolve(__dirname, 'src/index.ts'),
      // Global variable name for UMD build
      name: 'NostrComponents',
      // Output formats
      formats: ['es', 'umd'],
      // File naming convention for output bundles
      fileName: (format) => `nostr-components.${format}.js`,
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled (peer dependencies)
      // IMPORTANT: @nostr-dev-kit/ndk and nostr-tools are NOT externalized, so they get bundled.
      external: ['lit', 'dayjs'],
      output: {
        // Global variable names for externalized dependencies in UMD build
        globals: {
          lit: 'Lit',
          dayjs: 'dayjs', // Consumers need to ensure dayjs is available globally for UMD format
        },
      },
    },
  },
});
