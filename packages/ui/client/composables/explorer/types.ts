import type { Custom, RunMode, TaskState, Test } from '@vitest/runner'

export type TreeTaskMatcher = (node: UITaskTreeNode | Custom | Test) => boolean

export interface TreeTaskFilter {
  /**
   * When this flag is true, only tests that match the filter are shown in the tree.
   * Any parent nodes that contain at least one child that matches the filter are also shown.
   * If this flag is false, all parent nodes are shown if at least one child matches the filter.
   * **NOTE**: this flag is ignored if `matcher` is not provided.
   */
  showOnlyTests?: boolean
  matcher?: TreeTaskMatcher
}

export interface FilteredTests {
  failed: number
  success: number
  skipped: number
  running: number
}

export interface CollectFilteredTests extends FilteredTests {
  total: number
  ignored: number
  todo: number
}

export interface TaskTreeNode {
  id: string
  expandable: boolean
  expanded: boolean
}

export interface RootTreeNode extends TaskTreeNode {
  tasks: FileTreeNode[]
}

export interface UITaskTreeNode extends TaskTreeNode {
  name: string
  parentId: string
  mode: RunMode
  indent: number
  state?: TaskState
  duration?: number
}

export interface ParentTreeNode extends UITaskTreeNode {
  tasks: UITaskTreeNode[]
}

export interface FileTreeNode extends ParentTreeNode {
  filepath: string
  projectName: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
}

export interface Filter {
  failed: boolean
  success: boolean
  skipped: boolean
  onlyTests: boolean
}
