import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  selector,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    await context.iframe.locator(selector).hover({
      timeout: 1000,
      ...options,
    })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await browser.$(selector).moveTo(options)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support hover`)
  }
}
