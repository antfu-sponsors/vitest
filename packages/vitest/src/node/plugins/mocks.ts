import type { Plugin } from 'vite'
import { cleanUrl } from 'vite-node/utils'
import { hoistMocks } from '../hoistMocks'
import { distDir } from '../../paths'
import { automockModule } from '../automock'

export function MocksPlugins(): Plugin[] {
  return [
    {
      name: 'vitest:mocks',
      enforce: 'post',
      transform(code, id) {
        if (id.includes(distDir)) {
          return
        }
        return hoistMocks(code, id, this.parse)
      },
    },
    {
      name: 'vitest:automock',
      enforce: 'post',
      transform(code, id) {
        if (id.includes('mock=automock') || id.includes('mock=autospy')) {
          const mockType = id.includes('mock=automock') ? 'automock' : 'autospy'
          const ms = automockModule(code, mockType, this.parse)
          return {
            code: ms.toString(),
            map: ms.generateMap({ hires: true, source: cleanUrl(id) }),
          }
        }
      },
    },
  ]
}
