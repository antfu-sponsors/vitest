// if changed, update also jsdocs and docs
export const defaultPort = 51204

export const EXIT_CODE_RESTART = 43

export const API_PATH = '/__vitest_api__'

export const CONFIG_NAME_START_REGEXP = /^(vitest|vite).config/

export const configFiles = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs',
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
]

export const globalApis = [
  // suite
  'suite',
  'test',
  'describe',
  'it',
  // chai
  'chai',
  'expect',
  'assert',
  // typecheck
  'expectTypeOf',
  'assertType',
  // utils
  'vitest',
  'vi',
  // hooks
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
]
