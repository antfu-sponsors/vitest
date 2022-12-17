import fs from 'fs'
import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { parse } from 'flatted'

describe('html reporter', async () => {
  const vitestRoot = resolve(__dirname, '../../..')
  const root = resolve(__dirname, '../fixtures')

  const skip = (process.platform === 'win32' || process.platform === 'darwin') && process.env.CI

  it.skipIf(skip).each([
    ['passing', 'all-passing-or-skipped', 'html/all-passing-or-skipped'],
    ['failing', 'json-fail', 'html/fail'],
  ])('resolves to "%s" status for test file "%s"', async (expected, file, basePath) => {
    await execa('npx', ['vitest', 'run', file, '--reporter=html', `--outputFile=${basePath}/index.html`], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    }).catch(e => e)
    const metaJson = fs.readFileSync(resolve(root, `${basePath}/html.meta.json`), { encoding: 'utf-8' })
    const indexHtml = fs.readFileSync(resolve(root, `${basePath}/index.html`), { encoding: 'utf-8' })
    // TODO: fix timers
    expect(parse(metaJson.replace(new RegExp(vitestRoot, 'g'), '<rootDir>'))).toMatchSnapshot(`tests are ${expected}`)
    expect(indexHtml).toMatch('window.METADATA_PATH="html-meta.json"')
  }, 40000)
})
