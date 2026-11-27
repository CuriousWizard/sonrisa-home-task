import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Test workers inherit process.env, so TEST_DATABASE_URL reaches the tests.
const rootEnvPath = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    // Route specs share rows such as the channels table, so files run one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // So no test can reach the main database.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/api',
      provider: 'v8' as const,
    },
  },
}));
