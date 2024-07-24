import type { SerializedCoverageConfig } from '../runtime/config'
import type {
  CoverageProvider,
  CoverageProviderModule,
} from '../node/types/coverage'

interface Loader {
  executeId: (id: string) => Promise<{ default: CoverageProviderModule }>
}

export const CoverageProviderMap: Record<string, string> = {
  v8: '@vitest/coverage-v8',
  istanbul: '@vitest/coverage-istanbul',
}

async function resolveCoverageProviderModule(
  options: SerializedCoverageConfig | undefined,
  loader: Loader,
) {
  if (!options?.enabled || !options.provider) {
    return null
  }

  const provider = options.provider

  if (provider === 'v8' || provider === 'istanbul') {
    const { default: coverageModule } = await loader.executeId(
      CoverageProviderMap[provider],
    )

    if (!coverageModule) {
      throw new Error(
        `Failed to load ${CoverageProviderMap[provider]}. Default export is missing.`,
      )
    }

    return coverageModule
  }

  let customProviderModule

  try {
    customProviderModule = await loader.executeId(options.customProviderModule!)
  }
  catch (error) {
    throw new Error(
      `Failed to load custom CoverageProviderModule from ${options.customProviderModule}`,
      { cause: error },
    )
  }

  if (customProviderModule.default == null) {
    throw new Error(
      `Custom CoverageProviderModule loaded from ${options.customProviderModule} was not the default export`,
    )
  }

  return customProviderModule.default
}

export async function getCoverageProvider(
  options: SerializedCoverageConfig | undefined,
  loader: Loader,
): Promise<CoverageProvider | null> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.getProvider()
  }

  return null
}

export async function startCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: Loader,
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.startCoverage?.()
  }

  return null
}

export async function takeCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: Loader,
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.takeCoverage?.()
  }

  return null
}

export async function stopCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: Loader,
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.stopCoverage?.()
  }

  return null
}
