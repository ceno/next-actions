import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts, whose `root: 'public'` is a build concern and
// would otherwise hide the test directory from vitest.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
