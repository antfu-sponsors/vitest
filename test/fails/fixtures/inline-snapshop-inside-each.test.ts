import { describe, expect, test } from 'vitest'

test.each([1])('', () => {
  expect('').toMatchInlineSnapshot()
})

describe.each([1])('', () => {
  test('', () => {
    expect('').toMatchInlineSnapshot()
  })

  test.each([1])('', () => {
    expect('').toMatchInlineSnapshot()
  })
})
