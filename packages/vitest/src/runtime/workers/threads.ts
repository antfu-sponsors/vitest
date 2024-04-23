import type { ContextRPC } from '../../types/rpc'
import type { WorkerContext, WorkerGlobalState } from '../../types/worker'
import { runBaseTests } from './base'
import type { VitestWorker } from './types'
import { createThreadsRpcOptions } from './utils'

class ThreadsBaseWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC) {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runBaseTests(state)
  }
}

export default new ThreadsBaseWorker()
