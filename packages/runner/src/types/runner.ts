import type { DiffOptions } from '@vitest/utils/diff'
import type {
  File,
  SequenceHooks,
  SequenceSetupFiles,
  Suite,
  Task,
  TaskResultPack,
  Test,
  TestContext,
} from './tasks'

/**
 * This is a subset of Vitest config that's required for the runner to work.
 */
export interface VitestRunnerConfig {
  root: string
  setupFiles: string[]
  name?: string
  passWithNoTests: boolean
  testNamePattern?: RegExp
  allowOnly?: boolean
  sequence: {
    shuffle?: boolean
    concurrent?: boolean
    seed: number
    hooks: SequenceHooks
    setupFiles: SequenceSetupFiles
  }
  chaiConfig?: {
    truncateThreshold?: number
  }
  maxConcurrency: number
  testTimeout: number
  hookTimeout: number
  retry: number
  includeTaskLocation?: boolean
  diffOptions?: DiffOptions
}

/**
 * Possible options to run a single file in a test.
 */
export interface FileSpecification {
  filepath: string
  testLocations: number[] | undefined
}

export type VitestRunnerImportSource = 'collect' | 'setup'

export interface VitestRunnerConstructor {
  new (config: VitestRunnerConfig): VitestRunner
}

export type CancelReason =
  | 'keyboard-input'
  | 'test-failure'
  | (string & Record<string, never>)

export interface VitestRunner {
  /**
   * First thing that's getting called before actually collecting and running tests.
   */
  onBeforeCollect?: (paths: string[]) => unknown
  /**
   * Called after the file task was created but not collected yet.
   */
  onCollectStart?: (file: File) => unknown
  /**
   * Called after collecting tests and before "onBeforeRun".
   */
  onCollected?: (files: File[]) => unknown

  /**
   * Called when test runner should cancel next test runs.
   * Runner should listen for this method and mark tests and suites as skipped in
   * "onBeforeRunSuite" and "onBeforeRunTask" when called.
   */
  onCancel?: (reason: CancelReason) => unknown

  /**
   * Called before running a single test. Doesn't have "result" yet.
   */
  onBeforeRunTask?: (test: Task) => unknown
  /**
   * Called before actually running the test function. Already has "result" with "state" and "startTime".
   */
  onBeforeTryTask?: (
    test: Task,
    options: { retry: number; repeats: number }
  ) => unknown
  /**
   * When the task has finished running, but before cleanup hooks are called
   */
  onTaskFinished?: (test: Test) => unknown
  /**
   * Called after result and state are set.
   */
  onAfterRunTask?: (test: Task) => unknown
  /**
   * Called right after running the test function. Doesn't have new state yet. Will not be called, if the test function throws.
   */
  onAfterTryTask?: (
    test: Task,
    options: { retry: number; repeats: number }
  ) => unknown

  /**
   * Called before running a single suite. Doesn't have "result" yet.
   */
  onBeforeRunSuite?: (suite: Suite) => unknown
  /**
   * Called after running a single suite. Has state and result.
   */
  onAfterRunSuite?: (suite: Suite) => unknown

  /**
   * If defined, will be called instead of usual Vitest suite partition and handling.
   * "before" and "after" hooks will not be ignored.
   */
  runSuite?: (suite: Suite) => Promise<void>
  /**
   * If defined, will be called instead of usual Vitest handling. Useful, if you have your custom test function.
   * "before" and "after" hooks will not be ignored.
   */
  runTask?: (test: Task) => Promise<void>

  /**
   * Called, when a task is updated. The same as "onTaskUpdate" in a reporter, but this is running in the same thread as tests.
   */
  onTaskUpdate?: (task: TaskResultPack[]) => Promise<void>

  /**
   * Called before running all tests in collected paths.
   */
  onBeforeRunFiles?: (files: File[]) => unknown
  /**
   * Called right after running all tests in collected paths.
   */
  onAfterRunFiles?: (files: File[]) => unknown
  /**
   * Called when new context for a test is defined. Useful if you want to add custom properties to the context.
   * If you only want to define custom context, consider using "beforeAll" in "setupFiles" instead.
   *
   * @see https://vitest.dev/advanced/runner#your-task-function
   */
  extendTaskContext?: (context: TestContext) => TestContext
  /**
   * Called when test and setup files are imported. Can be called in two situations: when collecting tests and when importing setup files.
   */
  importFile: (filepath: string, source: VitestRunnerImportSource) => unknown
  /**
   * Function that is called when the runner attempts to get the value when `test.extend` is used with `{ injected: true }`
   */
  injectValue?: (key: string) => unknown
  /**
   * Publicly available configuration.
   */
  config: VitestRunnerConfig
  /**
   * The name of the current pool. Can affect how stack trace is inferred on the server side.
   */
  pool?: string
}
