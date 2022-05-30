import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { Benchmark, SuiteHooks, Task } from '../../../types'
import { clearInterval, getTests, hasBenchmark, setInterval } from '../../../utils'
import { F_RIGHT } from '../../../utils/figures'
import { getCols, getHookStateSymbol, getStateSymbol } from './utils'

export interface ListRendererOptions {
  renderSucceed?: boolean
  outputStream: NodeJS.WritableStream
  showHeap: boolean
}

const DURATION_LONG = 300

const outputMap = new WeakMap<Task, string>()

function formatFilepath(path: string) {
  const lastSlash = Math.max(path.lastIndexOf('/') + 1, 0)
  const basename = path.slice(lastSlash)
  let firstDot = basename.indexOf('.')
  if (firstDot < 0)
    firstDot = basename.length
  firstDot += lastSlash

  return c.dim(path.slice(0, lastSlash)) + path.slice(lastSlash, firstDot) + c.dim(path.slice(firstDot))
}

function formatNumber(number: number) {
  const res = String(number.toFixed(number < 100 ? 2 : 0)).split('.')
  return res[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',')
    + (res[1] ? `.${res[1]}` : '')
}

function renderHookState(task: Task, hookName: keyof SuiteHooks, level = 0) {
  const state = task.result?.hooks?.[hookName]
  if (state && state === 'run')
    return `${'  '.repeat(level)} ${getHookStateSymbol(task, hookName)} ${c.dim(`[ ${hookName} ]`)}`

  return ''
}

function renderBenchmark(task: Benchmark, title: string, level = 0) {
  const output = []
  const result = task.result

  if (!result)
    return []

  output.push([
    '  '.repeat(level),
    title,
    '',
    c.green(result.benchmark!.complete.fastest),
  ].join(' '))

  level += 2
  for (const cycle of result!.benchmark!.cycle) {
    output.push([
      '  '.repeat(level),
      c.dim(cycle.name),
      c.dim(' x '),
      c.yellow(formatNumber(cycle.hz)),
      c.dim(' ops/sec ±'),
      c.yellow(cycle.rme.toFixed(2)),
      c.dim('% ('),
      `${c.yellow(cycle.sampleSize)} `,
      c.dim(`run${cycle.sampleSize === 1 ? '' : 's'} sampled)`),
    ].join(''))
  }

  return output
}

export function renderTree(tasks: Task[], options: ListRendererOptions, level = 0, onlyBenchmark = false) {
  let output: string[] = []

  for (const task of tasks) {
    let suffix = ''
    const prefix = ` ${getStateSymbol(task)} `

    if (task.type === 'suite')
      suffix += c.dim(` (${getTests(task).length})`)

    if (task.mode === 'skip' || task.mode === 'todo')
      suffix += ` ${c.dim(c.gray('[skipped]'))}`

    if (task.result?.duration != null) {
      if (task.result.duration > DURATION_LONG)
        suffix += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
    }

    if (options.showHeap && task.result?.heap != null)
      suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

    let name = task.name
    if (level === 0)
      name = formatFilepath(name)

    const title = prefix + name + suffix
    if (task.type === 'benchmark' && onlyBenchmark) {
      output = output.concat(renderBenchmark(task, title, level))
      return output.filter(Boolean).join('\n')
    }
    else {
      output.push('  '.repeat(level) + title)
    }

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)
      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = `${'  '.repeat(level)}${F_RIGHT} ${data}`
        output.push(`   ${c.gray(cliTruncate(out, getCols(-3)))}`)
      }
    }

    output = output.concat(renderHookState(task, 'beforeAll', level + 1))
    output = output.concat(renderHookState(task, 'beforeEach', level + 1))
    if (task.type === 'suite' && task.tasks.length > 0) {
      if ((task.result?.state === 'fail' || task.result?.state === 'run' || options.renderSucceed))
        output = output.concat(renderTree(task.tasks, options, level + 1))
      else if (hasBenchmark(task)) // benchmark output keep print
        output = output.concat(renderTree(task.tasks, options, level + 1, true))
    }
    output = output.concat(renderHookState(task, 'afterAll', level + 1))
    output = output.concat(renderHookState(task, 'afterEach', level + 1))
  }

  // TODO: moving windows
  return output.filter(Boolean).join('\n')
}

export const createListRenderer = (_tasks: Task[], options: ListRendererOptions) => {
  let tasks = _tasks
  let timer: any

  const log = createLogUpdate(options.outputStream)

  function update() {
    log(renderTree(tasks, options))
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(update, 200)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      update()
      return this
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      log.clear()
      options.outputStream.write(`${renderTree(tasks, options)}\n`)
      return this
    },
    clear() {
      log.clear()
    },
  }
}
