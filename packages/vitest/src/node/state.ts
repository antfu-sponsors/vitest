import type { ErrorWithDiff, File, Task, TaskResultPack, UserConsoleLog } from '../types'
// can't import actual functions from utils, because it's incompatible with @vitest/browsers
import type { AggregateError as AggregateErrorPonyfill } from '../utils'
import type { VitestWorkspace } from './workspace'

interface CollectingPromise {
  promise: Promise<void>
  resolve: () => void
}

export function isAggregateError(err: unknown): err is AggregateErrorPonyfill {
  if (typeof AggregateError !== 'undefined' && err instanceof AggregateError)
    return true

  return err instanceof Error && 'errors' in err
}

// Note this file is shared for both node and browser, be aware to avoid node specific logic
export class StateManager {
  filesMap = new Map<string, File[]>()
  pathsSet: Set<string> = new Set()
  collectingPromise: CollectingPromise | undefined = undefined
  browserTestPromises = new Map<string, { resolve: (v: unknown) => void; reject: (v: unknown) => void }>()
  idMap = new Map<string, Task>()
  taskFileMap = new WeakMap<Task, File>()
  errorsSet = new Set<unknown>()
  processTimeoutCauses = new Set<string>()

  catchError(err: unknown, type: string): void {
    if (isAggregateError(err))
      return err.errors.forEach(error => this.catchError(error, type));

    (err as ErrorWithDiff).type = type
    this.errorsSet.add(err)
  }

  clearErrors() {
    this.errorsSet.clear()
  }

  getUnhandledErrors() {
    return Array.from(this.errorsSet.values())
  }

  addProcessTimeoutCause(cause: string) {
    this.processTimeoutCauses.add(cause)
  }

  getProcessTimeoutCauses() {
    return Array.from(this.processTimeoutCauses.values())
  }

  getPaths() {
    return Array.from(this.pathsSet)
  }

  getFiles(keys?: string[]): File[] {
    if (keys)
      return keys.map(key => this.filesMap.get(key)!).filter(Boolean).flat()
    return Array.from(this.filesMap.values()).flat()
  }

  getFilepaths(): string[] {
    return Array.from(this.filesMap.keys())
  }

  getFailedFilepaths() {
    return this.getFiles()
      .filter(i => i.result?.state === 'fail')
      .map(i => i.filepath)
  }

  collectPaths(paths: string[] = []) {
    paths.forEach((path) => {
      this.pathsSet.add(path)
    })
  }

  collectFiles(files: File[] = []) {
    files.forEach((file) => {
      const existing = (this.filesMap.get(file.filepath) || [])
      const otherProject = existing.filter(i => i.projectName !== file.projectName)
      otherProject.push(file)
      this.filesMap.set(file.filepath, otherProject)
      this.updateId(file)
    })
  }

  clearFiles(workspace: VitestWorkspace, paths: string[] = []) {
    paths.forEach((path) => {
      const files = this.filesMap.get(path)
      if (!files)
        return
      const filtered = files.filter(file => file.projectName !== workspace.config.name)
      if (!filtered.length)
        this.filesMap.delete(path)
      else
        this.filesMap.set(path, filtered)
    })
  }

  updateId(task: Task) {
    if (this.idMap.get(task.id) === task)
      return
    this.idMap.set(task.id, task)
    if (task.type === 'suite') {
      task.tasks.forEach((task) => {
        this.updateId(task)
      })
    }
  }

  updateTasks(packs: TaskResultPack[]) {
    for (const [id, result] of packs) {
      if (this.idMap.has(id))
        this.idMap.get(id)!.result = result
    }
  }

  updateUserLog(log: UserConsoleLog) {
    const task = log.taskId && this.idMap.get(log.taskId)
    if (task) {
      if (!task.logs)
        task.logs = []
      task.logs.push(log)
    }
  }
}
