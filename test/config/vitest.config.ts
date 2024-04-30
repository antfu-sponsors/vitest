import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Note: One test expects coverage.thresholds not to be defined in here
  test: {
    include: ['test/**.test.ts'],
    reporters: ['verbose'],
    testTimeout: 60_000,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    chaiConfig: {
      truncateThreshold: 999,
    },
    coverage: {
      reporter: [],
    },
  },
})
