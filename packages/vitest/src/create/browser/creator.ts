import { dirname, relative, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import prompt from 'prompts'
import c from 'picocolors'
import type { Agent } from '@antfu/install-pkg'
import { detectPackageManager, installPackage } from '@antfu/install-pkg'
import { findUp } from 'find-up'
import { execa } from 'execa'
import type { BrowserBuiltinProvider } from '../../types/browser'
import { configFiles } from '../../constants'

// eslint-disable-next-line no-console
const log = console.log

function getProviderOptions(): prompt.Choice[] {
  const providers: Record<BrowserBuiltinProvider, string> = {
    playwright: 'Playwright relies on Chrome DevTools protocol. Read more: https://playwright.dev',
    webdriverio: 'WebdriverIO uses WebDriver protocol. Read more: https://webdriver.io',
    preview: 'Preview is useful to quickly run your tests in the browser, but not suitable for CI.',
  }

  return Object.entries(providers).map<prompt.Choice>(([provider, description]) => {
    return {
      title: provider,
      description,
      value: provider,
    }
  })
}

function getBrowserNames(provider: BrowserBuiltinProvider) {
  switch (provider) {
    case 'webdriverio':
      return ['chrome', 'firefox', 'edge', 'safari']
    case 'playwright':
      return ['chromium', 'firefox', 'webkit']
    case 'preview':
      return ['chrome', 'firefox', 'safari']
  }
}

function getProviderPackageNames(provider: BrowserBuiltinProvider) {
  switch (provider) {
    case 'webdriverio':
      return {
        types: '@vitest/browser/providers/webdriverio',
        pkg: 'webdriverio',
      }
    case 'playwright':
      return {
        types: '@vitest/browser/providers/playwright',
        pkg: 'playwright',
      }
    case 'preview':
      return {
        types: '@vitest/browser/matchers',
        pkg: null,
      }
  }
  throw new Error(`Unsupported provider: ${provider}`)
}

function getFramework(): prompt.Choice[] {
  return [
    {
      title: 'vanilla',
      value: 'vanilla',
      description: 'No framework, just plain JavaScript or TypeScript.',
    },
    {
      title: 'vue',
      value: 'vue',
      description: '"The Progressive JavaScript Framework"',
    },
    {
      title: 'svelte',
      value: 'svelte',
      description: '"Svelte: cybernetically enhanced web apps"',
    },
    {
      title: 'react',
      value: 'react',
      description: '"The library for web and native user interfaces"',
    },
    {
      title: 'preact',
      value: 'preact',
      description: '"Fast 3kB alternative to React with the same modern API"',
    },
    {
      title: 'solid',
      value: 'solid',
      description: '"Simple and performant reactivity for building user interfaces"',
    },
    {
      title: 'marko',
      value: 'marko',
      description: '"A declarative, HTML-based language that makes building web apps fun"',
    },
  ]
}

function getFrameworkTestPackage(framework: string) {
  switch (framework) {
    case 'vanilla':
      return '@testing-library/dom'
    case 'vue':
      return '@testing-library/vue'
    case 'svelte':
      return '@testing-library/svelte'
    case 'react':
      return '@testing-library/react'
    case 'preact':
      return '@testing-library/preact'
    case 'solid':
      return '@testing-library/solid'
    case 'marko':
      return '@marko/testing-library'
  }
  throw new Error(`Unsupported framework: ${framework}`)
}

function getFrameworkPluginPackage(framework: string) {
  switch (framework) {
    case 'vue':
      return '@vitejs/plugin-vue'
    case 'svelte':
      return '@sveltejs/vite-plugin-svelte'
    case 'react':
      return '@vitejs/plugin-react'
    case 'preact':
      return '@preact/preset-vite'
    case 'solid':
      return 'vite-plugin-solid'
    case 'marko':
      return '@marko/vite'
  }
  return null
}

async function updateTsConfig(type: string | undefined | null) {
  if (type == null) {
    return
  }
  const msg = `Add "${c.bold(type)}" to your tsconfig.json "${c.bold('compilerOptions.types')}" field to have better intellisense support.`
  log()
  log(c.bgYellow(` NOTE `), c.yellow(msg))
}

function getLanguageOptions(): prompt.Choice[] {
  return [
    {
      title: 'TypeScript',
      description: 'Use TypeScript.',
      value: 'ts',
    },
    {
      title: 'JavaScript',
      description: 'Use plain JavaScript.',
      value: 'js',
    },
  ]
}

async function installPackages(pkgManager: string | null, packages: string[]) {
  if (!packages.length) {
    log(c.green('✔'), c.bold('All packages are already installed.'))
    return
  }

  log(c.cyan('◼'), c.bold('Installing packages...'))
  log(c.cyan('◼'), packages.join(', '))

  // TODO: REMOVE
  const _test: boolean = false
  if (_test) {
    await installPackage(packages, { dev: true, packageManager: pkgManager ?? undefined })
  }
}

function readPkgJson(path: string) {
  if (!existsSync(path)) {
    return null
  }
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content)
}

function getPossibleDefaults(dependencies: any) {
  const provider = getPossibleProvider(dependencies)
  const framework = getPossibleFramework(dependencies)
  return {
    lang: 'ts',
    provider,
    framework,
  }
}

function getPossibleFramework(dependencies: Record<string, string>) {
  if (dependencies.vue || dependencies['vue-tsc'] || dependencies['@vue/reactivity']) {
    return 'vue'
  }
  if (dependencies.react || dependencies['react-dom']) {
    return 'react'
  }
  if (dependencies.svelte || dependencies['@sveltejs/kit']) {
    return 'svelte'
  }
  if (dependencies.preact) {
    return 'preact'
  }
  if (dependencies['solid-js'] || dependencies['@solidjs/start']) {
    return 'solid'
  }
  if (dependencies.marko) {
    return 'marko'
  }
  return 'vanilla'
}

function getPossibleProvider(dependencies: Record<string, string>) {
  if (dependencies.webdriverio || dependencies['@wdio/cli'] || dependencies['@wdio/config']) {
    return 'webdriverio'
  }
  // playwright is the default recommendation
  return 'playwright'
}

function getProviderDocsLink(provider: string) {
  switch (provider) {
    case 'playwright':
      return 'https://playwright.dev'
    case 'webdriverio':
      return 'https://webdriver.io'
  }
}

function sort(choices: prompt.Choice[], value: string | undefined) {
  const index = choices.findIndex(i => i.value === value)
  if (index === -1) {
    return choices
  }
  const item = choices.splice(index, 1)[0]
  return [item, ...choices]
}

function fail() {
  process.exitCode = 1
}

async function generateWorkspaceFile(options: {
  configPath: string
  rootConfig: string
  provider: string
  browser: string
}) {
  const relativeRoot = relative(dirname(options.configPath), options.rootConfig)
  const workspaceContent = [
    `import { defineWorkspace } from 'vitest/config'`,
    '',
    'export default defineWorkspace([',
    `  ${relativeRoot},`,
    `  {`,
    `    extends: '${relativeRoot}',`,
    `    test: {`,
    `      browser: {`,
    `        enabled: true,`,
    `        name: '${options.browser}',`,
    `        provider: '${options.provider}',`,
    options.provider !== 'preview' && `        // Docs: ${getProviderDocsLink(options.provider)}`,
    options.provider !== 'preview' && `        providerOptions: {}`,
    `      },`,
    `    }`,
    `  }`,
    `])`,
    '',
  ].filter(c => c != null).join('\n')
  await writeFile(options.configPath, workspaceContent)
}

async function generateFrameworkConfigFile(options: {
  configPath: string
  framework: string
  frameworkPlugin: string | null
  provider: string
  browser: string
}) {
  const frameworkImport = options.framework === 'svelte'
    ? `import { svelte } from '${options.frameworkPlugin}'`
    : `import ${options.framework} from '${options.frameworkPlugin}'`
  const configContent = [
    `import { defineConfig } from 'vitest/config'`,
    options.frameworkPlugin && frameworkImport,
    ``,
    'export default defineConfig({',
    options.frameworkPlugin && `  plugins: [${options.framework}()]`,
    `  test: {`,
    `    browser: {`,
    `      enabled: true,`,
    `      name: '${options.browser}',`,
    `      provider: '${options.provider}',`,
    options.provider !== 'preview' && `      // Docs: ${getProviderDocsLink(options.provider)}`,
    options.provider !== 'preview' && `      providerOptions: {}`,
    `    },`,
    `  }`,
    `})`,
    '',
  ].join('\n')
  // this file is only generated if there is already NO root config which is an edge case
  await writeFile(options.configPath, configContent)
}

async function updatePkgJsonScripts(pkgJsonPath: string, vitestScript: string) {
  if (!existsSync(pkgJsonPath)) {
    const pkg = {
      scripts: {
        'test:browser': vitestScript,
      },
    }
    await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2))
  }
  else {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    pkg.script = pkg.scripts || {}
    pkg.scripts['test:browser'] = vitestScript
    await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2), 'utf-8')
  }
  log(c.green('✔'), 'Added "test:browser" script to your package.json.')
}

function getRunScript(pkgManager: Agent | null) {
  switch (pkgManager) {
    case 'yarn@berry':
    case 'yarn':
      return 'yarn test:browser'
    case 'pnpm@6':
    case 'pnpm':
      return 'pnpm test:browser'
    case 'bun':
      return 'bun test:browser'
    default:
      return 'npm run test:browser'
  }
}

async function create() {
  log(c.cyan('◼'), 'This utility will help you set up a browser testing environment.\n')

  const pkgJsonPath = resolve(process.cwd(), 'package.json')
  const pkg = readPkgJson(pkgJsonPath) || {}
  const dependencies = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  const defaults = getPossibleDefaults(dependencies)

  const { lang } = await prompt({
    type: 'select',
    name: 'lang',
    message: 'Choose a language for your tests',
    choices: sort(getLanguageOptions(), defaults?.lang),
  })

  if (!lang) {
    return fail()
  }

  const { nodeTests } = await prompt({
    type: 'confirm',
    name: 'nodeTests',
    message: 'Do you want to keep running some tests in Node.js?',
  })

  if (nodeTests == null) {
    return fail()
  }

  const { provider } = await prompt({
    type: 'select',
    name: 'provider',
    message: 'Choose a browser provider. Vitest will use its API to control the testing environment',
    choices: sort(getProviderOptions(), defaults?.provider),
  })
  if (!provider) {
    return fail()
  }

  const { browser } = await prompt({
    type: 'select',
    name: 'browser',
    message: 'Choose a browser',
    choices: getBrowserNames(provider).map(browser => ({
      title: browser,
      value: browser,
    })),
  })
  if (!provider) {
    return fail()
  }

  const { framework } = await prompt({
    type: 'select',
    name: 'framework',
    message: 'Choose your framework',
    choices: sort(getFramework(), defaults?.framework),
  })
  if (!framework) {
    return fail()
  }

  const dependenciesToInstall = [
    '@vitest/browser',
    getFrameworkTestPackage(framework),
  ]

  const providerPkg = getProviderPackageNames(provider)
  if (providerPkg.pkg) {
    dependenciesToInstall.push(providerPkg.pkg)
  }
  const frameworkPlugin = getFrameworkPluginPackage(framework)
  if (frameworkPlugin) {
    dependenciesToInstall.push(frameworkPlugin)
  }

  const pkgManager = await detectPackageManager()

  log()
  await installPackages(
    pkgManager,
    dependenciesToInstall.filter(pkg => !dependencies[pkg]),
  )

  const rootConfig = await findUp(configFiles, {
    cwd: process.cwd(),
  })

  let scriptCommand = 'vitest'

  if (rootConfig) {
    let browserWorkspaceFile = resolve(dirname(rootConfig), `vitest.workspace.${lang}`)
    if (existsSync(browserWorkspaceFile)) {
      log(c.yellow('⚠'), c.yellow('A workspace file already exists. Creating a new one for the browser tests - you can merge them manually if needed.'))
      browserWorkspaceFile = resolve(process.cwd(), `vitest.workspace.browser.${lang}`)
    }
    scriptCommand = `vitest --workspace=${relative(process.cwd(), browserWorkspaceFile)}`
    await generateWorkspaceFile({
      configPath: browserWorkspaceFile,
      rootConfig,
      provider,
      browser,
    })
    log(c.green('✔'), 'Created a workspace file for browser tests.')
  }
  else {
    const configPath = resolve(process.cwd(), `vitest.config.${lang}`)
    await generateFrameworkConfigFile({
      configPath,
      framework,
      frameworkPlugin,
      provider,
      browser,
    })
    log(c.green('✔'), 'Created a config file for browser tests.')
  }

  if (lang === 'ts') {
    await updateTsConfig(providerPkg?.types)
  }

  log()

  await updatePkgJsonScripts(pkgJsonPath, scriptCommand)

  if (provider === 'playwright') {
    log()
    await execa('npx', ['playwright', 'install', '--with-deps'])
  }

  log(c.cyan('◼'), 'All done! Run your tests with', c.bold(getRunScript(pkgManager)))

  console.error('result', {
    provider,
    lang,
    framework,
    browser,
  })
}

await create()
