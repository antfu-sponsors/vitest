import type { BrowserCommand, BrowserProvider } from 'vitest/node'
import type { PreviewBrowserProvider } from '../providers/preview'
import type { WebdriverBrowserProvider } from '../providers/webdriver'
import type { PlaywrightBrowserProvider } from '../providers/playwright'

declare module 'vitest/node' {
  export interface BrowserCommandContext {
    provider: PlaywrightBrowserProvider | WebdriverBrowserProvider | BrowserProvider | PreviewBrowserProvider
  }
}

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>
>

type ConvertElementToLocator<T> = T extends Element ? string : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>
}

export function defineBrowserCommand<T extends unknown[]>(
  fn: BrowserCommand<T>,
): BrowserCommand<T> {
  return fn
}
