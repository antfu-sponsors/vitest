import type { Plugin } from 'vite'
import { automockPlugin, hoistMocksPlugin } from '@vitest/mocker/node'
import { distDir } from '../../paths'
import { generateCodeFrame } from '../error'

export function MocksPlugins(): Plugin[] {
  return [
    hoistMocksPlugin({
      filter(id) {
        if (id.includes(distDir)) {
          return false
        }
        return true
      },
      codeFrameGenerator(node, id, code) {
        return generateCodeFrame(
          code,
          4,
          node.start + 1,
        )
      },
    }),
    automockPlugin(),
  ]
}
