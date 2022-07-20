import { resolveModule } from 'local-pkg'
import { normalize, resolve } from 'pathe'
import c from 'picocolors'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'

import type { ApiConfig, ResolvedConfig, UserConfig } from '../types'
import { defaultPort } from '../constants'
import { configDefaults } from '../defaults'
import { resolveC8Options } from '../integrations/coverage'
import { toArray } from '../utils'
import { VitestCache } from './cache'
import { BaseSequencer } from './sequencers/BaseSequencer'
import { RandomSequencer } from './sequencers/RandomSequencer'

const extraInlineDeps = [
  /^(?!.*(?:node_modules)).*\.mjs$/,
  /^(?!.*(?:node_modules)).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
  // Vitest
  /\/vitest\/dist\//,
  // yarn's .store folder
  /vitest-virtual-\w+\/dist/,
  // cnpm
  /@vitest\/dist/,
  // Nuxt
  '@nuxt/test-utils',
]

export function resolveApiConfig<Options extends ApiConfig & UserConfig>(
  options: Options,
): ApiConfig | undefined {
  let api: ApiConfig | undefined

  if ((options.ui || options.browser) && !options.api)
    api = { port: defaultPort }
  else if (options.api === true)
    api = { port: defaultPort }
  else if (typeof options.api === 'number')
    api = { port: options.api }

  if (typeof options.api === 'object') {
    if (api) {
      if (options.api.port)
        api.port = options.api.port
      if (options.api.strictPort)
        api.strictPort = options.api.strictPort
      if (options.api.host)
        api.host = options.api.host
    }
    else {
      api = { ...options.api }
    }
  }

  if (api) {
    if (!api.port)
      api.port = defaultPort
  }

  return api
}

export function resolveConfig(
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom) {
    if (
      viteConfig.test?.environment != null
      && viteConfig.test!.environment !== 'happy-dom'
    ) {
      console.warn(
        c.yellow(
          `${c.inverse(c.yellow(' Vitest '))} Your config.test.environment ("${
            viteConfig.test.environment
          }") conflicts with --dom flag ("happy-dom"), ignoring "${
            viteConfig.test.environment
          }"`,
        ),
      )
    }

    options.environment = 'happy-dom'
  }

  const resolved = {
    ...configDefaults,
    ...options,
    root: viteConfig.root,
  } as ResolvedConfig

  if (viteConfig.base !== '/')
    resolved.base = viteConfig.base

  resolved.coverage = resolveC8Options(options.coverage || {}, resolved.root)

  if (options.shard) {
    if (resolved.watch)
      throw new Error('You cannot use --shard option with enabled watch')

    const [indexString, countString] = options.shard.split('/')
    const index = Math.abs(parseInt(indexString, 10))
    const count = Math.abs(parseInt(countString, 10))

    if (isNaN(count) || count <= 0)
      throw new Error('--shard <count> must be a positive number')

    if (isNaN(index) || index <= 0 || index > count)
      throw new Error('--shard <index> must be a positive number less then <count>')

    resolved.shard = { index, count }
  }

  resolved.deps = resolved.deps || {}
  // vitenode will try to import such file with native node,
  // but then our mocker will not work properly
  if (resolved.deps.inline !== true) {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore ssr is not typed in Vite 2, but defined in Vite 3, so we can't use expect-error
    const ssrOptions = viteConfig.ssr

    if (ssrOptions?.noExternal === true && resolved.deps.inline == null) {
      resolved.deps.inline = true
    }
    else {
      resolved.deps.inline ??= []
      resolved.deps.inline.push(...extraInlineDeps)
    }
  }

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  const CI = !!process.env.CI
  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    snapshotFormat: resolved.snapshotFormat || {},
    updateSnapshot: CI && !UPDATE_SNAPSHOT
      ? 'none'
      : UPDATE_SNAPSHOT
        ? 'all'
        : 'new',
    resolveSnapshotPath: options.resolveSnapshotPath,
  }

  if (options.resolveSnapshotPath)
    delete (resolved as UserConfig).resolveSnapshotPath

  if (process.env.VITEST_MAX_THREADS)
    resolved.maxThreads = parseInt(process.env.VITEST_MAX_THREADS)

  if (process.env.VITEST_MIN_THREADS)
    resolved.minThreads = parseInt(process.env.VITEST_MIN_THREADS)

  resolved.setupFiles = toArray(resolved.setupFiles || []).map(file =>
    normalize(
      resolveModule(file, { paths: [resolved.root] })
        ?? resolve(resolved.root, file),
    ),
  )

  // the server has been created, we don't need to override vite.server options
  resolved.api = resolveApiConfig(options)

  if (options.related)
    resolved.related = toArray(options.related).map(file => resolve(resolved.root, file))

  resolved.reporters = Array.from(new Set([
    ...toArray(resolved.reporters),
    // @ts-expect-error from CLI
    ...toArray(resolved.reporter),
  ])).filter(Boolean)
  if (!resolved.reporters.length)
    resolved.reporters.push('default')

  if (resolved.changed)
    resolved.passWithNoTests ??= true

  resolved.css ??= {}
  if (typeof resolved.css === 'object')
    resolved.css.include ??= [/\.module\./]

  resolved.cache ??= { dir: '' }
  if (resolved.cache)
    resolved.cache.dir = VitestCache.resolveCacheDir(resolved.root, resolved.cache.dir)

  if (!resolved.sequence?.sequencer) {
    resolved.sequence ??= {} as any
    // CLI flag has higher priority
    resolved.sequence.sequencer = resolved.sequence.shuffle
      ? RandomSequencer
      : BaseSequencer
  }

  return resolved
}
