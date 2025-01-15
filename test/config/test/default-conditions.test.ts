import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('correctly imports "module" dependency with default resolve.conditions', async () => {
  // dev condition is the default
  const { stderr } = await runVitest({
    root: 'fixtures/default-conditions',
    server: {
      deps: {
        external: [/dependency/],
      },
    },
  }, [], 'test', {
    define: {
      TEST_CONDITION: '"module"',
    },
  })

  expect(stderr).toBe('')
})
