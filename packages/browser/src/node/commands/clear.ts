import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const clear: UserEventCommand<UserEvent['clear']> = async (
  context,
  selector,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const element = iframe.locator(selector)
    await element.clear({
      timeout: 1000,
    })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const element = await browser.$(selector)
    await element.clearValue()
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support clearing elements`)
  }
}
