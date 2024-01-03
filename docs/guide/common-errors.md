---
title: Common Errors | Guide
---

# Common Errors

## Cannot find module './relative-path'

If you receive an error that module cannot be found, it might mean several different things:

- 1. You misspelled the path. Make sure the path is correct.

- 2. It's possible that your rely on `baseUrl` in your `tsconfig.json`. Vite doesn't take into account `tsconfig.json` by default, so you might need to install [`vite-tsconfig-paths`](https://www.npmjs.com/package/vite-tsconfig-paths) yourself, if you rely on this behaviour.

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()]
})
```

Or rewrite your path to not be relative to root:

```diff
- import helpers from 'src/helpers'
+ import helpers from '../src/helpers'
```

- 3. Make sure you don't have relative [aliases](/config/#alias). Vite treats them as relative to the file where the import is instead of the root.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@/': './src/', // [!code --]
      '@/': new URL('./src/', import.meta.url).pathname, // [!code ++]
    }
  }
})
```

## Cannot mock "./mocked-file.js" because it is already loaded

This error happens when `vi.mock` or `vi.doMock` methods are called on modules that were already loaded. Vitest throws this error because this call has no effect because cached modules are preferred.

If you are getting this error for `vi.mock`, remember that `vi.mock` is always hoisted - it means that the module was loaded before the test file started executing - most likely in a setup file. To fix the error, remove the import or clear the cache at the end of a setup file - beware that setup file and your test file will reference different modules in that case.

```ts
// setupFile.js
import { vi } from 'vitest'
import { sideEffect } from './mocked-file.js'

sideEffect()

vi.resetModules()
```

If you are getting this error with `vi.doMock`, it means the file was already imported during test file execution or inside the setup file. If it was imported in the setup file, follow instruction from the previous paragraph. Otherwise it is possible that you are testing different module behaviours - so make sure to call `vi.resetModules` before mocking a module:

```ts
import { beforeEach, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules() // this will reset all modules cache
})

it('total is big', async () => {
  vi.doMock('./mocked-file.js', () => ({ total: 100 }))

  const { total } = await import('./mocked-file.js')
  expect(total).toBe(100)
})

it('total is bigger', async () => {
  vi.doMock('./mocked-file.js', () => ({ total: 200 }))

  const { total } = await import('./mocked-file.js')
  expect(total).toBe(200)
})
```