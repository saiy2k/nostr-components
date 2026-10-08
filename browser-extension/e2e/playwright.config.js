// SPDX-License-Identifier: MIT

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: here,
  outputDir: path.join(here, 'test-results'),
  testMatch: '**/*.e2e.js',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 900 }
  }
});
