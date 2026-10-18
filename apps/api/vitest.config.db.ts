import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Database tests: need DATABASE_URL pointing at a local PostgreSQL with the migrations applied. */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.db-spec.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
