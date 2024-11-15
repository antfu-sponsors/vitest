import type { Task } from '@vitest/runner'
import type { ErrorWithDiff } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { TypeCheckError } from '../typecheck/typechecker'
import type { Vitest } from './core'
import type { PrintErrorResult } from './error'
import type { TestProject } from './project'
import { Console } from 'node:console'
import { toArray } from '@vitest/utils'
import { parseErrorStacktrace } from '@vitest/utils/source-map'
import { createLogUpdate } from 'log-update'
import c from 'tinyrainbow'
import { highlightCode } from '../utils/colors'
import { printError } from './error'
import { divider, formatProjectName, withLabel } from './reporters/renderers/utils'
import { RandomSequencer } from './sequencers/RandomSequencer'

export interface ErrorOptions {
  type?: string
  fullStack?: boolean
  project?: TestProject
  verbose?: boolean
  screenshotPaths?: string[]
  task?: Task
  showCodeFrame?: boolean
}

const PAD = '      '

const ESC = '\x1B['
const ERASE_DOWN = `${ESC}J`
const ERASE_SCROLLBACK = `${ESC}3J`
const CURSOR_TO_START = `${ESC}1;1H`
const CLEAR_SCREEN = '\x1Bc'

export class Logger {
  logUpdate: ReturnType<typeof createLogUpdate>

  private _clearScreenPending: string | undefined
  private _highlights = new Map<string, string>()
  public console: Console

  constructor(
    public ctx: Vitest,
    public outputStream: NodeJS.WriteStream | Writable = process.stdout,
    public errorStream: NodeJS.WriteStream | Writable = process.stderr,
  ) {
    this.console = new Console({ stdout: outputStream, stderr: errorStream })
    this.logUpdate = createLogUpdate(this.outputStream)
    this._highlights.clear()
    this.registerUnhandledRejection()
  }

  log(...args: any[]) {
    this._clearScreen()
    this.console.log(...args)
  }

  error(...args: any[]) {
    this._clearScreen()
    this.console.error(...args)
  }

  warn(...args: any[]) {
    this._clearScreen()
    this.console.warn(...args)
  }

  clearFullScreen(message = '') {
    if (!this.ctx.config.clearScreen) {
      this.console.log(message)
      return
    }

    if (message) {
      this.console.log(`${CLEAR_SCREEN}${ERASE_SCROLLBACK}${message}`)
    }
    else {
      (this.outputStream as Writable).write(`${CLEAR_SCREEN}${ERASE_SCROLLBACK}`)
    }
  }

  clearScreen(message: string, force = false) {
    if (!this.ctx.config.clearScreen) {
      this.console.log(message)
      return
    }

    this._clearScreenPending = message
    if (force) {
      this._clearScreen()
    }
  }

  private _clearScreen() {
    if (this._clearScreenPending == null) {
      return
    }

    const log = this._clearScreenPending
    this._clearScreenPending = undefined
    this.console.log(`${CURSOR_TO_START}${ERASE_DOWN}${log}`)
  }

  printError(err: unknown, options: ErrorOptions = {}): PrintErrorResult | undefined {
    const { fullStack = false, type } = options
    const project = options.project
      ?? this.ctx.coreWorkspaceProject
      ?? this.ctx.projects[0]
    return printError(err, project, {
      type,
      showCodeFrame: options.showCodeFrame ?? true,
      logger: this,
      printProperties: options.verbose,
      screenshotPaths: options.screenshotPaths,
      parseErrorStacktrace: (error) => {
        // browser stack trace needs to be processed differently,
        // so there is a separate method for that
        if (options.task?.file.pool === 'browser' && project.browser) {
          return project.browser.parseErrorStacktrace(error, {
            ignoreStackEntries: fullStack ? [] : undefined,
          })
        }

        // node.js stack trace already has correct source map locations
        return parseErrorStacktrace(error, {
          frameFilter: project.config.onStackTrace,
          ignoreStackEntries: fullStack ? [] : undefined,
        })
      },
    })
  }

  clearHighlightCache(filename?: string) {
    if (filename) {
      this._highlights.delete(filename)
    }
    else {
      this._highlights.clear()
    }
  }

  highlight(filename: string, source: string) {
    if (this._highlights.has(filename)) {
      return this._highlights.get(filename)!
    }
    const code = highlightCode(filename, source)
    this._highlights.set(filename, code)
    return code
  }

  printNoTestFound(filters?: string[]) {
    const config = this.ctx.config
    const comma = c.dim(', ')
    if (filters?.length) {
      this.console.error(c.dim('filter:  ') + c.yellow(filters.join(comma)))
    }
    const projectsFilter = toArray(config.project)
    if (projectsFilter.length) {
      this.console.error(
        c.dim('projects: ') + c.yellow(projectsFilter.join(comma)),
      )
    }
    this.ctx.projects.forEach((project) => {
      const config = project.config
      const output = project.isRootProject() || !project.name ? '' : `[${project.name}]`
      if (output) {
        this.console.error(c.bgCyan(`${output} Config`))
      }
      if (config.include) {
        this.console.error(
          c.dim('include: ') + c.yellow(config.include.join(comma)),
        )
      }
      if (config.exclude) {
        this.console.error(
          c.dim('exclude:  ') + c.yellow(config.exclude.join(comma)),
        )
      }
      if (config.typecheck.enabled) {
        this.console.error(
          c.dim('typecheck include: ')
          + c.yellow(config.typecheck.include.join(comma)),
        )
        this.console.error(
          c.dim('typecheck exclude: ')
          + c.yellow(config.typecheck.exclude.join(comma)),
        )
      }
    })

    if (config.watch && (config.changed || config.related?.length)) {
      this.log(`No affected ${config.mode} files found\n`)
    }
    else {
      if (config.passWithNoTests) {
        this.log(`No ${config.mode} files found, exiting with code 0\n`)
      }
      else {
        this.error(
          c.red(`\nNo ${config.mode} files found, exiting with code 1`),
        )
      }
    }
  }

  printBanner() {
    this.log()

    const color = this.ctx.config.watch ? 'blue' : 'cyan'
    const mode = this.ctx.config.watch ? 'DEV' : 'RUN'

    this.log(withLabel(color, mode, `v${this.ctx.version} `) + c.gray(this.ctx.config.root))

    if (this.ctx.config.sequence.sequencer === RandomSequencer) {
      this.log(PAD + c.gray(`Running tests with seed "${this.ctx.config.sequence.seed}"`))
    }

    if (this.ctx.config.ui) {
      const host = this.ctx.config.api?.host || 'localhost'
      const port = this.ctx.server.config.server.port
      const base = this.ctx.config.uiBase

      this.log(PAD + c.dim(c.green(`UI started at http://${host}:${c.bold(port)}${base}`)))
    }
    else if (this.ctx.config.api?.port) {
      const resolvedUrls = this.ctx.server.resolvedUrls
      // workaround for https://github.com/vitejs/vite/issues/15438, it was fixed in vite 5.1
      const fallbackUrl = `http://${this.ctx.config.api.host || 'localhost'}:${this.ctx.config.api.port}`
      const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0] ?? fallbackUrl

      this.log(PAD + c.dim(c.green(`API started at ${new URL('/', origin)}`)))
    }

    if (this.ctx.coverageProvider) {
      this.log(PAD + c.dim('Coverage enabled with ') + c.yellow(this.ctx.coverageProvider.name))
    }

    if (this.ctx.config.standalone) {
      this.log(c.yellow(`\nVitest is running in standalone mode. Edit a test file to rerun tests.`))
    }
    else {
      this.log()
    }
  }

  printBrowserBanner(project: TestProject) {
    if (!project.browser) {
      return
    }

    const resolvedUrls = project.browser.vite.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]
    if (!origin) {
      return
    }

    const output = project.isRootProject()
      ? ''
      : formatProjectName(project.name)
    const provider = project.browser.provider.name
    const providerString = provider === 'preview' ? '' : ` by ${c.reset(c.bold(provider))}`
    this.log(
      c.dim(
        `${output}Browser runner started${providerString} ${c.dim('at')} ${c.blue(new URL('/', origin))}\n`,
      ),
    )
  }

  printUnhandledErrors(errors: unknown[]) {
    const errorMessage = c.red(
      c.bold(
        `\nVitest caught ${errors.length} unhandled error${
          errors.length > 1 ? 's' : ''
        } during the test run.`
        + '\nThis might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.',
      ),
    )
    this.log(c.red(divider(c.bold(c.inverse(' Unhandled Errors ')))))
    this.log(errorMessage)
    errors.forEach((err) => {
      this.printError(err, {
        fullStack: true,
        type: (err as ErrorWithDiff).type || 'Unhandled Error',
      })
    })
    this.log(c.red(divider()))
  }

  printSourceTypeErrors(errors: TypeCheckError[]) {
    const errorMessage = c.red(
      c.bold(
        `\nVitest found ${errors.length} error${
          errors.length > 1 ? 's' : ''
        } not related to your test files.`,
      ),
    )
    this.log(c.red(divider(c.bold(c.inverse(' Source Errors ')))))
    this.log(errorMessage)
    errors.forEach((err) => {
      this.printError(err, { fullStack: true })
    })
    this.log(c.red(divider()))
  }

  private registerUnhandledRejection() {
    const onUnhandledRejection = (err: unknown) => {
      process.exitCode = 1

      this.printError(err, {
        fullStack: true,
        type: 'Unhandled Rejection',
      })

      this.error('\n\n')
      process.exit()
    }

    process.on('unhandledRejection', onUnhandledRejection)

    this.ctx.onClose(() => {
      process.off('unhandledRejection', onUnhandledRejection)
    })
  }
}
