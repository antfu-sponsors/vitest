// TODO: deprecate <reference types="vitest" /> in favor of `<reference types="vitest/config" />`
import '../node/types/vite'
import '../types/global'

import type {
  CollectLineNumbers as CollectLineNumbers_,
  CollectLines as CollectLines_,
  Context as Context_,
  RawErrsMap as RawErrsMap_,
  RootAndTarget as RootAndTarget_,
  TscErrorInfo as TscErrorInfo_,
} from '../typecheck/types'

import type {
  ArgumentsType as ArgumentsType_,
  Arrayable as Arrayable_,
  Awaitable as Awaitable_,
  Constructable as Constructable_,
  MutableArray as MutableArray_,
  Nullable as Nullable_,
  OnServerRestartHandler as OnServerRestartHandler_,
} from '../types/general'

import type {
  EnvironmentReturn as EnvironmentReturn_,
  Environment as Environment_,
  ResolvedTestEnvironment as ResolvedTestEnvironment_,
  VmEnvironmentReturn as VmEnvironmentReturn_,
} from '../types/environment'

import type {
  BaseCoverageOptions as BaseCoverageOptions_,
  CoverageIstanbulOptions as CoverageIstanbulOptions_,
  CoverageOptions as CoverageOptions_,
  CoverageProviderModule as CoverageProviderModule_,
  CoverageProviderName,
  CoverageProvider as CoverageProvider_,
  CoverageReporter as CoverageReporter_,
  CoverageV8Options as CoverageV8Options_,
  CustomProviderOptions as CustomProviderOptions_,
  ReportContext as ReportContext_,
  ResolvedCoverageOptions as ResolvedCoverageOptions_,
} from '../node/types/coverage'

import type {
  /** @deprecated import from `vitest/node` instead */
  Reporter as Reporter_,
} from '../node/types/reporter'
import type {
  /** @deprecated import from `vitest/node` instead */
  Vitest as Vitest_,
} from '../node/core'
import type {
  ApiConfig as ApiConfig_,
  BrowserConfigOptions as BrowserConfigOptions_,
  BrowserScript as BrowserScript_,
  BuiltinEnvironment as BuiltinEnvironment_,
  CSSModuleScopeStrategy as CSSModuleScopeStrategy_,
  DepsOptimizationOptions as DepsOptimizationOptions_,
  EnvironmentOptions as EnvironmentOptions_,
  HappyDOMOptions as HappyDOMOptions_,
  InlineConfig as InlineConfig_,
  JSDOMOptions as JSDOMOptions_,
  PoolOptions as PoolOptions_,
  Pool as Pool_,
  ProjectConfig as ProjectConfig_,
  ResolvedConfig as ResolvedConfig_,
  SequenceHooks as SequenceHooks_,
  SequenceSetupFiles as SequenceSetupFiles_,
  TransformModePatterns as TransformModePatterns_,
  TypecheckConfig as TypecheckConfig_,
  UserConfig as UserConfig_,
  UserWorkspaceConfig as UserWorkspaceConfig_,
  VitestEnvironment as VitestEnvironment_,
  VitestRunMode as VitestRunMode_,
} from '../node/types/config'
import type {
  BenchmarkUserOptions as BenchmarkUserOptions_,
} from '../node/types/benchmark'

import type { SerializedSpec } from '../runtime/types/utils'

export {
  suite,
  test,
  describe,
  it,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  onTestFailed,
  onTestFinished,
} from '@vitest/runner'
export { bench } from '../runtime/benchmark'
export { expectTypeOf } from '../typecheck/expectTypeOf'
export { assertType } from '../typecheck/assertType'

export { runOnce, isFirstRun } from '../integrations/run-once'
export { createExpect, assert, should, chai, expect } from '../integrations/chai'
export { vi, vitest } from '../integrations/vi'
export { getRunningMode, isWatchMode } from '../integrations/utils'
export { inject } from '../integrations/inject'

export type { VitestUtils } from '../integrations/vi'

export type { ExpectTypeOf } from '../typecheck/expectTypeOf'
export type { AssertType } from '../typecheck/assertType'

/** @deprecated import `TypeCheckRawErrorsMap` from `vitest/node` instead */
export type RawErrsMap = RawErrsMap_
/** @deprecated import `TypeCheckErrorInfo` from `vitest/node` instead */
export type TscErrorInfo = TscErrorInfo_
/** @deprecated import `TypeCheckCollectLineNumbers` from `vitest/node` instead */
export type CollectLineNumbers = CollectLineNumbers_
/** @deprecated import `TypeCheckCollectLines` from `vitest/node` instead */
export type CollectLines = CollectLines_
/** @deprecated import `TypeCheckRootAndTarget` from `vitest/node` instead */
export type RootAndTarget = RootAndTarget_
/** @deprecated import `TypeCheckContext` from `vitest/node` instead */
export type Context = Context_

export type {
  RunMode,
  TaskState,
  TaskBase,
  TaskResult,
  TaskResultPack,
  Suite,
  File,
  Test,
  Task,
  DoneCallback,
  TestFunction,
  TestOptions,
  TestAPI,
  SuiteAPI,
  HookListener,
  HookCleanupCallback,
  SuiteHooks,
  SuiteCollector,
  SuiteFactory,
  RuntimeContext,
  TestContext,
  TaskContext,
  ExtendedContext,
  Custom,
  TaskCustomOptions,
  OnTestFailedHandler,
  TaskMeta,
} from '@vitest/runner'
export type {
  RuntimeRPC,
  RunnerRPC,
} from '../types/rpc'
export type {
  SnapshotData,
  SnapshotUpdateState,
  SnapshotStateOptions,
  SnapshotMatchOptions,
  SnapshotResult,
  UncheckedSnapshot,
  SnapshotSummary,
  SnapshotSerializer,
} from '@vitest/snapshot'

export type {
  ResolveIdFunction,
  WorkerRPC,
  WorkerGlobalState,
  ContextTestEnvironment,
  ContextRPC,
} from '../types/worker'
export type {
  /** @deprecated import from `vitest/node` instead */
  WorkerContext,
} from '../node/types/worker'

/** @deprecated do not use, internal helper */
export type Awaitable<T> = Awaitable_<T>
/** @deprecated do not use, internal helper */
export type Nullable<T> = Nullable_<T>
/** @deprecated do not use, internal helper */
export type Arrayable<T> = Arrayable_<T>
/** @deprecated do not use, internal helper */
export type ArgumentsType<T> = ArgumentsType_<T>
/** @deprecated do not use, internal helper */
export type MutableArray<T extends readonly any[]> = MutableArray_<T>
/** @deprecated do not use, internal helper */
export type Constructable = Constructable_
/** @deprecated import from `vitest/node` instead */
export type OnServerRestartHandler = OnServerRestartHandler_

export type {
  ErrorWithDiff,
  ParsedStack,
  ModuleCache,
  UserConsoleLog,
  ModuleGraphData,
  ProvidedContext,
  AfterSuiteRunMeta,
} from '../types/general'

/** @deprecated import from `vitest/environments` instead */
export type EnvironmentReturn = EnvironmentReturn_
/** @deprecated import from `vitest/environments` instead */
export type VmEnvironmentReturn = VmEnvironmentReturn_
/** @deprecated import from `vitest/environments` instead */
export type Environment = Environment_
/** @deprecated do not use it */
export type ResolvedTestEnvironment = ResolvedTestEnvironment_

/** @deprecated import from `vitest/node` instead */
export type CoverageProvider = CoverageProvider_
/** @deprecated import from `vitest/node` instead */
export type ReportContext = ReportContext_
/** @deprecated import from `vitest/node` instead */
export type CoverageProviderModule = CoverageProviderModule_
/** @deprecated import from `vitest/node` instead */
export type CoverageReporter = CoverageReporter_
/** @deprecated import from `vitest/node` instead */
export type CoverageOptions<T extends CoverageProviderName = CoverageProviderName> = CoverageOptions_<T>
/** @deprecated import from `vitest/node` instead */
export type ResolvedCoverageOptions<T extends CoverageProviderName = CoverageProviderName> = ResolvedCoverageOptions_<T>
/** @deprecated import from `vitest/node` instead */
export type BaseCoverageOptions = BaseCoverageOptions_
/** @deprecated import from `vitest/node` instead */
export type CoverageIstanbulOptions = CoverageIstanbulOptions_
/** @deprecated import from `vitest/node` instead */
export type CoverageV8Options = CoverageV8Options_
/** @deprecated import from `vitest/node` instead */
export type CustomProviderOptions = CustomProviderOptions_

export type { CancelReason } from '@vitest/runner'
export type { DiffOptions } from '@vitest/utils/diff'
export type {
  MockedFunction,
  MockedObject,
  MockInstance,
  Mock,
  MockContext,
  Mocked,
  MockedClass,
} from '../integrations/spy'
export type { BrowserUI } from '../types/ui'

/** @deprecated import from `vitest/node` instead */
export type Reporter = Reporter_
/** @deprecated import from `vitest/node` instead */
export type Vitest = Vitest_

export type {
  ExpectStatic,
  AsymmetricMatchersContaining,
  JestAssertion,
  Assertion,
  ExpectPollOptions,
} from '@vitest/expect'

export type {
  SerializedConfig,
  RuntimeConfig,
  SerializedCoverageConfig,
} from '../runtime/config'

/** @deprecated import from `vitest/node` instead */
export type BrowserScript = BrowserScript_
/** @deprecated import from `vitest/node` instead */
export type BrowserConfigOptions = BrowserConfigOptions_
/** @deprecated import from `vitest/node` instead */
export type SequenceHooks = SequenceHooks_
/** @deprecated import from `vitest/node` instead */
export type SequenceSetupFiles = SequenceSetupFiles_
/** @deprecated import from `vitest/node` instead */
export type BuiltinEnvironment = BuiltinEnvironment_
/** @deprecated import from `vitest/node` instead */
export type VitestEnvironment = VitestEnvironment_
/** @deprecated import from `vitest/node` instead */
export type Pool = Pool_
/** @deprecated import from `vitest/node` instead */
export type PoolOptions = PoolOptions_
/** @deprecated import from `vitest/node` instead */
export type CSSModuleScopeStrategy = CSSModuleScopeStrategy_
/** @deprecated import from `vitest/node` instead */
export type ApiConfig = ApiConfig_
/** @deprecated import from `vitest/node` instead */
export type JSDOMOptions = JSDOMOptions_
/** @deprecated import from `vitest/node` instead */
export type HappyDOMOptions = HappyDOMOptions_
/** @deprecated import from `vitest/node` instead */
export type EnvironmentOptions = EnvironmentOptions_
/** @deprecated import from `vitest/node` instead */
export type VitestRunMode = VitestRunMode_
/** @deprecated import from `vitest/node` instead */
export type DepsOptimizationOptions = DepsOptimizationOptions_
/** @deprecated import from `vitest/node` instead */
export type TransformModePatterns = TransformModePatterns_
/** @deprecated import from `vitest/node` instead */
export type InlineConfig = InlineConfig_
/** @deprecated import from `vitest/node` instead */
export type TypecheckConfig = TypecheckConfig_
/** @deprecated import from `vitest/node` instead */
export type UserConfig = UserConfig_
/** @deprecated import from `vitest/node` instead */
export type ResolvedConfig = ResolvedConfig_
/** @deprecated import from `vitest/node` instead */
export type ProjectConfig = ProjectConfig_
/** @deprecated import from `vitest/node` instead */
export type UserWorkspaceConfig = UserWorkspaceConfig_

export type {
  Benchmark,
  BenchmarkResult,
  BenchFunction,
  BenchmarkAPI,
  BenchTaskResult,
  BenchOptions,
  BenchFactory,
  BenchTask,
} from '../runtime/types/benchmark'

/** @deprecated use `SerializedSpec` instead */
export type SerializableSpec = SerializedSpec
export type { SerializedSpec }

/** @deprecated import from `vitest/node` instead */
export type BenchmarkUserOptions = BenchmarkUserOptions_

export type {
  TransformResultWithSource,
  WebSocketHandlers,
  WebSocketEvents,
  WebSocketRPC,
} from '../api/types'
