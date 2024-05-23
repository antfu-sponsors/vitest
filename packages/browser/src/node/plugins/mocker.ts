import type { Plugin } from 'vitest/config'
import type { WorkspaceProject } from 'vitest/node'
import type { WebSocketRPC } from 'vitest'

export default (project: WorkspaceProject): Plugin => {
  return {
    name: 'vitest:browser:mocker',
    enforce: 'pre',
    async load(id) {
      const queued = project.browserMocks.queued
      if (queued.has(id)) {
        const reporter = project.ctx.reporters.find(r => 'wss' in r && 'clients' in r && (r.clients as any).size) as {
          clients: Map<any, WebSocketRPC>
        }

        if (!reporter)
          throw new Error('WebSocketReporter not found')

        const exports = await startMocking(reporter.clients, id)
        const module = `const module = __vitest_mocker__.get('${id}')`
        const keys = exports.map((name) => {
          if (name === 'default')
            return `export default module['default']`
          return `export const ${name} = module['${name}']`
        }).join('\n')
        return `${module}\n${keys}`
      }
    },
  }
}

async function startMocking(clients: Map<any, WebSocketRPC>, id: string) {
  const errors: unknown[] = []
  // start from the end since it's more likely that the last iframe is the one
  // who subscribed with a running test
  for (const client of [...clients.values()].reverse()) {
    try {
      const context = await client.getTestContext()
      if (!context)
        continue
      // TODO: check if the same test file(?)
      // invalidate between tests(?)
      return await client.startMocking(id)
    }
    catch (err) {
      errors.push(err)
    }
  }
  console.error(errors)
  throw new AggregateError(errors, 'No clients available')
}
