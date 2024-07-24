import { a, b } from '@vitest/cjs-lib'
import { expect, test, vi } from 'vitest'

vi.mock(import('@vitest/cjs-lib'), async (importOriginal) => {
  const original = await importOriginal()
  console.log('original', original)
  return {
    ...await importOriginal(),
  }
})

test('mocking works correctly', () => {
  expect(a).toBe('a')
  expect(b).toBe('b')
})
