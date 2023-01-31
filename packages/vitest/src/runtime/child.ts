import v8 from 'node:v8'
import { relative, resolve } from 'pathe'
import { createBirpc } from 'birpc'
import { processError } from '@vitest/runner/utils'
import { ModuleCacheMap } from 'vite-node/client'
import { isPrimitive } from 'vite-node/utils'
import { parseRegexp } from '@vitest/utils'
import type { ResolvedConfig } from '../types'
import { distDir } from '../constants'
import { getWorkerState } from '../utils/global'
import type { MockMap } from '../types/mocker'
import type { RuntimeRPC } from '../types/rpc'
import type { ChildContext } from '../types/child'
import { executeInViteNode } from './execute'
import { rpc } from './rpc'

let _viteNode: {
  run: (files: string[], config: ResolvedConfig) => Promise<void>
}

const moduleCache = new ModuleCacheMap()
const mockMap: MockMap = new Map()

async function startViteNode(ctx: ChildContext) {
  if (_viteNode)
    return _viteNode

  const { config } = ctx

  const processExit = process.exit

  process.exit = (code = process.exitCode || 0): never => {
    const error = new Error(`process.exit called with "${code}"`)
    rpc().onWorkerExit(error, code)
    return processExit(code)
  }

  function catchError(err: unknown, type: string) {
    const worker = getWorkerState()
    const error = processError(err)
    if (worker.filepath && !isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      error.VITEST_TEST_PATH = relative(config.root, worker.filepath)
    }
    rpc().onUnhandledError(error, type)
  }

  process.on('uncaughtException', e => catchError(e, 'Uncaught Exception'))
  process.on('unhandledRejection', e => catchError(e, 'Unhandled Rejection'))

  const { run } = (await executeInViteNode({
    files: [
      resolve(distDir, 'entry.js'),
    ],
    fetchModule(id) {
      return rpc().fetch(id)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault,
    root: config.root,
    base: config.base,
  }))[0]

  _viteNode = { run }

  return _viteNode
}

function init(ctx: ChildContext) {
  const { config } = ctx

  process.env.VITEST_WORKER_ID = '1'
  process.env.VITEST_POOL_ID = '1'

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = config.environment
  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    mockMap,
    rpc: createBirpc<RuntimeRPC>(
      {},
      {
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
        serialize: v8.serialize,
        deserialize: v => v8.deserialize(Buffer.from(v)),
        post(v) {
          process.send?.(v)
        },
        on(fn) { process.on('message', fn) },
      },
    ),
  }

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))
}

function parsePossibleRegexp(str: string | RegExp) {
  const prefix = '$$vitest:'
  if (typeof str === 'string' && str.startsWith(prefix))
    return parseRegexp(str.slice(prefix.length))
  return str
}

function unwrapConfig(config: ResolvedConfig) {
  if (config.testNamePattern)
    config.testNamePattern = parsePossibleRegexp(config.testNamePattern) as RegExp
  return config
}

export async function run(ctx: ChildContext) {
  init(ctx)
  const { run } = await startViteNode(ctx)
  return run(ctx.files, ctx.config)
}

const procesExit = process.exit

process.on('message', async (message: any) => {
  if (typeof message === 'object' && message.command === 'start') {
    try {
      message.config = unwrapConfig(message.config)
      await run(message)
    }
    finally {
      procesExit()
    }
  }
})
