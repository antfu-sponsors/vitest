import { defineConfig } from 'vite'

export default defineConfig({
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
    env: {
      NO_COLOR: 'true',
    },
  },
  server: {
    watch: {
      ignored: [
        '**/fixtures/browser-multiple/**/*',
      ],
    },
  },
})
