import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/shared',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'shared',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Runs tsc on the *.spec-d.ts files, so an unused @ts-expect-error fails the test run.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
    },
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/shared',
      provider: 'v8' as const,
    },
  },
}));
