import { expect, test } from 'vitest'

// @ts-expect-error network imports
import slash from 'http://localhost:9602/slash@3.0.0.js'

// test without local server
// - with internal imports with a relative path '/v135/slash@3.0.0/es2022/slash.mjs'
// import slash from 'https://esm.sh/slash@3.0.0'
// - single file
// import slash from 'https://esm.sh/v135/slash@3.0.0/es2022/slash.mjs'

test('network imports', () => {
  expect(slash('foo\\bar')).toBe('foo/bar')
})
