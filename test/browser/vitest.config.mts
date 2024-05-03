import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

function noop() {}

const provider = process.env.PROVIDER || 'playwright'
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  server: {
    headers: {
      'x-custom': 'hello',
    },
  },
  optimizeDeps: {
    include: ['@vitest/cjs-lib'],
  },
  test: {
    include: ['test/**.test.{ts,js}'],
    // having a snapshot environment doesn't affect browser tests
    snapshotEnvironment: './custom-snapshot-env.ts',
    browser: {
      enabled: true,
      name: browser,
      headless: false,
      provider,
      isolate: false,
      slowHijackESM: true,
    },
    alias: {
      '#src': resolve(dir, './src'),
    },
    open: false,
    diff: './custom-diff-config.ts',
    outputFile: './browser.json',
    reporters: ['json', {
      onInit: noop,
      onPathsCollected: noop,
      onCollected: noop,
      onFinished: noop,
      onTaskUpdate: noop,
      onTestRemoved: noop,
      onWatcherStart: noop,
      onWatcherRerun: noop,
      onServerRestart: noop,
      onUserConsoleLog: noop,
    }, 'default'],
  },
})
