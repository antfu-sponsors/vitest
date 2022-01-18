import type { MessagePort } from 'worker_threads'
import type { RawSourceMap } from 'source-map-js'
import type { ViteNodeResolveId } from 'vite-node'
import type { ResolvedConfig } from './config'
import type { File, TaskResultPack } from './tasks'
import type { SnapshotResult } from './snapshot'
import type { UserConsoleLog } from './general'

export interface WorkerContext {
  port: MessagePort
  config: ResolvedConfig
  files: string[]
  invalidates?: string[]
}

export type FetchFunction = (id: string) => Promise<{ code?: string; externalize?: string }>
export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface WorkerRPC {
  fetch: FetchFunction
  resolveId: ResolveIdFunction
  getSourceMap: (id: string, force?: boolean) => Promise<RawSourceMap | undefined>

  onWorkerExit: (code?: number) => void
  onUserConsoleLog: (log: UserConsoleLog) => void
  onCollected: (files: File[]) => void
  onTaskUpdate: (pack: TaskResultPack[]) => void

  snapshotSaved: (snapshot: SnapshotResult) => void
}
