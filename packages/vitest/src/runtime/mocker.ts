import { existsSync, readdirSync } from 'fs'
import { isNodeBuiltin } from 'mlly'
import { basename, dirname, resolve } from 'pathe'
import { normalizeRequestId, toFilePath } from 'vite-node/utils'
import type { ModuleCacheMap } from 'vite-node/client'
import { getAllProperties, getType, getWorkerState, isWindows, mergeSlashes, slash } from '../utils'
import { distDir } from '../constants'
import type { PendingSuiteMock } from '../types/mocker'
import type { ExecuteOptions } from './execute'

type Callback = (...args: any[]) => unknown

interface ViteRunnerRequest {
  (dep: string): any
  callstack: string[]
}

export class VitestMocker {
  private static pendingIds: PendingSuiteMock[] = []
  private static spyModule?: typeof import('../integrations/spy')

  private request!: ViteRunnerRequest

  private root: string
  private callbacks: Record<string, ((...args: any[]) => unknown)[]> = {}

  constructor(
    public options: ExecuteOptions,
    private moduleCache: ModuleCacheMap,
    request?: ViteRunnerRequest,
  ) {
    this.root = this.options.root
    this.request = request!
  }

  get mockMap() {
    return this.options.mockMap
  }

  public on(event: string, cb: Callback) {
    this.callbacks[event] ??= []
    this.callbacks[event].push(cb)
  }

  private emit(event: string, ...args: any[]) {
    (this.callbacks[event] ?? []).forEach(fn => fn(...args))
  }

  public getSuiteFilepath(): string {
    return getWorkerState().filepath || 'global'
  }

  public getMocks() {
    const suite = this.getSuiteFilepath()
    const suiteMocks = this.mockMap.get(suite)
    const globalMocks = this.mockMap.get('global')

    return {
      ...globalMocks,
      ...suiteMocks,
    }
  }

  private async resolvePath(id: string, importer: string) {
    const path = await this.options.resolveId!(id, importer)
    // external is node_module or unresolved module
    // for example, some people mock "vscode" and don't have it installed
    const external = path == null || path.id.includes('/node_modules/') ? id : null

    return {
      path: normalizeRequestId(path?.id || id),
      external,
    }
  }

  private async resolveMocks() {
    await Promise.all(VitestMocker.pendingIds.map(async (mock) => {
      const { path, external } = await this.resolvePath(mock.id, mock.importer)
      if (mock.type === 'unmock')
        this.unmockPath(path)
      if (mock.type === 'mock')
        this.mockPath(path, external, mock.factory)
    }))

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: () => any) {
    const cacheName = `${dep}__mock`
    const cached = this.moduleCache.get(cacheName)?.exports
    if (cached)
      return cached
    const exports = await mock()
    this.emit('mocked', cacheName, { exports })
    return exports
  }

  public getDependencyMock(dep: string) {
    return this.getMocks()[this.resolveDependency(dep)]
  }

  public resolveDependency(dep: string) {
    return normalizeRequestId(dep).replace(/^\/@fs\//, isWindows ? '' : '/')
  }

  public normalizePath(path: string) {
    return normalizeRequestId(path.replace(this.root, '')).replace(/^\/@fs\//, isWindows ? '' : '/')
  }

  public getFsPath(path: string, external: string | null) {
    if (external)
      return mergeSlashes(`/@fs/${path}`)

    return normalizeRequestId(path.replace(this.root, ''))
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = normalizeRequestId(external || mockPath)

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const mockFolder = resolve(this.root, '__mocks__', mockDirname)

      if (!existsSync(mockFolder))
        return null

      const files = readdirSync(mockFolder)
      const baseFilename = basename(path)

      for (const file of files) {
        const [basename] = file.split('.')
        if (basename === baseFilename)
          return resolve(mockFolder, file).replace(this.root, '')
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath.replace(this.root, '') : null
  }

  public mockValue(value: any) {
    if (!VitestMocker.spyModule) {
      throw new Error(
        'Error: Spy module is not defined. '
        + 'This is likely an internal bug in Vitest. '
        + 'Please report it to https://github.com/vitest-dev/vitest/issues')
    }

    const type = getType(value)

    if (Array.isArray(value))
      return []
    else if (type !== 'Object' && type !== 'Module')
      return value

    const newObj: Record<string | symbol, any> = {}

    const properties = getAllProperties(value)

    for (const k of properties) {
      newObj[k] = this.mockValue(value[k])
      const type = getType(value[k])

      if (type.includes('Function') && !value[k]._isMockFunction) {
        VitestMocker.spyModule.spyOn(newObj, k).mockImplementation(() => undefined)
        Object.defineProperty(newObj[k], 'length', { value: 0 }) // tinyspy retains length, but jest doesnt
      }
    }

    // should be defined after object, because it may contain
    // special logic on getting/settings properties
    // and we don't want to invoke it
    Object.setPrototypeOf(newObj, Object.getPrototypeOf(value))
    return newObj
  }

  public unmockPath(path: string) {
    const suitefile = this.getSuiteFilepath()

    const fsPath = this.normalizePath(path)

    const mock = this.mockMap.get(suitefile)
    if (mock?.[fsPath])
      delete mock[fsPath]
  }

  public mockPath(path: string, external: string | null, factory?: () => any) {
    const suitefile = this.getSuiteFilepath()

    const fsPath = this.normalizePath(path)

    if (!this.mockMap.has(suitefile))
      this.mockMap.set(suitefile, {})

    this.mockMap.get(suitefile)![fsPath] = factory || this.resolveMockPath(path, external)
  }

  public async importActual<T>(id: string, importer: string): Promise<T> {
    const { path, external } = await this.resolvePath(id, importer)
    const fsPath = this.getFsPath(path, external)
    const result = await this.request(fsPath)
    return result as T
  }

  public async importMock(id: string, importer: string): Promise<any> {
    const { path, external } = await this.resolvePath(id, importer)

    let mock = this.getDependencyMock(path)

    if (mock === undefined)
      mock = this.resolveMockPath(path, external)

    if (mock === null) {
      await this.ensureSpy()
      const fsPath = this.getFsPath(path, external)
      const mod = await this.request(fsPath)
      return this.mockValue(mod)
    }
    if (typeof mock === 'function')
      return this.callFunctionMock(path, mock)
    return this.requestWithMock(mock)
  }

  private async ensureSpy() {
    if (VitestMocker.spyModule)
      return
    VitestMocker.spyModule = await this.request(`/@fs/${slash(resolve(distDir, 'spy.js'))}`) as typeof import('../integrations/spy')
  }

  public async requestWithMock(dep: string) {
    await this.ensureSpy()
    await this.resolveMocks()

    const mock = this.getDependencyMock(dep)

    const callstack = this.request.callstack

    if (mock === null) {
      const cacheName = `${dep}__mock`
      const cache = this.moduleCache.get(cacheName)
      if (cache?.exports)
        return cache.exports
      const cacheKey = toFilePath(dep, this.root)
      const mod = this.moduleCache.get(cacheKey)?.exports || await this.request(dep)
      const exports = this.mockValue(mod)
      this.emit('mocked', cacheName, { exports })
      return exports
    }
    if (typeof mock === 'function' && !callstack.includes(`mock:${dep}`)) {
      callstack.push(`mock:${dep}`)
      const result = await this.callFunctionMock(dep, mock)
      const indexMock = callstack.indexOf(`mock:${dep}`)
      callstack.splice(indexMock, 1)
      return result
    }
    if (typeof mock === 'string' && !callstack.includes(mock))
      dep = mock
    return this.request(dep)
  }

  public queueMock(id: string, importer: string, factory?: () => unknown) {
    VitestMocker.pendingIds.push({ type: 'mock', id, importer, factory })
  }

  public queueUnmock(id: string, importer: string) {
    VitestMocker.pendingIds.push({ type: 'unmock', id, importer })
  }

  public withRequest(request: ViteRunnerRequest) {
    return new VitestMocker(this.options, this.moduleCache, request)
  }
}
