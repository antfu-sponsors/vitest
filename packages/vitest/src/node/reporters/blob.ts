import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { parse, stringify } from 'flatted'
import { dirname, resolve } from 'pathe'
import type { File } from '@vitest/runner'
import { getOutputFile } from '../../utils/config-helpers'
import type { WorkspaceProject } from '../workspace'
import type { Reporter } from '../types/reporter'
import type { Vitest } from '../core'

export interface BlobOptions {
  outputFile?: string
}

export class BlobReporter implements Reporter {
  ctx!: Vitest
  options: BlobOptions

  constructor(options: BlobOptions) {
    this.options = options
  }

  onInit(ctx: Vitest): void {
    if (ctx.config.watch) {
      throw new Error('Blob reporter is not supported in watch mode')
    }

    this.ctx = ctx
  }

  async onFinished(
    files: File[] = [],
    errors: unknown[] = [],
    coverage: unknown,
  ) {
    let outputFile
      = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob')
    if (!outputFile) {
      const shard = this.ctx.config.shard
      outputFile = shard
        ? `.vitest-reports/blob-${shard.index}-${shard.count}.json`
        : '.vitest-reports/blob.json'
    }

    const modules = this.ctx.projects.map<MergeReportModuleKeys>(
      (project) => {
        return [
          project.getName(),
          [...project.server.moduleGraph.idToModuleMap.entries()].map<SerializedModuleNode | null>((mod) => {
            if (!mod[1].file) {
              return null
            }
            return [mod[0], mod[1].file, mod[1].url]
          }).filter(x => x != null),
        ]
      },
    )

    const report = stringify([
      this.ctx.version,
      files,
      errors,
      modules,
      coverage,
    ] satisfies MergeReport)

    const reportFile = resolve(this.ctx.config.root, outputFile)

    const dir = dirname(reportFile)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    await writeFile(reportFile, report, 'utf-8')
    this.ctx.logger.log('blob report written to', reportFile)
  }
}

export async function readBlobs(
  currentVersion: string,
  blobsDirectory: string,
  projectsArray: WorkspaceProject[],
) {
  // using process.cwd() because --merge-reports can only be used in CLI
  const resolvedDir = resolve(process.cwd(), blobsDirectory)
  const blobsFiles = await readdir(resolvedDir)
  const promises = blobsFiles.map(async (filename) => {
    const fullPath = resolve(resolvedDir, filename)
    const stats = await stat(fullPath)
    if (!stats.isFile()) {
      throw new TypeError(
        `vitest.mergeReports() expects all paths in "${blobsDirectory}" to be files generated by the blob reporter, but "${filename}" is not a file`,
      )
    }
    const content = await readFile(fullPath, 'utf-8')
    const [version, files, errors, moduleKeys, coverage] = parse(
      content,
    ) as MergeReport
    if (!version) {
      throw new TypeError(
        `vitest.mergeReports() expects all paths in "${blobsDirectory}" to be files generated by the blob reporter, but "${filename}" is not a valid blob file`,
      )
    }
    return { version, files, errors, moduleKeys, coverage, file: filename }
  })
  const blobs = await Promise.all(promises)

  if (!blobs.length) {
    throw new Error(
      `vitest.mergeReports() requires at least one blob file in "${blobsDirectory}" directory, but none were found`,
    )
  }

  const versions = new Set(blobs.map(blob => blob.version))
  if (versions.size > 1) {
    throw new Error(
      `vitest.mergeReports() requires all blob files to be generated by the same Vitest version, received\n\n${blobs.map(b => `- "${b.file}" uses v${b.version}`).join('\n')}`,
    )
  }

  if (!versions.has(currentVersion)) {
    throw new Error(
      `the blobs in "${blobsDirectory}" were generated by a different version of Vitest. Expected v${currentVersion}, but received v${blobs[0].version}`,
    )
  }

  // fake module graph - it is used to check if module is imported, but we don't use values inside
  const projects = Object.fromEntries(
    projectsArray.map(p => [p.getName(), p]),
  )

  blobs.forEach((blob) => {
    blob.moduleKeys.forEach(([projectName, moduleIds]) => {
      const project = projects[projectName]
      if (!project) {
        return
      }
      moduleIds.forEach(([moduleId, file, url]) => {
        const moduleNode = project.server.moduleGraph.createFileOnlyEntry(file)
        moduleNode.url = url
        moduleNode.id = moduleId
        project.server.moduleGraph.idToModuleMap.set(moduleId, moduleNode)
      })
    })
  })

  const files = blobs
    .flatMap(blob => blob.files)
    .sort((f1, f2) => {
      const time1 = f1.result?.startTime || 0
      const time2 = f2.result?.startTime || 0
      return time1 - time2
    })
  const errors = blobs.flatMap(blob => blob.errors)
  const coverages = blobs.map(blob => blob.coverage)

  return {
    files,
    errors,
    coverages,
  }
}

type MergeReport = [
  vitestVersion: string,
  files: File[],
  errors: unknown[],
  modules: MergeReportModuleKeys[],
  coverage: unknown,
]

type SerializedModuleNode = [
  id: string,
  file: string,
  url: string,
]

type MergeReportModuleKeys = [
  projectName: string,
  modules: SerializedModuleNode[],
]
