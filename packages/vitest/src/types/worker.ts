import type { MessagePort } from 'node:worker_threads'
import type { CancelReason, Test } from '@vitest/runner'
import type { ModuleCacheMap, ViteNodeResolveId } from 'vite-node'
import type { BirpcReturn } from 'birpc'
import type { MockMap } from './mocker'
import type { ResolvedConfig } from './config'
import type { ContextRPC, RuntimeRPC } from './rpc'
import type { Environment } from './general'

export interface WorkerContext extends ContextRPC {
  workerId: number
  port: MessagePort
}

export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface AfterSuiteRunMeta {
  coverage?: unknown
}

export type WorkerRPC = BirpcReturn<RuntimeRPC>

export interface WorkerGlobalState {
  ctx: ContextRPC
  config: ResolvedConfig
  rpc: WorkerRPC
  current?: Test
  filepath?: string
  environment: Environment
  environmentTeardownRun?: boolean
  onCancel: Promise<CancelReason>
  moduleCache: ModuleCacheMap
  mockMap: MockMap
  durations: {
    environment: number
    prepare: number
  }
  isChildProcess?: boolean
}
