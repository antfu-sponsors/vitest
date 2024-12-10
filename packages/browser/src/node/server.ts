import type { HtmlTagDescriptor } from 'vite'
import type { ErrorWithDiff, SerializedConfig } from 'vitest'
import type {
  BrowserProvider,
  BrowserScript,
  CDPSession,
  BrowserServer as IBrowserServer,
  ResolvedConfig,
  TestProject,
  Vite,
  Vitest,
} from 'vitest/node'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { slash } from '@vitest/utils'
import { parseErrorStacktrace, parseStacktrace, type StackTraceParserOptions } from '@vitest/utils/source-map'
import { join, resolve } from 'pathe'
import { BrowserServerCDPHandler } from './cdp'
import builtinCommands from './commands/index'
import { BrowserServerState } from './state'
import { getBrowserProvider } from './utils'

export class BrowserServer implements IBrowserServer {
  public faviconUrl: string
  public prefixTesterUrl: string

  public orchestratorScripts: string | undefined
  public testerScripts: HtmlTagDescriptor[] | undefined

  public manifest: Promise<Vite.Manifest> | Vite.Manifest
  public testerHtml: Promise<string> | string
  public testerFilepath: string
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string
  public errorCatcherUrl: string
  public locatorsUrl: string | undefined
  public stateJs: Promise<string> | string

  public state: BrowserServerState
  public provider!: BrowserProvider

  public vite!: Vite.ViteDevServer

  private stackTraceOptions: StackTraceParserOptions
  public vitest: Vitest
  public config: ResolvedConfig

  public readonly cdps = new Map<string, BrowserServerCDPHandler>()

  constructor(
    project: TestProject,
    public base: string,
  ) {
    this.vitest = project.vitest
    this.config = project.config
    this.stackTraceOptions = {
      frameFilter: project.config.onStackTrace,
      getSourceMap: (id) => {
        const result = this.vite.moduleGraph.getModuleById(id)?.transformResult
        return result?.map
      },
      getFileName: (id) => {
        const mod = this.vite.moduleGraph.getModuleById(id)
        if (mod?.file) {
          return mod.file
        }
        const modUrl = this.vite.moduleGraph.urlToModuleMap.get(id)
        if (modUrl?.file) {
          return modUrl.file
        }
        return id
      },
    }

    project.config.browser.commands ??= {}
    for (const [name, command] of Object.entries(builtinCommands)) {
      project.config.browser.commands[name] ??= command
    }

    // validate names because they can't be used as identifiers
    for (const command in project.config.browser.commands) {
      if (!/^[a-z_$][\w$]*$/i.test(command)) {
        throw new Error(
          `Invalid command name "${command}". Only alphanumeric characters, $ and _ are allowed.`,
        )
      }
    }

    this.state = new BrowserServerState()

    const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
    const distRoot = resolve(pkgRoot, 'dist')

    this.prefixTesterUrl = `${base}__vitest_test__/__test__/`
    this.faviconUrl = `${base}__vitest__/favicon.svg`

    this.manifest = (async () => {
      return JSON.parse(
        await readFile(`${distRoot}/client/.vite/manifest.json`, 'utf8'),
      )
    })().then(manifest => (this.manifest = manifest))

    const testerHtmlPath = project.config.browser.testerHtmlPath
      ? resolve(project.config.root, project.config.browser.testerHtmlPath)
      : resolve(distRoot, 'client/tester/tester.html')
    if (!existsSync(testerHtmlPath)) {
      throw new Error(`Tester HTML file "${testerHtmlPath}" doesn't exist.`)
    }
    this.testerFilepath = testerHtmlPath

    this.testerHtml = readFile(
      testerHtmlPath,
      'utf8',
    ).then(html => (this.testerHtml = html))
    this.orchestratorHtml = (project.config.browser.ui
      ? readFile(resolve(distRoot, 'client/__vitest__/index.html'), 'utf8')
      : readFile(resolve(distRoot, 'client/orchestrator.html'), 'utf8'))
      .then(html => (this.orchestratorHtml = html))
    this.injectorJs = readFile(
      resolve(distRoot, 'client/esm-client-injector.js'),
      'utf8',
    ).then(js => (this.injectorJs = js))
    this.errorCatcherUrl = join('/@fs/', resolve(distRoot, 'client/error-catcher.js'))

    const builtinProviders = ['playwright', 'webdriverio', 'preview']
    const providerName = project.config.browser.provider || 'preview'
    if (builtinProviders.includes(providerName)) {
      this.locatorsUrl = join('/@fs/', distRoot, 'locators', `${providerName}.js`)
    }
    this.stateJs = readFile(
      resolve(distRoot, 'state.js'),
      'utf-8',
    ).then(js => (this.stateJs = js))
  }

  setServer(server: Vite.ViteDevServer) {
    this.vite = server
  }

  wrapSerializedConfig(projectName: string) {
    const project = this.vitest.getProjectByName(projectName)
    const config = wrapConfig(project.serializedConfig)
    config.env ??= {}
    config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || ''
    return config
  }

  resolveTesterUrl(pathname: string) {
    const [sessionId, testFile] = pathname
      .slice(this.prefixTesterUrl.length)
      .split('/')
    const decodedTestFile = decodeURIComponent(testFile)
    return { sessionId, testFile: decodedTestFile }
  }

  async formatScripts(
    scripts: BrowserScript[] | undefined,
  ) {
    if (!scripts?.length) {
      return []
    }
    const server = this.vite
    const promises = scripts.map(
      async ({ content, src, async, id, type = 'module' }, index): Promise<HtmlTagDescriptor> => {
        const srcLink = (src ? (await server.pluginContainer.resolveId(src))?.id : undefined) || src
        const transformId = srcLink || join(server.config.root, `virtual__${id || `injected-${index}.js`}`)
        await server.moduleGraph.ensureEntryFromUrl(transformId)
        const contentProcessed
          = content && type === 'module'
            ? (await server.pluginContainer.transform(content, transformId)).code
            : content
        return {
          tag: 'script',
          attrs: {
            type,
            ...(async ? { async: '' } : {}),
            ...(srcLink
              ? {
                  src: srcLink.startsWith('http') ? srcLink : slash(`/@fs/${srcLink}`),
                }
              : {}),
          },
          injectTo: 'head',
          children: contentProcessed || '',
        }
      },
    )
    return (await Promise.all(promises))
  }

  async initBrowserProvider(project: TestProject) {
    if (this.provider) {
      return
    }
    const Provider = await getBrowserProvider(project.config.browser, project)
    this.provider = new Provider()
    const browser = project.config.browser.name
    if (!browser) {
      throw new Error(
        `[${project.name}] Browser name is required. Please, set \`test.browser.configs.browser\` option manually.`,
      )
    }
    const supportedBrowsers = this.provider.getSupportedBrowsers()
    if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
      throw new Error(
        `[${project.name}] Browser "${browser}" is not supported by the browser provider "${
          this.provider.name
        }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
      )
    }
    const providerOptions = project.config.browser.providerOptions
    await this.provider.initialize(project, {
      browser,
      options: providerOptions,
    })
  }

  public parseErrorStacktrace(
    e: ErrorWithDiff,
    options: StackTraceParserOptions = {},
  ) {
    return parseErrorStacktrace(e, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  public parseStacktrace(
    trace: string,
    options: StackTraceParserOptions = {},
  ) {
    return parseStacktrace(trace, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  private cdpSessionsPromises = new Map<string, Promise<CDPSession>>()

  async ensureCDPHandler(sessionId: string, rpcId: string) {
    const cachedHandler = this.cdps.get(rpcId)
    if (cachedHandler) {
      return cachedHandler
    }
    const browserSession = this.vitest._browserSessions.getSession(sessionId)
    if (!browserSession) {
      throw new Error(`Session "${sessionId}" not found.`)
    }

    const browser = browserSession.project.browser!
    const provider = browser.provider
    if (!provider.getCDPSession) {
      throw new Error(`CDP is not supported by the provider "${provider.name}".`)
    }

    const promise = this.cdpSessionsPromises.get(rpcId) ?? await (async () => {
      const promise = provider.getCDPSession!(sessionId).finally(() => {
        this.cdpSessionsPromises.delete(rpcId)
      })
      this.cdpSessionsPromises.set(rpcId, promise)
      return promise
    })()

    const session = await promise
    const rpc = (browser.state as BrowserServerState).testers.get(rpcId)
    if (!rpc) {
      throw new Error(`Tester RPC "${rpcId}" was not established.`)
    }

    const handler = new BrowserServerCDPHandler(session, rpc)
    this.cdps.set(
      rpcId,
      handler,
    )
    return handler
  }

  async removeCDPHandler(sessionId: string) {
    this.cdps.delete(sessionId)
  }

  async close() {
    await this.vite.close()
  }
}

function wrapConfig(config: SerializedConfig): SerializedConfig {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern: config.testNamePattern
      ? (config.testNamePattern.toString() as any as RegExp)
      : undefined,
  }
}
