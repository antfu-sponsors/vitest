import { describe, expect, it } from 'vitest'

const ENABLE_SKIP = process.env.ENABLE_SKIP;

describe.skipIf(ENABLE_SKIP)('repro suite', () => {
  it('inner case', () => {
    expect('hi').toMatchSnapshot()
  })
})

it.skipIf(ENABLE_SKIP)('top-level case', () => {
  expect('hi').toMatchSnapshot()
})

// requires at least one non-skipped test to trigger
// `SnapshotClient.startCurrentRun` on current file
it('normal case', () => {
  expect(0).toBe(0)
})
