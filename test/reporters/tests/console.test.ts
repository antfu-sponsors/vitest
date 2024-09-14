import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/reporters'
import { runVitest } from '../../test-utils'

class LogReporter extends DefaultReporter {
  isTTY = true
  renderer = {
    start() {},
    update() {},
    stop() {},
    clear() {},
  }
}

test('should print logs correctly', async () => {
  const filename = resolve('./fixtures/console.test.ts')

  const { stdout, stderr } = await runVitest({
    root: './fixtures',
    reporters: [new LogReporter() as any],
  }, [filename])

  expect(stdout).toBeTruthy()
  expect(stderr).toBeTruthy()

  expect(stdout).toContain(
    `stdout | console.test.ts
global stdin beforeAll

stdout | console.test.ts > suite
suite stdin beforeAll

stdout | console.test.ts > suite > nested suite
nested suite stdin beforeAll`,
  )

  expect(stdout).toContain(
    `stdout | console.test.ts > suite > nested suite
nested suite stdin afterAll

stdout | console.test.ts > suite
suite stdin afterAll

stdout | console.test.ts
global stdin afterAll`,
  )

  expect(stderr).toContain(
    `stderr | console.test.ts
global stderr beforeAll

stderr | console.test.ts > suite
suite stderr beforeAll

stderr | console.test.ts > suite > nested suite
nested suite stderr beforeAll

stderr | console.test.ts > suite > nested suite
nested suite stderr afterAll

stderr | console.test.ts > suite
suite stderr afterAll

stderr | console.test.ts
global stderr afterAll`,
  )
})
