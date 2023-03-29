import { promises as fs } from 'node:fs'
import fg from 'fast-glob'
import { dirname, toNamespacedPath } from 'pathe'
import { createServer } from 'vite'
import type { ViteDevServer, InlineConfig as ViteInlineConfig } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { createBrowserServer } from '../integrations/browser/server'
import type { ArgumentsType, Reporter, ResolvedConfig, UserConfig, Vitest } from '../types'
import { deepMerge, hasFailed } from '../utils'
import { Typechecker } from '../typecheck/typechecker'
import { isBrowserEnabled, resolveConfig } from './config'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import { VitestServer } from './server'

interface InitializeOptions {
  server?: VitestServer
  runner?: ViteNodeRunner
}

export async function initializeWorkspace(workspacePath: string, ctx: Vitest) {
  const workspace = new VitestWorkspace(workspacePath, ctx)

  const configPath = workspacePath.endsWith('/')
    ? false
    : workspacePath

  const config: ViteInlineConfig = {
    root: dirname(workspacePath),
    logLevel: 'error',
    configFile: configPath,
    // this will make "mode" = "test" inside defineConfig
    mode: ctx.config.mode || process.env.NODE_ENV,
    plugins: WorkspaceVitestPlugin(workspace),
  }

  const server = await createServer(config)

  // optimizer needs .listen() to be called
  if (ctx.config.api?.port || ctx.config.deps?.experimentalOptimizer?.enabled)
    await server.listen()
  else
    await server.pluginContainer.buildStart({})

  return workspace
}

// notes:
// 1. Vitest considers only top-level reportes and coverage reporters
// 2. Vitest disables watcher in workspaces, only top-level watcher is used
export class VitestWorkspace {
  configOverride: Partial<ResolvedConfig> | undefined

  config!: ResolvedConfig
  server!: ViteDevServer
  vitenode!: VitestServer
  runner!: ViteNodeRunner
  browser: ViteDevServer = undefined!
  typechecker?: Typechecker

  closingPromise: Promise<unknown> | undefined

  constructor(
    public path: string,
    public ctx: Vitest,
  ) {}

  getName() {
    return this.config.name || this.path
  }

  async globTestFiles(filters: string[] = []) {
    const { dir, root } = this.config

    const testFiles = await this.globAllTestFiles(this.config, dir || root)

    return this.filterFiles(testFiles, filters)
  }

  async globAllTestFiles(config: ResolvedConfig, cwd: string) {
    const { include, exclude, includeSource } = config

    const testFiles = await this.globFiles(include, exclude, cwd)

    if (includeSource) {
      const files = await this.globFiles(includeSource, exclude, cwd)

      await Promise.all(files.map(async (file) => {
        try {
          const code = await fs.readFile(file, 'utf-8')
          if (this.ctx.isInSourceTestFile(code))
            testFiles.push(file)
        }
        catch {
          return null
        }
      }))
    }

    return testFiles
  }

  async globFiles(include: string[], exclude: string[], cwd: string) {
    const globOptions: fg.Options = {
      absolute: true,
      dot: true,
      cwd,
      ignore: exclude,
    }

    return fg(include, globOptions)
  }

  filterFiles(testFiles: string[], filters: string[] = []) {
    if (filters.length && process.platform === 'win32')
      filters = filters.map(f => toNamespacedPath(f))

    if (filters.length)
      return testFiles.filter(i => filters.some(f => i.includes(f)))

    return testFiles
  }

  async initBrowserServer(options: UserConfig) {
    if (!this.isBrowserEnabled())
      return
    await this.browser?.close()
    this.browser = await createBrowserServer(this.ctx, options)
  }

  async setServer(options: UserConfig, server: ViteDevServer, params: InitializeOptions = {}) {
    this.config = resolveConfig(this.ctx.mode, options, server.config)
    this.server = server

    this.vitenode = params.server ?? new VitestServer(server, this.config)
    const node = this.vitenode
    this.runner = params.runner ?? new ViteNodeRunner({
      root: server.config.root,
      base: server.config.base,
      fetchModule(id: string) {
        return node.fetchModule(id)
      },
      resolveId(id: string, importer?: string) {
        return node.resolveId(id, importer)
      },
    })

    await this.initBrowserServer(options)
  }

  async report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    return this.ctx.report(name, ...args)
  }

  async typecheck(filters: string[] = []) {
    const { dir, root } = this.config
    const { include, exclude } = this.config.typecheck
    const testsFilesList = this.filterFiles(await this.globFiles(include, exclude, dir || root), filters)
    const checker = new Typechecker(this, testsFilesList)
    this.typechecker = checker
    checker.onParseEnd(async ({ files, sourceErrors }) => {
      this.ctx.state.collectFiles(checker.getTestFiles())
      await this.report('onTaskUpdate', checker.getTestPacks())
      await this.report('onCollected')
      if (!files.length) {
        this.ctx.logger.printNoTestFound()
      }
      else {
        if (hasFailed(files))
          process.exitCode = 1
        await this.report('onFinished', files)
      }
      if (sourceErrors.length && !this.config.typecheck.ignoreSourceErrors) {
        process.exitCode = 1
        await this.ctx.logger.printSourceTypeErrors(sourceErrors)
      }
      // if there are source errors, we are showing it, and then terminating process
      if (!files.length) {
        const exitCode = this.config.passWithNoTests ? (process.exitCode ?? 0) : 1
        process.exit(exitCode)
      }
      if (this.config.watch) {
        await this.report('onWatcherStart', files, [
          ...(this.config.typecheck.ignoreSourceErrors ? [] : sourceErrors),
          ...this.ctx.state.getUnhandledErrors(),
        ])
      }
    })
    checker.onParseStart(async () => {
      await this.report('onInit', this.ctx)
      this.ctx.state.collectFiles(checker.getTestFiles())
      await this.report('onCollected')
    })
    checker.onWatcherRerun(async () => {
      await this.report('onWatcherRerun', testsFilesList, 'File change detected. Triggering rerun.')
      await checker.collectTests()
      this.ctx.state.collectFiles(checker.getTestFiles())
      await this.report('onTaskUpdate', checker.getTestPacks())
      await this.report('onCollected')
    })
    await checker.prepare()
    await checker.collectTests()
    await checker.start()
  }

  isBrowserEnabled() {
    return isBrowserEnabled(this.config)
  }

  getSerializableConfig() {
    return deepMerge({
      ...this.config,
      reporters: [],
      deps: {
        ...this.config.deps,
        experimentalOptimizer: {
          enabled: this.config.deps?.experimentalOptimizer?.enabled ?? false,
        },
      },
      snapshotOptions: {
        ...this.config.snapshotOptions,
        resolveSnapshotPath: undefined,
      },
      onConsoleLog: undefined!,
      sequence: {
        ...this.config.sequence,
        sequencer: undefined!,
      },
      benchmark: {
        ...this.config.benchmark,
        reporters: [],
      },
    },
    this.configOverride || {} as any,
    ) as ResolvedConfig
  }

  close() {
    if (!this.closingPromise) {
      this.closingPromise = Promise.all([
        this.server.close(),
        this.typechecker?.stop(),
        this.browser?.close(),
      ].filter(Boolean))
    }
    return this.closingPromise
  }
}
