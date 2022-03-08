import { expect, test } from 'vitest'

test('dynamic relative import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})

test('dynamic aliased import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = '@/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})

test('dynamic absolute import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})

test('data with dynamic import works', async() => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import(dataUri)
  expect(hi).toBe('hi')
})
