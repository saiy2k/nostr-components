// SPDX-License-Identifier: MIT

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.storybook', 'storybook-static', 'functions'],
    
    // Test environment - using 'node' for pure functions, can switch to 'happy-dom' when testing Web Components
    environment: 'node',
    
    // Coverage configuration (optional, can enable later)
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*'],
    // },
    
    // Globals - enable vitest globals (describe, it, expect) without imports
    globals: false,
  },
  
  resolve: {
    alias: {
      // Match any path aliases from vite config if needed
    },
  },
});
