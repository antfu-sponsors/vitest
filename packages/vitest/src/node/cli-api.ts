import { resolve } from 'pathe'
import type { UserConfig as ViteUserConfig } from 'vite'
import { EXIT_CODE_RESTART } from '../constants'
import { CoverageProviderMap } from '../integrations/coverage'
import { getEnvPackageName } from '../integrations/env'
import type { UserConfig, Vitest, VitestRunMode } from '../types'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'
import type { VitestOptions } from './core'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
  /**
   * Retry the test suite if it crashes due to a segfault (default: true)
   */
  segfaultRetry?: number
  /**
   * Removes colors from the console output
   */
  color?: boolean
}

/**
 * Start Vitest programmatically
 *
 * Returns a Vitest instance if initialized successfully.
 */
export async function startVitest(
  mode: VitestRunMode,
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest | undefined> {
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= 'test'

  if (options.run)
    options.watch = false

  // this shouldn't affect _application root_ that can be changed inside config
  const root = resolve(options.root || process.cwd())

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  // running "vitest --browser", assumes browser name is set in the config
  if (typeof options.browser === 'boolean')
    options.browser = { enabled: options.browser } as any

  // running "vitest --browser=chrome"
  if (typeof options.browser === 'string')
    options.browser = { enabled: true, name: options.browser }

  // running "vitest --browser.headless"
  if (typeof options.browser === 'object' && !('enabled' in options.browser))
    options.browser.enabled = true

  if (typeof options.typecheck === 'boolean')
    options.typecheck = { enabled: true }

  if (typeof options.typecheck?.only === 'boolean') {
    options.typecheck ??= {}
    options.typecheck.only = true
    options.typecheck.enabled = true
  }

  const ctx = await createVitest(mode, options, viteOverrides, vitestOptions)

  if (mode === 'test' && ctx.config.coverage.enabled) {
    const provider = ctx.config.coverage.provider || 'v8'
    const requiredPackages = CoverageProviderMap[provider]

    if (requiredPackages) {
      if (!await ctx.packageInstaller.ensureInstalled(requiredPackages, root)) {
        process.exitCode = 1
        return ctx
      }
    }
  }

  const environmentPackage = getEnvPackageName(ctx.config.environment)

  if (environmentPackage && !await ctx.packageInstaller.ensureInstalled(environmentPackage, root)) {
    process.exitCode = 1
    return ctx
  }

  let stdinCleanup
  if (process.stdin.isTTY && ctx.config.watch)
    stdinCleanup = registerConsoleShortcuts(ctx)

  ctx.onServerRestart((reason) => {
    ctx.report('onServerRestart', reason)

    // if it's in a CLI wrapper, exit with a special code to request restart
    if (process.env.VITEST_CLI_WRAPPER)
      process.exit(EXIT_CODE_RESTART)
  })

  ctx.onAfterSetServer(() => {
    ctx.start(cliFilters)
  })

  try {
    await ctx.start(cliFilters)
  }
  catch (e) {
    process.exitCode = 1
    await ctx.logger.printError(e, { fullStack: true, type: 'Unhandled Error' })
    ctx.logger.error('\n\n')
    return ctx
  }

  if (ctx.shouldKeepServer())
    return ctx

  stdinCleanup?.()
  await ctx.close()
  return ctx
}
