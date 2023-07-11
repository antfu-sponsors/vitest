import MagicString from 'magic-string'
import type { Plugin } from 'vite'
import { stripLiteral } from 'strip-literal'
import { cleanUrl } from 'vite-node/utils'

// so people can reassign envs at runtime
// import.meta.env.VITE_NAME = 'app' -> process.env.VITE_NAME = 'app'
export function SsrReplacerPlugin(): Plugin {
  return {
    name: 'vitest:env-replacer',
    enforce: 'pre',
    transform(code, id) {
      if (!/\bimport\.meta\.env\b/.test(code) && !/\bimport\.meta\.url\b/.test(code))
        return null

      let s: MagicString | null = null
      const cleanCode = stripLiteral(code)
      const envs = cleanCode.matchAll(/\bimport\.meta\.env\b/g)

      for (const env of envs) {
        s ||= new MagicString(code)

        const startIndex = env.index!
        const endIndex = startIndex + env[0].length

        s.overwrite(startIndex, endIndex, 'process.env')
      }

      const urls = cleanCode.matchAll(/\bimport\.meta\.url\b/g)

      for (const env of urls) {
        s ||= new MagicString(code)

        const startIndex = env.index!
        const endIndex = startIndex + env[0].length

        s.overwrite(startIndex, endIndex, '__vite_ssr_import_meta__.url')
      }

      if (s) {
        return {
          code: s.toString(),
          map: s.generateMap({
            hires: true,

            // Remove possible query parameters, e.g. vue's "?vue&type=script&src=true&lang.ts"
            source: cleanUrl(id),
          }),
        }
      }
    },
  }
}
