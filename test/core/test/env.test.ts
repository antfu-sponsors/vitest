import { afterAll, expect, test } from 'vitest'
import { getAuthToken } from '../src/env'

const NODE_ENV = process.env.NODE_ENV

afterAll(() => {
  process.env.NODE_ENV = NODE_ENV
})

test('reassigning NODE_ENV', () => {
  expect(process.env.NODE_ENV).toBeDefined()
  process.env.NODE_ENV = 'development'
  expect(process.env.NODE_ENV).toBe('development')
})

test('reads envs from .env file', () => {
  expect(import.meta.env.VITE_TEST_ENV).toBe('local')
})

test('can reassign env locally', () => {
  import.meta.env.VITEST_ENV = 'TEST'
  expect(import.meta.env.VITEST_ENV).toBe('TEST')
})

test('can reassign env everywhere', () => {
  import.meta.env.AUTH_TOKEN = '123'
  expect(getAuthToken()).toBe('123')
  process.env.AUTH_TOKEN = '321'
  expect(getAuthToken()).toBe('321')
})

test('can see env in "define"', () => {
  expect(import.meta.env.TEST_NAME).toBe('hello world')
  expect(process.env.TEST_NAME).toBe('hello world')
})

test('has worker env', () => {
  expect(process.env.VITEST_WORKER_ID).toBeDefined()
  expect(process.env.VITEST_POOL_ID).toBeDefined()
})

test('custom env', () => {
  expect(process.env.CUSTOM_ENV).toBe('foo')
  expect(import.meta.env.CUSTOM_ENV).toBe('foo')
})

test('ignores import.meta.env in string literals', () => {
  expect('import.meta.env').toBe('import' + '.meta.env')
})

test('define process and using import.meta.env together', () => {
  const process = {}
  expect(process).toMatchObject({})
  expect(import.meta.env.MODE).toEqual('test')
})

test('PROD, DEV, SSR should be boolean', () => {
  expect(typeof import.meta.env.PROD).toEqual('boolean')
  expect(typeof import.meta.env.DEV).toEqual('boolean')
  expect(typeof import.meta.env.SSR).toEqual('boolean')

  import.meta.env.SSR = false
  expect(import.meta.env.SSR).toEqual(false)
})
