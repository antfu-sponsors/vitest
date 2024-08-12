import { cdp } from '@vitest/browser/context'
import type { V8CoverageProvider } from './provider'
import { loadProvider } from './load-provider'

const session = cdp()

type ScriptCoverage = Awaited<ReturnType<typeof session.send<'Profiler.takePreciseCoverage'>>>

export default {
  async startCoverage() {
    await session.send('Profiler.enable')
    await session.send('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    })
  },

  async takeCoverage(): Promise<{ result: any[] }> {
    const coverage = await session.send('Profiler.takePreciseCoverage')
    const result: typeof coverage.result = []

    // Reduce amount of data sent over rpc by doing some early result filtering
    for (const entry of coverage.result) {
      if (filterResult(entry)) {
        result.push({
          ...entry,
          url: decodeURIComponent(entry.url.replace(window.location.origin, '')),
        })
      }
    }

    return { result }
  },

  async stopCoverage() {
    await session.send('Profiler.stopPreciseCoverage')
    await session.send('Profiler.disable')
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
}

function filterResult(coverage: ScriptCoverage['result'][number]): boolean {
  if (!coverage.url.startsWith(window.location.origin)) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  if (coverage.url.includes('__vitest_browser__')) {
    return false
  }

  if (coverage.url.includes('__vitest__/assets')) {
    return false
  }

  return true
}
