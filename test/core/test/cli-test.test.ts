import { expect, test } from 'vitest'
import { createCLI } from '../../../packages/vitest/src/node/cli/cac.js'

const vitestCli = createCLI()

function getArguments(commands: string[]) {
  return vitestCli.parse(['node', '/index.js', ...commands], {
    run: false,
  }).options
}

const enabled = { enabled: true }
const disabled = { enabled: false }

function cli(options: Record<string, any>) {
  return {
    // cac always adds this option
    '--': [],
    // since we expose `color` as `no-color`, it is always exposed
    'color': true,
    ...options,
  }
}

test('top level nested options return boolean', async () => {
  expect(getArguments(['--coverage', '--browser', '--typecheck'])).toEqual(cli({
    coverage: enabled,
    browser: enabled,
    typecheck: enabled,
  }))
})

test('negated top level nested options return boolean', async () => {
  expect(getArguments(['--no-coverage', '--no-browser', '--no-typecheck'])).toEqual(cli({
    coverage: disabled,
    browser: disabled,
    typecheck: disabled,
  }))
})

test('nested coverage options have correct types', async () => {
  expect(getArguments([
    // booleans
    '--coverage.all',
    '--coverage.enabled=',
    'true',
    '--coverage.clean',
    'false',
    '--coverage.cleanOnRerun',
    'true',
    '--coverage.reportOnFailure',
    '--coverage.allowExternal',
    'false',
    '--coverage.skipFull',
    '--coverage.thresholds.autoUpdate',
    'true',
    '--coverage.thresholds.perFile',
    // even if non-boolean is set, it should be true
    '--coverage.thresholds.100',
    '25',

    // text
    '--coverage.provider',
    'v8',
    '--coverage.reporter',
    'text',
    '--coverage.reportsDirectory',
    '.\\dist\\coverage',
    '--coverage.customProviderModule',
    './folder/coverage.js',

    // array
    '--coverage.ignoreClassMethods',
    'method1',
    '--coverage.ignoreClassMethods',
    'method2',

    // numbers
    '--coverage.processingConcurrency',
    '2',

    '--coverage.thresholds.statements',
    '80',
    '--coverage.thresholds.lines',
    '100',
    '--coverage.thresholds.functions',
    '30',
    '--coverage.thresholds.branches',
    '25',
  ]).coverage).toEqual({
    enabled: true,
    reporter: 'text',
    all: true,
    provider: 'v8',
    clean: false,
    cleanOnRerun: true,
    reportsDirectory: 'dist/coverage',
    customProviderModule: 'folder/coverage.js',
    reportOnFailure: true,
    allowExternal: false,
    skipFull: true,
    ignoreClassMethods: ['method1', 'method2'],
    processingConcurrency: 2,
    thresholds: {
      statements: 80,
      lines: 100,
      functions: 30,
      branches: 25,
      perFile: true,
      autoUpdate: true,
      100: true,
    },
  })
})

test('correctly normalizes methods to be an array', async () => {
  expect(getArguments([
    '--coverage.ignoreClassMethods',
    'method2',
    '--coverage.include',
    'pattern',
    '--coverage.exclude',
    'pattern',
  ])).toMatchObject({
    coverage: {
      ignoreClassMethods: ['method2'],
      include: ['pattern'],
      exclude: ['pattern'],
    },
  })
})

test('all coverage enable options are working correctly', () => {
  expect(getArguments(['--coverage']).coverage).toEqual({ enabled: true })
  expect(getArguments(['--coverage.enabled', '--coverage.all=false']).coverage).toEqual({ enabled: true, all: false })
  expect(getArguments(['--coverage.enabled', '--coverage.all']).coverage).toEqual({ enabled: true, all: true })
})

test('fails when an array is passed down for a single value', async () => {
  expect(() => getArguments(['--coverage.provider', 'v8', '--coverage.provider', 'istanbul']))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Expected a single value for option "--coverage.provider <name>"]`)
})

test('even if coverage is boolean, don\'t fail', () => {
  expect(getArguments(['--coverage', '--coverage.provider', 'v8']).coverage).toEqual({
    enabled: true,
    provider: 'v8',
  })
})
