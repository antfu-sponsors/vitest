import type { ElementHandle } from 'playwright'
import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const selectOptions: UserEventCommand<UserEvent['selectOptions']> = async (
  context,
  xpath,
  userValues,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const value = userValues as any as (string | { element: string })[]
    const { frame } = context
    const selectElement = frame.locator(`xpath=${xpath}`)

    const values = await Promise.all(value.map(async (v) => {
      if (typeof v === 'string') {
        return v
      }
      const elementHandler = await frame.locator(`xpath=${v.element}`).elementHandle()
      if (!elementHandler) {
        throw new Error(`Element not found: ${v.element}`)
      }
      return elementHandler
    })) as (readonly string[]) | (readonly ElementHandle[])

    await selectElement.selectOption(values)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const values = userValues as any as [({ index: number })]

    if (!values.length) {
      return
    }

    const markedXpath = `//${xpath}`
    const browser = context.browser

    if (values.length === 1 && 'index' in values[0]) {
      const selectElement = browser.$(markedXpath)
      await selectElement.selectByIndex(values[0].index)
    }
    else {
      throw new Error('Provider "webdriverio" doesn\'t support selecting multiple values at once')
    }
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" doesn't support selectOptions command`)
  }
}
