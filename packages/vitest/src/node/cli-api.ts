import { execa } from 'execa'
import type { UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig } from '../types'
import { ensurePackageInstalled } from '../utils'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
}

export async function startVitest(cliFilters: string[], options: CliOptions, viteOverrides?: ViteUserConfig) {
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= options.mode || 'test'

  if (options.run)
    options.watch = false

  if (!await ensurePackageInstalled('vite')) {
    process.exitCode = 1
    return false
  }

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  const ctx = await createVitest(options, viteOverrides)

  process.env.VITEST_MODE = ctx.config.watch ? 'WATCH' : 'RUN'

  if (ctx.config.env)
    Object.assign(process.env, ctx.config.env)

  if (ctx.config.coverage.enabled) {
    if (!await ensurePackageInstalled('c8')) {
      process.exitCode = 1
      return false
    }

    if (!process.env.NODE_V8_COVERAGE) {
      process.env.NODE_V8_COVERAGE = ctx.config.coverage.tempDirectory
      // thread enable test will exec in thread
      // so don't need to restarting Vitest
      if (!ctx.config.threads) {
        await ctx.server.close()
        const { exitCode } = await execa(process.argv0, process.argv.slice(1), { stdio: 'inherit', reject: false })
        process.exitCode = exitCode
        return false
      }
    }
  }

  if (ctx.config.environment && ctx.config.environment !== 'node') {
    if (!await ensurePackageInstalled(ctx.config.environment)) {
      process.exitCode = 1
      return false
    }
  }

  if (process.stdin.isTTY && ctx.config.watch)
    registerConsoleShortcuts(ctx)

  process.chdir(ctx.config.root)

  ctx.onServerRestarted(() => {
    // TODO: re-consider how to re-run the tests the server smartly
    ctx.start(cliFilters)
  })

  try {
    await ctx.start(cliFilters)
  }
  catch (e) {
    process.exitCode = 1
    await ctx.printError(e, true, 'Unhandled Error')
    ctx.error('\n\n')
    return false
  }

  if (!ctx.config.watch) {
    await ctx.exit()
    return !process.exitCode
  }

  return true
}
