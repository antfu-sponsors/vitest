import { SpyModule, collectTests, setupCommonEnv, startCoverageInsideWorker, startTests, stopCoverageInsideWorker } from 'vitest/browser'
import { page } from '@vitest/browser/context'
import type { IframeMockEvent, IframeMockInvalidateEvent, IframeUnmockEvent } from '@vitest/browser/client'
import { channel, client, onCancel, waitForChannel } from '@vitest/browser/client'
import { executor, getBrowserState, getConfig, getWorkerState } from '../utils'
import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { createSafeRpc } from './rpc'
import { browserHashMap, initiateRunner } from './runner'
import { VitestBrowserClientMocker } from './mocker'
import { setupExpectDom } from './expect-element'

const cleanupSymbol = Symbol.for('vitest:component-cleanup')

const url = new URL(location.href)
const reloadStart = url.searchParams.get('__reloadStart')

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}

async function prepareTestEnvironment(files: string[]) {
  debug('trying to resolve runner', `${reloadStart}`)
  const config = getConfig()

  const rpc = createSafeRpc(client)

  const state = getWorkerState()

  state.ctx.files = files
  state.onCancel = onCancel
  state.rpc = rpc as any

  const mocker = new VitestBrowserClientMocker(
    {
      async delete(url: string) {
        channel.postMessage({
          type: 'unmock',
          url,
        } satisfies IframeUnmockEvent)
        await waitForChannel('unmock:done')
      },
      async register(module) {
        channel.postMessage({
          type: 'mock',
          module: module.toJSON(),
        } satisfies IframeMockEvent)
        await waitForChannel('mock:done')
      },
      invalidate() {
        channel.postMessage({
          type: 'mock:invalidate',
        } satisfies IframeMockInvalidateEvent)
      },
    },
    rpc,
    SpyModule.spyOn,
    {
      root: getBrowserState().viteConfig.root,
    },
  )
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = mocker

  setupConsoleLogSpy()
  setupDialogsSpy()
  setupExpectDom()

  const runner = await initiateRunner(state, mocker, config)

  const version = url.searchParams.get('browserv') || ''
  files.forEach((filename) => {
    const currentVersion = browserHashMap.get(filename)
    if (!currentVersion || currentVersion[1] !== version) {
      browserHashMap.set(filename, [true, version])
    }
  })

  mocker.setupWorker()

  onCancel.then((reason) => {
    runner.onCancel?.(reason)
  })

  return {
    runner,
    config,
    state,
  }
}

function done(files: string[]) {
  channel.postMessage({
    type: 'done',
    filenames: files,
    id: getBrowserState().iframeId!,
  })
}

async function executeTests(method: 'run' | 'collect', files: string[]) {
  await client.waitForConnection()

  debug('client is connected to ws server')

  let preparedData:
    | Awaited<ReturnType<typeof prepareTestEnvironment>>
    | undefined
    | false

  // if importing /@id/ failed, we reload the page waiting until Vite prebundles it
  try {
    preparedData = await prepareTestEnvironment(files)
  }
  catch (error: any) {
    debug('runner cannot be loaded because it threw an error', error.stack || error.message)
    await client.rpc.onUnhandledError({
      name: error.name,
      message: error.message,
      stack: String(error.stack),
    }, 'Preload Error')
    done(files)
    return
  }

  // page is reloading
  if (!preparedData) {
    debug('page is reloading, waiting for the next run')
    return
  }

  debug('runner resolved successfully')

  const { config, runner, state } = preparedData

  state.durations.prepare = performance.now() - state.durations.prepare

  debug('prepare time', state.durations.prepare, 'ms')

  try {
    await Promise.all([
      setupCommonEnv(config),
      startCoverageInsideWorker(config.coverage, executor),
      (async () => {
        const VitestIndex = await import('vitest')
        Object.defineProperty(window, '__vitest_index__', {
          value: VitestIndex,
          enumerable: false,
        })
      })(),
    ])

    for (const file of files) {
      state.filepath = file

      if (method === 'run') {
        await startTests([file], runner)
      }
      else {
        await collectTests([file], runner)
      }
    }
  }
  finally {
    try {
      if (cleanupSymbol in page) {
        (page[cleanupSymbol] as any)()
      }
    }
    catch (error: any) {
      await client.rpc.onUnhandledError({
        name: error.name,
        message: error.message,
        stack: String(error.stack),
      }, 'Cleanup Error')
    }
    state.environmentTeardownRun = true
    await stopCoverageInsideWorker(config.coverage, executor).catch((error) => {
      client.rpc.onUnhandledError({
        name: error.name,
        message: error.message,
        stack: String(error.stack),
      }, 'Coverage Error').catch(() => {})
    })

    debug('finished running tests')
    done(files)
  }
}

// @ts-expect-error untyped global for internal use
window.__vitest_browser_runner__.runTests = files => executeTests('run', files)
// @ts-expect-error untyped global for internal use
window.__vitest_browser_runner__.collectTests = files => executeTests('collect', files)
