import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('github-actions reporter', async () => {
  let { stdout, stderr, vitest } = await runVitest(
    { reporters: 'github-actions', root: './fixtures' },
    ['some-failing.test.ts'],
  )
  stdout = stdout.replace(vitest!.config.root, '__VITEST_ROOT__')
  expect(stdout).toMatchInlineSnapshot(`
    "
    ::error file=__VITEST_ROOT__/some-failing.test.ts,title=some-failing.test.ts > 3 + 3 = 7,line=8,column=17::AssertionError: expected 6 to be 7 // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- 7%0A+ 6%0A%0A ❯ some-failing.test.ts:8:17%0A%0A
    "
  `)
  expect(stderr).toBe('')
})
