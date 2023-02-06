import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { browserErrors, page, ports, startServerCommand, untilUpdated } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.ui

beforeAll(async () => {
  const exit = await startServerCommand(
    root,
    `npx vitest --ui --open false --api.port ${port} --watch --allowOnly`,
    `http://localhost:${port}/__vitest__/`,
  )

  return exit
})

it('should load ui', async () => {
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
})

it('dashboard', async () => {
  await untilUpdated(() => page.textContent('[aria-labelledby]'), '1 Pass 0 Fail 1 Total ')
})

it('file detail', async () => {
  await page.click('.details-panel span')

  await page.click('[data-testid=btn-report]')
  await untilUpdated(() => page.textContent('[data-testid=report]'), 'All tests passed in this file')
  await untilUpdated(() => page.textContent('[data-testid=filenames]'), 'sample.test.ts')

  await page.click('[data-testid=btn-graph]')
  await untilUpdated(() => page.textContent('[data-testid=graph] text'), 'sample.test.ts')

  await page.click('[data-testid=btn-console]')
  await untilUpdated(() => page.textContent('[data-testid=console] pre'), 'log test')
})

it('no error happen', () => {
  expect(browserErrors.length).toEqual(0)
})
