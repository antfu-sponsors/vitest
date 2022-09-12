import { resolve } from 'pathe'
import fg from 'fast-glob'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('*.test.*', { cwd: root })

  for (const file of files) {
    it(file, async () => {
      // in Windows child_process is very unstable, we skip testing it
      if (process.platform === 'win32' && process.env.CI)
        return

      let error: any
      await execa('npx', ['vitest', 'run', file], {
        cwd: root,
        env: {
          ...process.env,
          CI: 'true',
          NO_COLOR: 'true',
        },
      })
        .catch((e) => {
          error = e
        })

      expect(error).toBeTruthy()
      const msg = String(error)
        .split(/\n/g)
        .reduce((acc, line) => {
          if (line.includes('Start at') || line.includes('Duration') || line.includes('(1 test | 1 failed)'))
            return acc

          return `${acc}\n${line}`
        }, '')
        .replace(root, '<rootDir>')
      expect(msg).toMatchSnapshot(file)
    }, 10000)
  }
})
