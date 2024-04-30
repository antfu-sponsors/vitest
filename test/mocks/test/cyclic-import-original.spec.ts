import { expect, test, vi } from 'vitest'

import '../src/cyclic-deps/module-1.js'

vi.mock('../src/cyclic-deps/module-2', async (importOriginal) => {
  await importOriginal()

  return { default: () => {} }
})

test('some test', () => {
  expect(1 + 1).toBe(2)
})
