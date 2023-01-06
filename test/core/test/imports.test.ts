import { expect, test } from 'vitest'
import { dynamicRelativeImport } from '../src/relative-import'

test('dynamic relative import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('Relative imports in imported modules work', async () => {
  const relativeImportFromFile = await dynamicRelativeImport('timeout')
  const directImport = await import('./../src/timeout')

  expect(relativeImportFromFile).toBe(directImport)
})

test('dynamic aliased import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '#/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('dynamic absolute import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('data with dynamic import works', async () => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import(dataUri)
  expect(hi).toBe('hi')
})

test('dynamic import has Module symbol', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  // @ts-expect-error The symbol won't exist on the import type
  expect(stringTimeoutMod[Symbol.toStringTag]).toBe('Module')
})

test('dynamic import has null prototype', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  expect(Object.getPrototypeOf(stringTimeoutMod)).toBe(null)
})

test('dynamic import throws an error', async () => {
  const path = './some-unknown-path'
  const imported = import(path)
  await expect(imported).rejects.toThrowError(/Failed to load/)
  // @ts-expect-error path does not exist
  await expect(() => import('./some-unknown-path')).rejects.toThrowError(/Failed to load/)
})

test('can import @vite/client', async () => {
  const name = '@vite/client'
  await expect(import(name)).resolves.not.toThrow()
  await expect(import(`/${name}`)).resolves.not.toThrow()
})
