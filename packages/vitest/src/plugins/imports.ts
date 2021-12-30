import { readFile } from 'fs/promises'
import type { Plugin } from 'vite'

const importRegexp = /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s]$/mg
const dynamicImportRegexp = /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s]\)$/mg

const isBareImports = (id: string) => /(\?|&)imports$/.test(id)
const isExternalImport = (id: string) => {
  return (!id.startsWith('/') && !id.startsWith('.')) || id.startsWith('/@fs/') || id.includes('node_modules')
}

/**
 * Keeps only imports inside a file to analize dependency graph
 * without actually calling real code and/or creating side effects
 */
export const RelatedImportsPlugin = (): Plugin => {
  const files: Record<string, string> = {}
  return {
    name: 'vitest:imports',
    enforce: 'pre',
    async transform(code, id) {
      if (!isBareImports(id))
        return
      const deps = new Set()

      const addImports = async(code: string, filepath: string, pattern: RegExp) => {
        const matches = code.matchAll(pattern)
        for (const match of matches) {
          const path = await this.resolve(match[2], filepath)
          if (path && !isExternalImport(path.id) && !deps.has(path.id)) {
            deps.add(path.id)

            const depCode = files[path.id] ?? (files[path.id] = await readFile(path.id, 'utf-8'))
            await processImports(depCode, path.id)
          }
        }
      }

      function processImports(code: string, id: string) {
        return Promise.all([
          addImports(code, id, importRegexp),
          addImports(code, id, dynamicImportRegexp),
        ])
      }

      await processImports(code, id)

      return Array.from(deps).map(path => `import "${path}"`).join('\n')
    },
  }
}
