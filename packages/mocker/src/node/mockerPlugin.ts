import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import type { Plugin, ViteDevServer } from 'vite'

import { type AutomockPluginOptions, automockPlugin } from './automockPlugin'
import { type HoistMocksPluginOptions, hoistMocksPlugin } from './hoistMocksPlugin'
import { dynamicImportPlugin } from './dynamicImportPlugin'
import { ServerMockResolver } from './resolver'

interface MockerPluginOptions extends AutomockPluginOptions {
  hoistMocks?: HoistMocksPluginOptions
}

// this is an implementation for public usage
// vitest doesn't use this plugin directly

export function mockerPlugin(options: MockerPluginOptions = {}): Plugin[] {
  let server: ViteDevServer
  const registerPath = fileURLToPath(new URL('./register.js', import.meta.url))
  return [
    {
      name: 'vitest:mocker:ws-rpc',
      config(_, { command }) {
        if (command !== 'serve') {
          return
        }
        return {
          server: {
            // don't pre-transform request because they might be mocked at runtime
            preTransformRequests: false,
          },
        }
      },
      configureServer(server_) {
        server = server_
        const mockResolver = new ServerMockResolver(server)
        server.ws.on('vitest:mocks:resolveId', async ({ rawId, importer }: { rawId: string; importer: string }) => {
          const resolved = await mockResolver.resolveId(rawId, importer)
          server.ws.send('vitest:mocks:resolvedId:result', resolved)
        })
        server.ws.on('vitest:mocks:resolveMock', async ({ rawId, importer, options }: { rawId: string; importer: string; options: any }) => {
          const resolved = await mockResolver.resolveMock(rawId, importer, options)
          server.ws.send('vitest:mocks:resolveMock:result', resolved)
        })
        server.ws.on('vitest:mocks:invalidate', async ({ ids }: { ids: string[] }) => {
          mockResolver.invalidate(ids)
          server.ws.send('vitest:mocks:invalidate:result')
        })
      },
      async load(id) {
        if (id !== registerPath) {
          return
        }

        if (!server) {
          // mocker doesn't work during build
          return 'export {}'
        }

        const content = await readFile(registerPath, 'utf-8')
        return content
          .replace(
            '__VITEST_GLOBAL_THIS_ACCESSOR__',
            JSON.stringify(options.globalThisAccessor ?? '"__vitest_mocker__"'),
          )
          .replace(
            '__VITEST_MOCKER_ROOT__',
            JSON.stringify(server.config.root),
          )
      },
    },
    dynamicImportPlugin(options),
    automockPlugin(options),
    hoistMocksPlugin(options.hoistMocks),
  ]
}