import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: 'verbose',
    include: ['test/**/*.test.*'],
    chaiConfig: {
      truncateThreshold: 0,
    },
    testTimeout: process.env.CI ? 30_000 : 10_000,
  },
})
