import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('prints correct unhandled error stack', async () => {
  const { stderr, browser } = await runBrowserTests({
    root: './fixtures/unhandled',
  })

  if (browser === 'webkit') {
    expect(stderr).toContain('throw-unhandled-error.test.ts:9:20')
  }
  else {
    expect(stderr).toContain('throw-unhandled-error.test.ts:9:10')
  }
})
