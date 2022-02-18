/* eslint-disable no-restricted-imports */

import { VitestRunner } from 'vitest'
import type { WorkerGlobalState } from 'vitest'

declare let __vitest_worker__: WorkerGlobalState

type Procedure = (...args: any[]) => void

class Bridge {
  private callbacks: Record<string, Procedure[]> = {}

  public on(event: string, fn: Procedure) {
    this.callbacks[event] ??= []
    this.callbacks[event].push(fn)
  }

  public off(event: string, fn: Procedure) {
    if (this.callbacks[event])
      this.callbacks[event] = this.callbacks[event].filter(f => f !== fn)
  }

  public removeEvents(event: string) {
    this.callbacks[event] = []
  }

  public clear() {
    this.callbacks = {}
  }

  public emit(event: string, ...data: any[]) {
    return (this.callbacks[event] || []).map(fn => fn(...data))
  }
}

interface InlineWorkerContext {
  onmessage: Procedure | null
  dispatchEvent: (e: Event) => void
  addEventListener: (e: string, fn: Procedure) => void
  removeEventListener: (e: string, fn: Procedure) => void
  postMessage: (data: any) => void
  self: InlineWorkerContext
  global: InlineWorkerContext
  invalidate: string[]
  importScripts?: any
}

class InlineWorkerRunner extends VitestRunner {
  constructor(options: any, private context: InlineWorkerContext) {
    super(options)
  }

  prepareContext(context: Record<string, any>) {
    const ctx = super.prepareContext(context)
    // not supported for now
    // need to be async
    this.context.self.importScripts = () => {}
    return Object.assign(ctx, this.context, {
      importScripts: () => {},
    })
  }
}

export function defineInlineWorker() {
  if ('Worker' in globalThis) return

  const { config, rpc, mockMap, moduleCache } = __vitest_worker__

  const options = {
    fetchModule(id: string) {
      return rpc.fetch(id)
    },
    resolveId(id: string, importer?: string) {
      return rpc.resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault ?? true,
    root: config.root,
    base: config.base,
  }

  globalThis.Worker = class Worker {
    private inside = new Bridge()
    private outside = new Bridge()

    private messageQueue: any[] | null = []

    public onmessage: null | Procedure = null
    public onmessageerror: null | Procedure = null
    public onerror: null | Procedure = null

    constructor(url: URL | string) {
      const invalidate: string[] = []
      const context: InlineWorkerContext = {
        onmessage: null,
        dispatchEvent: (event: Event) => {
          this.inside.emit(event.type, event)
          return true
        },
        addEventListener: this.inside.on,
        removeEventListener: this.inside.off,
        postMessage: (data) => {
          this.outside.emit('message', { data })
        },
        get self() {
          return context
        },
        get global() {
          return context
        },
        invalidate,
      }

      this.inside.on('message', (e) => {
        context.onmessage?.(e)
      })

      this.outside.on('message', (e) => {
        this.onmessage?.(e)
      })

      const runner = new InlineWorkerRunner(options, context)

      let id = url instanceof URL ? url.toString() : url

      id = id.replace('?worker_file', '')

      invalidate.push(id)

      runner.executeId(id)
        .then(() => {
          invalidate.forEach((path) => {
            // worker should be new every time
            moduleCache.delete(path)
            moduleCache.delete(`${path}__mock`)
          })
          const q = this.messageQueue
          this.messageQueue = null
          if (q)
            q.forEach(this.postMessage, this)
        }).catch((e) => {
          this.outside.emit('error', e)
          this.onerror?.(e)
          console.error(e)
        })
    }

    dispatchEvent(event: Event) {
      this.outside.emit(event.type, event)
      return true
    }

    addEventListener(event: string, fn: Procedure) {
      this.outside.on(event, fn)
    }

    removeEventListener(event: string, fn: Procedure) {
      this.outside.off(event, fn)
    }

    postMessage(data: any) {
      if (this.messageQueue != null)
        this.messageQueue.push(data)
      else
        this.inside.emit('message', { data })
    }

    terminate() {
      this.outside.clear()
      this.inside.clear()
    }
  }
}
