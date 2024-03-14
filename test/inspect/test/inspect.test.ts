import type { InspectorNotification } from 'node:inspector'
import { expect, test } from 'vitest'
import WebSocket from 'ws'

import { isWindows } from '../../../packages/vite-node/src/utils'
import { runVitestCli } from '../../test-utils'

type Message = Partial<InspectorNotification<any>>

test.skipIf(isWindows)('--inspect-brk stops at test file', async () => {
  const vitest = await runVitestCli('--root', 'fixtures', '--inspect-brk', '--no-file-parallelism')

  await vitest.waitForStderr('Debugger listening on ')
  const url = vitest.stderr.split('\n')[0].replace('Debugger listening on ', '')

  const { receive, send } = await createChannel(url)

  send({ method: 'Debugger.enable' })
  send({ method: 'Runtime.enable' })
  await receive('Runtime.executionContextCreated')

  const paused = receive('Debugger.paused')
  send({ method: 'Runtime.runIfWaitingForDebugger' })

  const { params } = await paused
  const scriptId = params.callFrames[0].functionLocation.scriptId

  // Verify that debugger paused on test file
  const response = receive()
  send({ method: 'Debugger.getScriptSource', params: { scriptId } })
  const { result } = await response as any

  expect(result.scriptSource).toContain('test("sum", () => {')
  expect(result.scriptSource).toContain('expect(1 + 1).toBe(2)')

  send({ method: 'Debugger.resume' })

  await vitest.waitForStdout('Test Files  1 passed (1)')
  await vitest.isDone
})

async function createChannel(url: string) {
  const ws = new WebSocket(url)

  let id = 1
  let receiver = defer()

  ws.onerror = receiver.reject
  ws.onmessage = (message) => {
    const response = JSON.parse(message.data.toString())
    receiver.resolve(response)
  }

  async function receive(filter?: string) {
    const message = await receiver.promise
    receiver = defer()

    if (filter && message.method !== filter)
      return receive(filter)

    return message
  }

  function send(message: Message) {
    ws.send(JSON.stringify({ ...message, id: id++ }))
  }

  await new Promise(r => ws.on('open', r))

  return { receive, send }
}

function defer(): {
  promise: Promise<Message>
  resolve: (response: Message) => void
  reject: (error: unknown) => void
} {
  const pr = {} as ReturnType<typeof defer>

  pr.promise = new Promise((resolve, reject) => {
    pr.resolve = resolve
    pr.reject = reject
  })

  return pr
}
