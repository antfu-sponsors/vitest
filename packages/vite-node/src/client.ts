import { createRequire } from 'node:module'

// we need native dirname, because windows __dirname has \\
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { hasESMSyntax } from 'mlly'
import { resolve as resolveModule } from 'import-meta-resolve'
import createDebug from 'debug'
import { VALID_ID_PREFIX, cleanUrl, isInternalRequest, isNodeBuiltin, isPrimitive, normalizeModuleId, normalizeRequestId, slash, toFilePath } from './utils'
import type { HotContext, ModuleCache, ViteNodeRunnerOptions } from './types'
import { extractSourceMap } from './source-map'

const { setTimeout, clearTimeout } = globalThis

const debugExecute = createDebug('vite-node:client:execute')
const debugNative = createDebug('vite-node:client:native')

const clientStub = {
  injectQuery: (id: string) => id,
  createHotContext() {
    return {
      accept: () => {},
      prune: () => {},
      dispose: () => {},
      decline: () => {},
      invalidate: () => {},
      on: () => {},
      send: () => {},
    }
  },
  updateStyle(id: string, css: string) {
    if (typeof document === 'undefined')
      return

    const element = document.querySelector(`[data-vite-dev-id="${id}"]`)
    if (element) {
      element.textContent = css
      return
    }

    const head = document.querySelector('head')
    const style = document.createElement('style')
    style.setAttribute('type', 'text/css')
    style.setAttribute('data-vite-dev-id', id)
    style.textContent = css
    head?.appendChild(style)
  },
  removeStyle(id: string) {
    if (typeof document === 'undefined')
      return
    const sheet = document.querySelector(`[data-vite-dev-id="${id}"]`)
    if (sheet)
      document.head.removeChild(sheet)
  },
}

export const DEFAULT_REQUEST_STUBS: Record<string, unknown> = {
  '/@vite/client': clientStub,
  '@vite/client': clientStub,
}

export class ModuleCacheMap extends Map<string, ModuleCache> {
  normalizePath(fsPath: string) {
    return normalizeModuleId(fsPath)
  }

  /**
   * Assign partial data to the map
   */
  update(fsPath: string, mod: ModuleCache) {
    fsPath = this.normalizePath(fsPath)
    if (!super.has(fsPath))
      this.setByModuleId(fsPath, mod)
    else
      Object.assign(super.get(fsPath) as ModuleCache, mod)
    return this
  }

  setByModuleId(modulePath: string, mod: ModuleCache) {
    return super.set(modulePath, mod)
  }

  set(fsPath: string, mod: ModuleCache) {
    return this.setByModuleId(this.normalizePath(fsPath), mod)
  }

  getByModuleId(modulePath: string) {
    if (!super.has(modulePath))
      this.setByModuleId(modulePath, {})

    const mod = super.get(modulePath)!
    if (!mod.imports) {
      Object.assign(mod, {
        imports: new Set(),
        importers: new Set(),
      })
    }
    return mod as ModuleCache & Required<Pick<ModuleCache, 'imports' | 'importers'>>
  }

  get(fsPath: string) {
    return this.getByModuleId(this.normalizePath(fsPath))
  }

  deleteByModuleId(modulePath: string): boolean {
    return super.delete(modulePath)
  }

  delete(fsPath: string) {
    return this.deleteByModuleId(this.normalizePath(fsPath))
  }

  invalidateModule(mod: ModuleCache) {
    delete mod.evaluated
    delete mod.resolving
    delete mod.promise
    delete mod.exports
    mod.importers?.clear()
    mod.imports?.clear()
    return true
  }

  /**
   * Invalidate modules that dependent on the given modules, up to the main entry
   */
  invalidateDepTree(ids: string[] | Set<string>, invalidated = new Set<string>()) {
    for (const _id of ids) {
      const id = this.normalizePath(_id)
      if (invalidated.has(id))
        continue
      invalidated.add(id)
      const mod = super.get(id)
      if (mod?.importers)
        this.invalidateDepTree(mod.importers, invalidated)
      super.delete(id)
    }
    return invalidated
  }

  /**
   * Invalidate dependency modules of the given modules, down to the bottom-level dependencies
   */
  invalidateSubDepTree(ids: string[] | Set<string>, invalidated = new Set<string>()) {
    for (const _id of ids) {
      const id = this.normalizePath(_id)
      if (invalidated.has(id))
        continue
      invalidated.add(id)
      const subIds = Array.from(super.entries())
        .filter(([,mod]) => mod.importers?.has(id))
        .map(([key]) => key)
      subIds.length && this.invalidateSubDepTree(subIds, invalidated)
      super.delete(id)
    }
    return invalidated
  }

  /**
   * Return parsed source map based on inlined source map of the module
   */
  getSourceMap(id: string) {
    const cache = this.get(id)
    if (cache.map)
      return cache.map
    const map = cache.code && extractSourceMap(cache.code)
    if (map) {
      cache.map = map
      return map
    }
    return null
  }
}

export class ViteNodeRunner {
  root: string

  debug: boolean

  /**
   * Holds the cache of modules
   * Keys of the map are filepaths, or plain package names
   */
  moduleCache: ModuleCacheMap
  externalCache: ModuleCacheMap

  constructor(public options: ViteNodeRunnerOptions) {
    this.root = options.root ?? process.cwd()
    this.moduleCache = options.moduleCache ?? new ModuleCacheMap()
    this.externalCache = options.externalCache ?? new ModuleCacheMap()
    this.debug = options.debug ?? (typeof process !== 'undefined' ? !!process.env.VITE_NODE_DEBUG_RUNNER : false)
  }

  async executeFile(file: string) {
    const url = `/@fs/${slash(resolve(file))}`
    return await this.cachedRequest(url, url, [])
  }

  async executeId(rawId: string) {
    const [id, url] = await this.resolveUrl(rawId)
    return await this.cachedRequest(id, url, [])
  }

  /** @internal */
  async cachedRequest(id: string, fsPath: string, callstack: string[]) {
    const importee = callstack[callstack.length - 1]

    const mod = this.moduleCache.get(fsPath)
    const { imports, importers } = mod

    if (importee)
      importers.add(importee)

    const getStack = () => `stack:\n${[...callstack, fsPath].reverse().map(p => `  - ${p}`).join('\n')}`

    // check circular dependency
    if (callstack.includes(fsPath) || Array.from(imports.values()).some(i => importers.has(i))) {
      if (mod.exports)
        return mod.exports
    }

    let debugTimer: any
    if (this.debug)
      debugTimer = setTimeout(() => console.warn(`[vite-node] module ${fsPath} takes over 2s to load.\n${getStack()}`), 2000)

    try {
      // cached module
      if (mod.promise)
        return await mod.promise

      const promise = this.directRequest(id, fsPath, callstack)
      Object.assign(mod, { promise, evaluated: false })
      return await promise
    }
    finally {
      mod.evaluated = true
      if (debugTimer)
        clearTimeout(debugTimer)
    }
  }

  shouldResolveId(id: string, _importee?: string) {
    return !isInternalRequest(id) && !isNodeBuiltin(id) && !id.startsWith('data:')
  }

  private async _resolveUrl(id: string, importer?: string): Promise<[url: string, fsPath: string]> {
    // we don't pass down importee here, because otherwise Vite doesn't resolve it correctly
    // should be checked before normalization, because it removes this prefix
    // TODO: this is a hack, we should find a better way to handle this
    if (importer && id.startsWith(VALID_ID_PREFIX))
      importer = undefined
    const dep = normalizeRequestId(id, this.options.base)
    if (!this.shouldResolveId(dep))
      return [dep, dep]
    const { path, exists } = toFilePath(dep, this.root)
    if (!this.options.resolveId || exists)
      return [dep, path]
    const resolved = await this.options.resolveId(dep, importer)
    // TODO: we need to better handle module resolution when different urls point to the same module
    // if (!resolved) {
    //   const error = new Error(
    //     `Cannot find module '${id}'${importer ? ` imported from '${importer}'` : ''}.`
    //     + '\n\n- If you rely on tsconfig.json\'s "paths" to resolve modules, please install "vite-tsconfig-paths" plugin to handle module resolution.'
    //     + '\n- Make sure you don\'t have relative aliases in your Vitest config. Use absolute paths instead. Read more: https://vitest.dev/guide/common-errors',
    //   )
    //   Object.defineProperty(error, 'code', { value: 'ERR_MODULE_NOT_FOUND', enumerable: true })
    //   Object.defineProperty(error, Symbol.for('vitest.error.not_found.data'), { value: { id: dep, importer }, enumerable: false })
    //   throw error
    // }
    const resolvedId = resolved ? normalizeRequestId(resolved.id, this.options.base) : dep
    return [resolvedId, resolvedId]
  }

  async resolveUrl(id: string, importee?: string) {
    const resolveKey = `resolve:${id}`
    // put info about new import as soon as possible, so we can start tracking it
    this.moduleCache.setByModuleId(resolveKey, { resolving: true })
    try {
      return await this._resolveUrl(id, importee)
    }
    finally {
      this.moduleCache.deleteByModuleId(resolveKey)
    }
  }

  /** @internal */
  async dependencyRequest(id: string, fsPath: string, callstack: string[]) {
    return await this.cachedRequest(id, fsPath, callstack)
  }

  /** @internal */
  async directRequest(id: string, fsPath: string, _callstack: string[]) {
    const moduleId = normalizeModuleId(fsPath)
    const callstack = [..._callstack, moduleId]

    const mod = this.moduleCache.getByModuleId(moduleId)

    const request = async (dep: string) => {
      const [id, depFsPath] = await this.resolveUrl(String(dep), fsPath)
      const depMod = this.moduleCache.getByModuleId(depFsPath)
      depMod.importers.add(moduleId)
      mod.imports.add(depFsPath)

      return this.dependencyRequest(id, depFsPath, callstack)
    }

    const requestStubs = this.options.requestStubs || DEFAULT_REQUEST_STUBS
    if (id in requestStubs)
      return requestStubs[id]

    let { code: transformed, externalize } = await this.options.fetchModule(id)

    if (externalize) {
      debugNative(externalize)
      const { exports } = await this.interopedImport(externalize)
      mod.exports = exports
      return exports
    }

    if (transformed == null)
      throw new Error(`[vite-node] Failed to load "${id}" imported from ${callstack[callstack.length - 2]}`)

    const modulePath = cleanUrl(moduleId)
    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const href = pathToFileURL(modulePath).href
    const meta = { url: href }
    const exports = Object.create(null)
    Object.defineProperty(exports, Symbol.toStringTag, {
      value: 'Module',
      enumerable: false,
      configurable: false,
    })
    // this proxy is triggered only on exports.{name} and module.exports access
    // inside the module itself. imported module is always "exports"
    const cjsExports = new Proxy(exports, {
      get: (target, p, receiver) => {
        if (Reflect.has(target, p))
          return Reflect.get(target, p, receiver)
        return Reflect.get(Object.prototype, p, receiver)
      },
      getPrototypeOf: () => Object.prototype,
      set: (_, p, value) => {
        // treat "module.exports =" the same as "exports.default =" to not have nested "default.default",
        // so "exports.default" becomes the actual module
        if (p === 'default' && this.shouldInterop(modulePath, { default: value }) && cjsExports !== value) {
          exportAll(cjsExports, value)
          exports.default = value
          return true
        }

        if (!Reflect.has(exports, 'default'))
          exports.default = {}

        // returns undefined, when accessing named exports, if default is not an object
        // but is still present inside hasOwnKeys, this is Node behaviour for CJS
        if (isPrimitive(exports.default)) {
          defineExport(exports, p, () => undefined)
          return true
        }

        exports.default[p] = value
        if (p !== 'default')
          defineExport(exports, p, () => value)

        return true
      },
    })

    Object.assign(mod, { code: transformed, exports })
    const __filename = fileURLToPath(href)
    const moduleProxy = {
      set exports(value) {
        exportAll(cjsExports, value)
        exports.default = value
      },
      get exports() {
        return cjsExports
      },
    }

    // Vite hot context
    let hotContext: HotContext | undefined
    if (this.options.createHotContext) {
      Object.defineProperty(meta, 'hot', {
        enumerable: true,
        get: () => {
          hotContext ||= this.options.createHotContext?.(this, moduleId)
          return hotContext
        },
        set: (value) => {
          hotContext = value
        },
      })
    }

    // Be careful when changing this
    // changing context will change amount of code added on line :114 (vm.runInThisContext)
    // this messes up sourcemaps for coverage
    // adjust `WRAPPER_LENGTH` variable in packages/coverage-v8/src/provider.ts if you do change this
    const context = this.prepareContext({
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: meta,

      // cjs compact
      require: createRequire(href),
      exports: cjsExports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    })

    debugExecute(__filename)

    // remove shebang
    if (transformed[0] === '#')
      transformed = transformed.replace(/^\#\!.*/, s => ' '.repeat(s.length))

    await this.runModule(context, transformed)

    return exports
  }

  async runModule(context: Record<string, any>, transformed: string) {
    const vmContext = this.options.context
    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(',')})=>{{`
    const code = `${codeDefinition}${transformed}\n}}`
    const options = {
      filename: context.__filename,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    if (vmContext) {
      const fn = vm.runInContext(code, vmContext, {
        ...options,
        // if we encountered an import, it's not inlined
        importModuleDynamically: this.importModuleDynamically.bind(this) as any,
      })
      await fn(...Object.values(context))
    }
    else {
      const fn = vm.runInThisContext(code, options)
      await fn(...Object.values(context))
    }
  }

  async importModuleDynamically(specifier: string, script: vm.Script) {
    const vmContext = this.options.context
    if (!vmContext)
      throw new Error('[vite-node] importModuleDynamically is not supported without a context')

    // @ts-expect-error - private API
    const moduleUrl = await resolveModule(specifier, script.identifier)
    return this.createModule(moduleUrl.toString())
  }

  private async createModule(identifier: string) {
    const vmContext = this.options.context!
    const { format, module } = await this.interopedImport(identifier)
    if (format === 'esm')
      return module
    const moduleKeys = Object.keys(module)
    const importModuleDynamically = this.importModuleDynamically.bind(this)
    const m: any = new vm.SyntheticModule(
      // TODO: fix "default" shenanigans
      Array.from(new Set([...moduleKeys, 'default'])),
      () => {
        for (const key of moduleKeys)
          m.setExport(key, module[key])
        if (format === 'cjs' && !moduleKeys.includes('default'))
          m.setExport('default', module)
      },
      {
        context: vmContext,
        identifier,
        // @ts-expect-error actually supported
        importModuleDynamically,
      },
    )

    if (m.status === 'unlinked')
      await m.link(importModuleDynamically)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  prepareContext(context: Record<string, any>) {
    return context
  }

  /**
   * Define if a module should be interop-ed
   * This function mostly for the ability to override by subclass
   */
  shouldInterop(path: string, mod: any) {
    if (this.options.interopDefault === false)
      return false
    // never interop ESM modules
    // TODO: should also skip for `.js` with `type="module"`
    return !path.endsWith('.mjs') && 'default' in mod
  }

  async externalizedImport(identifier: string) {
    const vmContext = this.options.context

    if (!vmContext || isNodeBuiltin(identifier))
      return { format: 'builtin', module: await import(identifier) }

    const importModuleDynamically = this.importModuleDynamically.bind(this) as any
    const fileUrl = identifier.startsWith('file:') ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = identifier.startsWith('file:') ? fileURLToPath(identifier) : identifier

    // TODO: dependencies are in the loop
    const mod = this.externalCache.get(pathUrl)

    if (mod.promise)
      return await mod.promise

    const content = await readFile(pathUrl, 'utf-8')

    // TODO: dirty check
    if (!hasESMSyntax(content)) {
      const cjsModule = `(function (exports, require, module, __filename, __dirname) { ${content} })`
      const fn = vm.runInContext(cjsModule, vmContext, {
        filename: pathUrl,
      })
      const exports = mod.exports ??= (mod.exports = {})
      const module = { exports }
      const require = createRequire(fileUrl)
      const __dirname = dirname(pathUrl)
      fn(module.exports, require, module, pathUrl, __dirname)
      return { format: 'cjs', module: exports }
    }

    const m = new vm.SourceTextModule(
      content,
      {
        identifier: fileUrl,
        context: vmContext,
        importModuleDynamically,
        initializeImportMeta(meta, mod) {
          meta.url = mod.identifier
        },
      },
    )

    const promise = new Promise((resolve) => {
      const result = { format: 'esm', module: m }
      const finish = () => resolve(result)
      if (m.status === 'unlinked') {
        m.link(importModuleDynamically).then(() => {
          if (m.status === 'linked')
            m.evaluate().then(finish)
          else
            finish()
        })
      }
      else {
        finish()
      }
    })

    mod.promise = promise

    return await promise
  }

  /**
   * Import a module and interop it
   */
  async interopedImport(path: string) {
    const { format, module: importedModule } = await this.externalizedImport(path)

    let namespace
    if (importedModule instanceof vm.Module)
      namespace = importedModule.namespace
    else
      namespace = importedModule

    if (!this.shouldInterop(path, namespace))
      return { format, exports: namespace, module: importedModule }

    const { mod, defaultExport } = interopModule(namespace)

    const exports = new Proxy(mod, {
      get(mod, prop) {
        if (prop === 'default')
          return defaultExport
        return mod[prop] ?? defaultExport?.[prop]
      },
      has(mod, prop) {
        if (prop === 'default')
          return defaultExport !== undefined
        return prop in mod || (defaultExport && prop in defaultExport)
      },
      getOwnPropertyDescriptor(mod, prop) {
        const descriptor = Reflect.getOwnPropertyDescriptor(mod, prop)
        if (descriptor)
          return descriptor
        if (prop === 'default' && defaultExport !== undefined) {
          return {
            value: defaultExport,
            enumerable: true,
            configurable: true,
          }
        }
      },
    })

    return { format, exports, module: importedModule }
  }
}

function interopModule(mod: any) {
  if (isPrimitive(mod)) {
    return {
      mod: { default: mod },
      defaultExport: mod,
    }
  }

  let defaultExport = 'default' in mod ? mod.default : mod

  if (!isPrimitive(defaultExport) && '__esModule' in defaultExport) {
    mod = defaultExport
    if ('default' in defaultExport)
      defaultExport = defaultExport.default
  }

  return { mod, defaultExport }
}

// keep consistency with Vite on how exports are defined
function defineExport(exports: any, key: string | symbol, value: () => any) {
  Object.defineProperty(exports, key, {
    enumerable: true,
    configurable: true,
    get: value,
  })
}

function exportAll(exports: any, sourceModule: any) {
  // #1120 when a module exports itself it causes
  // call stack error
  if (exports === sourceModule)
    return

  if (isPrimitive(sourceModule) || Array.isArray(sourceModule) || sourceModule instanceof Promise)
    return

  for (const key in sourceModule) {
    if (key !== 'default') {
      try {
        defineExport(exports, key, () => sourceModule[key])
      }
      catch (_err) { }
    }
  }
}
