import { expect, it } from 'vitest'

import MyWorker from '../src/worker?worker'
import MyEventListenerWorker from '../src/eventListenerWorker?worker'

const testWorker = (worker: Worker) => {
  return new Promise<void>((resolve) => {
    worker.postMessage('hello')
    worker.onmessage = (e) => {
      expect(e.data).toBe('hello world')

      resolve()
    }
  })
}

it('worker exists', async () => {
  expect(Worker).toBeDefined()
})

it('simple worker', async () => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('event listener worker', async () => {
  expect.assertions(1)

  await testWorker(new MyEventListenerWorker())
})

it('can test workers several times', async () => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('worker with url', async () => {
  expect.assertions(1)
  const url = import.meta.url

  await testWorker(new Worker(new URL('../src/worker.ts', url)))
})
