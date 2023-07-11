/* eslint-disable antfu/no-cjs-exports */

import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { Module as _Module, createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'pathe'
import { isNodeBuiltin } from 'vite-node/utils'
import type { RuntimeRPC } from '../types'

// need to copy paste types for vm
// because they require latest @types/node which we don't bundle

interface ModuleEvaluateOptions {
  timeout?: vm.RunningScriptOptions['timeout'] | undefined
  breakOnSigint?: vm.RunningScriptOptions['breakOnSigint'] | undefined
}

type ModuleLinker = (specifier: string, referencingModule: VMModule, extra: { assert: Object }) => VMModule | Promise<VMModule>
type ModuleStatus = 'unlinked' | 'linking' | 'linked' | 'evaluating' | 'evaluated' | 'errored'
declare class VMModule {
  dependencySpecifiers: readonly string[]
  error: any
  identifier: string
  context: vm.Context
  namespace: Object
  status: ModuleStatus
  evaluate(options?: ModuleEvaluateOptions): Promise<void>
  link(linker: ModuleLinker): Promise<void>
}
interface SyntheticModuleOptions {
  /**
     * String used in stack traces.
     * @default 'vm:module(i)' where i is a context-specific ascending index.
     */
  identifier?: string | undefined
  /**
     * The contextified object as returned by the `vm.createContext()` method, to compile and evaluate this module in.
     */
  context?: vm.Context | undefined
}
declare class VMSyntheticModule extends VMModule {
  /**
     * Creates a new `SyntheticModule` instance.
     * @param exportNames Array of names that will be exported from the module.
     * @param evaluateCallback Called when the module is evaluated.
     */
  constructor(exportNames: string[], evaluateCallback: (this: VMSyntheticModule) => void, options?: SyntheticModuleOptions)
  /**
     * This method is used after the module is linked to set the values of exports.
     * If it is called before the module is linked, an `ERR_VM_MODULE_STATUS` error will be thrown.
     * @param name
     * @param value
     */
  setExport(name: string, value: any): void
}

declare interface ImportModuleDynamically {
  (specifier: string, script: VMModule, importAssertions: Object): VMModule | Promise<VMModule>
}

interface SourceTextModuleOptions {
  identifier?: string | undefined
  cachedData?: vm.ScriptOptions['cachedData'] | undefined
  context?: vm.Context | undefined
  lineOffset?: vm.BaseOptions['lineOffset'] | undefined
  columnOffset?: vm.BaseOptions['columnOffset'] | undefined
  /**
   * Called during evaluation of this module to initialize the `import.meta`.
   */
  initializeImportMeta?: ((meta: ImportMeta, module: VMSourceTextModule) => void) | undefined
  importModuleDynamically?: ImportModuleDynamically
}
declare class VMSourceTextModule extends VMModule {
  /**
   * Creates a new `SourceTextModule` instance.
   * @param code JavaScript Module code to parse
   */
  constructor(code: string, options?: SourceTextModuleOptions)
}

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule
const SourceTextModule: typeof VMSourceTextModule = (vm as any).SourceTextModule

interface PrivateNodeModule extends NodeModule {
  _compile(code: string, filename: string): void
}

const _require = createRequire(import.meta.url)

const nativeResolve = import.meta.resolve!

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private requireCache: Record<string, NodeModule> = Object.create(null)
  private builtinCache: Record<string, NodeModule> = Object.create(null)
  private moduleCache = new Map<string, VMModule>()
  private extensions: Record<string, (m: NodeModule, filename: string) => unknown> = Object.create(null)

  private esmLinkMap = new WeakMap<VMModule, Promise<void>>()

  private Module: typeof _Module

  constructor(private context: vm.Context, private findNearestPackageData: RuntimeRPC['findNearestPackageData']) {
    this.context = context

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const executor = this

    this.Module = class Module {
      exports = {}
      isPreloading = false
      require: NodeRequire
      id: string
      filename: string
      loaded: boolean
      parent: null | Module | undefined
      children: Module[] = []
      path: string
      paths: string[]

      constructor(id: string, parent?: Module) {
        this.exports = {}
        this.isPreloading = false
        this.require = Module.createRequire(id)
        // in our case the path should always be resolved already
        this.path = dirname(id)
        this.id = id
        this.filename = id
        this.loaded = false
        this.parent = parent
        this.children = []
        this.paths = []
      }

      _compile(code: string, filename: string) {
        const cjsModule = _Module.wrap(code)
        const script = new vm.Script(cjsModule, {
          filename,
          importModuleDynamically: executor.importModuleDynamically,
        } as any)
        // @ts-expect-error mark script with current identifier
        script.identifier = filename
        const fn = script.runInContext(context)
        const __dirname = dirname(filename)
        executor.requireCache[filename] = this
        try {
          fn(this.exports, this.require, this, filename, __dirname)
          return this.exports
        }
        finally {
          this.loaded = true
        }
      }

      // exposed for external use, Node.js does the opposite
      static _load = (request: string, parent: Module | undefined, _isMain: boolean) => {
        const require = Module.createRequire(parent?.filename ?? request)
        return require(request)
      }

      static builtinModules = _Module.builtinModules
      static wrap = _Module.wrap
      static findSourceMap = _Module.findSourceMap
      static SourceMap = _Module.SourceMap
      static syncBuiltinESMExports = _Module.syncBuiltinESMExports

      static _cache = executor.moduleCache
      static _extensions = executor.extensions

      static createRequire = (filename: string) => {
        return executor.createRequire(filename)
      }

      static runMain = () => {
        throw new Error('[vitest] "runMain" is not implemented.')
      }

      // @ts-expect-error not typed
      static _resolveFilename = _Module._resolveFilename
      // @ts-expect-error not typed
      static _findPath = _Module._findPath
      // @ts-expect-error not typed
      static _initPaths = _Module._initPaths
      // @ts-expect-error not typed
      static _preloadModules = _Module._preloadModules
      // @ts-expect-error not typed
      static _resolveLookupPaths = _Module._resolveLookupPaths
      // @ts-expect-error not typed
      static globalPaths = _Module.globalPaths
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore not typed in lower versions
      static isBuiltin = _Module.isBuiltin

      static Module = Module
    }

    this.extensions['.js'] = this.requireJs
    this.extensions['.json'] = this.requireJson
  }

  private requireJs = (m: NodeModule, filename: string) => {
    const content = readFileSync(filename, 'utf-8')
    ;(m as PrivateNodeModule)._compile(content, filename)
  }

  private requireJson = (m: NodeModule, filename: string) => {
    const code = readFileSync(filename, 'utf-8')
    m.exports = JSON.parse(code)
  }

  public importModuleDynamically = async (specifier: string, referencer: VMModule) => {
    const module = await this.resolveModule(specifier, referencer)
    return this.evaluateModule(module)
  }

  private resolveModule = async (specifier: string, referencer: VMModule) => {
    const identifier = await this.resolveAsync(specifier, referencer.identifier)
    return await this.createModule(identifier)
  }

  private async resolveAsync(specifier: string, parent: string) {
    return nativeResolve(specifier, parent)
  }

  private async wrapSynteticModule(identifier: string, format: 'esm' | 'builtin' | 'cjs', exports: Record<string, unknown>) {
    const moduleKeys = Object.keys(exports)
    if (format !== 'esm' && !moduleKeys.includes('default'))
      moduleKeys.push('default')
    const m: any = new SyntheticModule(
      moduleKeys,
      () => {
        for (const key of moduleKeys)
          m.setExport(key, exports[key])
        if (format !== 'esm')
          m.setExport('default', exports)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private async evaluateModule<T extends VMModule>(m: T): Promise<T> {
    if (m.status === 'unlinked') {
      this.esmLinkMap.set(
        m,
        m.link(this.resolveModule),
      )
    }

    await this.esmLinkMap.get(m)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  private findLongestRegisteredExtension(filename: string) {
    const name = basename(filename)
    let currentExtension
    let index
    let startIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((index = name.indexOf('.', startIndex)) !== -1) {
      startIndex = index + 1
      if (index === 0)
        continue // Skip dotfiles like .gitignore
      currentExtension = (name.slice(index))
      if (this.extensions[currentExtension])
        return currentExtension
    }
    return '.js'
  }

  public createRequire = (filename: string) => {
    const _require = createRequire(filename)
    const require = ((id: string) => {
      const filename = _require.resolve(id)
      const ext = extname(filename)
      if (ext === '.node' || isNodeBuiltin(filename))
        return this.requireCoreModule(filename)
      const module = this.createCommonJSNodeModule(filename)
      return this.loadCommonJSModule(module, filename)
    }) as NodeRequire
    require.resolve = _require.resolve
    Object.defineProperty(require, 'extensions', {
      get: () => this.extensions,
      set: () => {},
      configurable: true,
    })
    require.main = _require.main
    require.cache = this.requireCache
    return require
  }

  private createCommonJSNodeModule(filename: string) {
    return new this.Module(filename)
  }

  // very naive implementation for Node.js require
  private loadCommonJSModule(module: NodeModule, filename: string): Record<string, unknown> {
    const cached = this.requireCache[filename]
    if (cached)
      return cached.exports

    const extension = this.findLongestRegisteredExtension(filename)
    const loader = this.extensions[extension] || this.extensions['.js']
    loader(module, filename)

    return module.exports
  }

  private async createEsmModule(fileUrl: string, code: string) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached)
      return cached
    const m = new SourceTextModule(
      code,
      {
        identifier: fileUrl,
        context: this.context,
        importModuleDynamically: this.importModuleDynamically,
        initializeImportMeta: (meta, mod) => {
          meta.url = mod.identifier
          meta.resolve = (specifier: string, importer?: string) => {
            return nativeResolve(specifier, importer ?? mod.identifier)
          }
        },
      },
    )
    this.moduleCache.set(fileUrl, m)
    return m
  }

  private requireCoreModule(identifier: string) {
    const normalized = identifier.replace(/^node:/, '')
    if (this.builtinCache[normalized])
      return this.builtinCache[normalized].exports
    const moduleExports = _require(identifier)
    if (identifier === 'node:module' || identifier === 'module') {
      const module = new this.Module('/module.js') // path should not matter
      module.exports = this.Module
      this.builtinCache[normalized] = module
      return module.exports
    }
    this.builtinCache[normalized] = _require.cache[normalized]!
    return moduleExports
  }

  private getIdentifierCode(code: string) {
    if (code.startsWith('data:text/javascript'))
      return code.match(/data:text\/javascript;.*,(.*)/)?.[1]
  }

  private async createModule(identifier: string): Promise<VMModule> {
    const extension = extname(identifier)

    if (extension === '.node' || isNodeBuiltin(identifier)) {
      const exports = this.requireCoreModule(identifier)
      return await this.wrapSynteticModule(identifier, 'builtin', exports)
    }

    const isFileUrl = identifier.startsWith('file://')
    const fileUrl = isFileUrl ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = isFileUrl ? fileURLToPath(identifier) : identifier

    if (extension === '.cjs') {
      const module = this.createCommonJSNodeModule(pathUrl)
      const exports = this.loadCommonJSModule(module, pathUrl)
      return this.wrapSynteticModule(fileUrl, 'cjs', exports)
    }

    const inlineCode = this.getIdentifierCode(identifier)

    if (inlineCode || extension === '.mjs')
      return await this.createEsmModule(fileUrl, inlineCode || await readFile(pathUrl, 'utf8'))

    const pkgData = await this.findNearestPackageData(pathUrl)

    if (pkgData.type === 'module')
      return await this.createEsmModule(fileUrl, await readFile(pathUrl, 'utf8'))

    const module = this.createCommonJSNodeModule(pathUrl)
    const exports = this.loadCommonJSModule(module, pathUrl)
    return this.wrapSynteticModule(fileUrl, 'cjs', exports)
  }

  async import(identifier: string) {
    const module = await this.createModule(identifier)
    await this.evaluateModule(module)
    return module.namespace
  }
}
