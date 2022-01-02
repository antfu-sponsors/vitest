import { resolve } from 'pathe'
import type { ResolvedConfig as ResolvedViteConfig, UserConfig as ViteUserConfig } from 'vite'

import type { ApiConfig, ResolvedConfig, UserConfig } from '../types'
import { defaultExclude, defaultInclude, defaultPort } from '../constants'
import { resolveC8Options } from '../coverage'
import { deepMerge, toArray } from '../utils'

export function resolveApiConfig<Options extends ApiConfig & UserConfig>(
  fromCli: boolean,
  options: Options,
  viteOverrides?: ViteUserConfig,
): ApiConfig | undefined {
  let api: ApiConfig | undefined
  // eslint-disable-next-line no-console
  console.log(options)
  if (options.api === true)
    api = { port: defaultPort }
  else if (typeof options.api === 'number')
    api = { port: options.api }

  if (fromCli) {
    if (api) {
      if (options.port)
        api.port = options.port

      if (options.strictPort)
        api.strictPort = options.strictPort

      if (options.host)
        api.host = options.host
    }
  }
  else if (typeof options.api === 'object') {
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

    if (viteOverrides)
      viteOverrides.server = Object.assign(viteOverrides.server || {}, api)
  }

  // eslint-disable-next-line no-console
  console.log(api)
  // eslint-disable-next-line no-console
  console.log(viteOverrides?.server)
  return api
}

export function resolveConfig(
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom)
    options.environment = 'happy-dom'

  const resolved = {
    ...deepMerge(options, viteConfig.test),
    root: viteConfig.root,
  } as ResolvedConfig

  resolved.coverage = resolveC8Options(resolved.coverage, resolved.root)

  resolved.depsInline = [...resolved.deps?.inline || []]
  resolved.depsExternal = [...resolved.deps?.external || []]
  resolved.fallbackCJS = resolved.deps?.fallbackCJS ?? true
  resolved.interpretDefault = resolved.deps?.interpretDefault ?? true

  resolved.environment = resolved.environment || 'node'
  resolved.threads = resolved.threads ?? true

  resolved.clearMocks = resolved.clearMocks ?? false
  resolved.restoreMocks = resolved.restoreMocks ?? false
  resolved.mockReset = resolved.mockReset ?? false

  resolved.include = resolved.include ?? defaultInclude
  resolved.exclude = resolved.exclude ?? defaultExclude

  resolved.testTimeout = resolved.testTimeout ?? 5_000
  resolved.hookTimeout = resolved.hookTimeout ?? 10_000

  resolved.isolate = resolved.isolate ?? true

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  resolved.watchIgnore = resolved.watchIgnore ?? [/\/node_modules\//, /\/dist\//]

  const CI = !!process.env.CI
  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    updateSnapshot: CI && !UPDATE_SNAPSHOT
      ? 'none'
      : UPDATE_SNAPSHOT
        ? 'all'
        : 'new',
  }

  if (process.env.VITEST_MAX_THREADS)
    resolved.maxThreads = parseInt(process.env.VITEST_MAX_THREADS)

  if (process.env.VITEST_MIN_THREADS)
    resolved.minThreads = parseInt(process.env.VITEST_MIN_THREADS)

  resolved.setupFiles = Array.from(resolved.setupFiles || [])
    .map(i => resolve(resolved.root, i))

  // the server has been created, we don't need to override vite.server options
  resolved.api = resolveApiConfig(false, options)

  if (options.related)
    resolved.related = toArray(options.related).map(file => resolve(resolved.root, file))

  return resolved
}
