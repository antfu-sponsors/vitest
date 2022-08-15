/* eslint-disable no-console */
/**
 * Wrapper of the CLI with child process to manage segfaults and retries.
 */
import { fileURLToPath } from 'url'
import c from 'picocolors'
import { execa } from 'execa'

const ENTRY = new URL('./cli.mjs', import.meta.url)

interface ErrorDef {
  trigger: string
  url: string
}

// Node errors seen in Vitest (vitejs/vite#9492)
const ERRORS: ErrorDef[] = [
  {
    trigger: 'Check failed: result.second.',
    url: 'https://github.com/nodejs/node/issues/43617',
  },
  {
    trigger: 'FATAL ERROR: v8::FromJust Maybe value is Nothing.',
    url: 'https://github.com/vitest-dev/vitest/issues/1191',
  },
  {
    trigger: 'FATAL ERROR: v8::ToLocalChecked Empty MaybeLocal.',
    url: 'https://github.com/nodejs/node/issues/42407',
  },
]

async function main() {
  // default exit code = 100, as in retries were exhausted
  const exitCode = 100
  let retries = 0
  const args = process.argv.slice(2)

  if (process.env.VITEST_SEGFAULT_RETRY) {
    retries = +process.env.VITEST_SEGFAULT_RETRY
  }
  else {
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--segfault-retry=')) {
        retries = +args[i].split('=')[1]
        break
      }
      else if (args[i] === '--segfault-retry' && args[i + 1]?.match(/^\d+$/)) {
        retries = +args[i + 1]
        break
      }
    }
  }

  retries = Math.max(1, retries || 1)

  for (let i = 1; i <= retries; i++) {
    if (i !== 1)
      console.log(`${c.inverse(c.bold(c.magenta(' Retrying ')))} vitest ${args.join(' ')} ${c.gray(`(${i} of ${retries})`)}`)
    await start(args)
    if (i === 1 && retries === 1) {
      console.log(c.yellow(`It seems to be an upstream bug of Node.js. To improve the test stability,
you could pass ${c.bold(c.green('--segfault-retry=3'))} or set env ${c.bold(c.green('VITEST_SEGFAULT_RETRY=3'))} to
have Vitest auto retries on flaky segfaults.\n`))
    }
  }
  process.exit(exitCode)
}

main()

async function start(args: string[]) {
  const child = execa('node', [fileURLToPath(ENTRY), ...args], {
    reject: false,
    stderr: 'pipe',
    stdout: 'inherit',
    stdin: 'inherit',
  })
  child.stderr?.pipe(process.stderr)
  const { stderr: output = '' } = await child

  for (const error of ERRORS) {
    if (output.includes(error.trigger)) {
      if (process.env.GITHUB_ACTIONS)
        console.log(`::warning:: Segmentfault Error Detected: ${error.trigger}\nRefer to ${error.url}`)

      const RED_BLOCK = c.inverse(c.red(' '))
      console.log(`\n${c.inverse(c.bold(c.red(' Segmentfault Error Detected ')))}\n${RED_BLOCK} ${c.red(error.trigger)}\n${RED_BLOCK} ${c.red(`Refer to ${error.url}`)}\n`)
      return
    }
  }

  // no segmentfault found
  process.exit(child.exitCode!)
}

