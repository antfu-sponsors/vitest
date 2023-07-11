import { assertType, test } from 'vitest'
import type { CoverageProviderModule, ResolvedCoverageOptions, Vitest } from 'vitest'
import type { defineConfig } from 'vitest/config'

type NarrowToTestConfig<T> = T extends { test?: any } ? NonNullable<T['test']> : never
type Configuration = NarrowToTestConfig<(Parameters<typeof defineConfig>[0])>
type Coverage = NonNullable<Configuration['coverage']>

test('providers, built-in', () => {
  assertType<Coverage>({ provider: 'v8' })
  assertType<Coverage>({ provider: 'istanbul' })

  // @ts-expect-error -- String options must be known ones only
  assertType<Coverage>({ provider: 'unknown-provider' })
})

test('providers, custom', () => {
  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'custom-provider-module.ts',
  })
})

test('provider options, generic', () => {
  assertType<Coverage>({
    provider: 'v8',
    enabled: true,
    include: ['string'],
    watermarks: {
      functions: [80, 95],
      lines: [80, 95],
    },
  })

  assertType<Coverage>({
    provider: 'istanbul',
    enabled: true,
    include: ['string'],
    watermarks: {
      statements: [80, 95],
    },
  })
})

test('provider specific options, v8', () => {
  assertType<Coverage>({
    provider: 'v8',
    100: true,
  })

  assertType<Coverage>({
    provider: 'v8',
    // @ts-expect-error -- Istanbul-only option is not allowed
    ignoreClassMethods: ['string'],
  })
})

test('provider specific options, istanbul', () => {
  assertType<Coverage>({
    provider: 'istanbul',
    ignoreClassMethods: ['string'],
  })

  assertType<Coverage>({
    provider: 'istanbul',
    // @ts-expect-error -- V8-only option is not allowed
    100: true,
  })
})

test('provider specific options, custom', () => {
  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'custom-provider-module.ts',
    enabled: true,
  })

  // @ts-expect-error --  customProviderModule is required
  assertType<Coverage>({ provider: 'custom' })

  assertType<Coverage>({
    provider: 'custom',
    customProviderModule: 'some-module',

    // @ts-expect-error --  typings of BaseCoverageOptions still apply
    enabled: 'not boolean',
  })
})

test('provider module', () => {
  assertType<CoverageProviderModule>({
    getProvider() {
      return {
        name: 'custom-provider',
        initialize(_: Vitest) {},
        resolveOptions(): ResolvedCoverageOptions {
          return {
            clean: true,
            cleanOnRerun: true,
            enabled: true,
            exclude: ['string'],
            extension: ['string'],
            reporter: [['html', {}], ['json', { file: 'string' }]],
            reportsDirectory: 'string',
            reportOnFailure: true,
          }
        },
        clean(_: boolean) {},
        onBeforeFilesRun() {},
        onAfterSuiteRun({ coverage: _coverage }) {},
        reportCoverage() {},
        onFileTransform(_code: string, _id: string, ctx) {
          ctx.getCombinedSourcemap()
        },
      }
    },
    takeCoverage() {},
    startCoverage() {},
    stopCoverage() {},
  })
})

test('reporters, single', () => {
  assertType<Coverage>({ reporter: 'clover' })
  assertType<Coverage>({ reporter: 'cobertura' })
  assertType<Coverage>({ reporter: 'html-spa' })
  assertType<Coverage>({ reporter: 'html' })
  assertType<Coverage>({ reporter: 'json-summary' })
  assertType<Coverage>({ reporter: 'json' })
  assertType<Coverage>({ reporter: 'lcov' })
  assertType<Coverage>({ reporter: 'lcovonly' })
  assertType<Coverage>({ reporter: 'none' })
  assertType<Coverage>({ reporter: 'teamcity' })
  assertType<Coverage>({ reporter: 'text-lcov' })
  assertType<Coverage>({ reporter: 'text-summary' })
  assertType<Coverage>({ reporter: 'text' })

  // @ts-expect-error -- String reporters must be known built-in's
  assertType<Coverage>({ reporter: 'unknown-reporter' })
})

test('reporters, multiple', () => {
  assertType<Coverage>({
    reporter: [
      'clover',
      'cobertura',
      'html-spa',
      'html',
      'json-summary',
      'json',
      'lcov',
      'lcovonly',
      'none',
      'teamcity',
      'text-lcov',
      'text-summary',
      'text',
    ],
  })

  // @ts-expect-error -- List of string reporters must be known built-in's
  assertType<Coverage>({ reporter: ['unknown-reporter'] })

  // @ts-expect-error -- ... and all reporters must be known
  assertType<Coverage>({ reporter: ['html', 'json', 'unknown-reporter'] })
})

test('reporters, with options', () => {
  assertType<Coverage>({
    reporter: [
      ['clover', { projectRoot: 'string', file: 'string' }],
      ['cobertura', { projectRoot: 'string', file: 'string' }],
      ['html-spa', { metricsToShow: ['branches', 'functions'], verbose: true, subdir: 'string' }],
      ['html', { verbose: true, subdir: 'string' }],
      ['json-summary', { file: 'string' }],
      ['json', { file: 'string' }],
      ['lcov', { projectRoot: 'string', file: 'string' }],
      ['lcovonly', { projectRoot: 'string', file: 'string' }],
      ['none'],
      ['teamcity', { blockName: 'string' }],
      ['text-lcov', { projectRoot: 'string' }],
      ['text-summary', { file: 'string' }],
      ['text', { skipEmpty: true, skipFull: true, maxCols: 1 }],
    ],
  })

  assertType<Coverage>({
    reporter: [
      ['html', { subdir: 'string' }],
      ['json'],
      ['lcov', { projectRoot: 'string' }],
    ],
  })

  assertType<Coverage>({
    reporter: [
      // @ts-expect-error -- teamcity report option on html reporter
      ['html', { blockName: 'string' }],

      // @ts-expect-error -- html-spa report option on json reporter
      ['json', { metricsToShow: ['branches'] }],

      // @ts-expect-error -- second value should be object even though TS intellisense prompts types of reporters
      ['lcov', 'html-spa'],
    ],
  })
})

test('reporters, mixed variations', () => {
  assertType<Coverage>({
    reporter: [
      'clover',
      ['cobertura'],
      ['html-spa', {}],
      ['html', { verbose: true, subdir: 'string' }],
    ],
  })
})
