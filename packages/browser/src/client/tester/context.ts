import type { Task, WorkerGlobalState } from 'vitest'
import type { BrowserRPC } from '@vitest/browser/client'
import type { BrowserPage, UserEvent, UserEventClickOptions, UserEventHoverOptions, UserEventTabOptions, UserEventTypeOptions } from '../../../context'
import type { BrowserRunnerState } from '../utils'

// this file should not import anything directly, only types

// @ts-expect-error not typed global
const state = (): WorkerGlobalState => __vitest_worker__
// @ts-expect-error not typed global
const runner = (): BrowserRunnerState => __vitest_browser_runner__
function filepath() {
  return state().filepath || state().current?.file?.filepath || undefined
}
const rpc = () => state().rpc as any as BrowserRPC
const contextId = runner().contextId
const channel = new BroadcastChannel(`vitest:${contextId}`)

function triggerCommand<T>(command: string, ...args: any[]) {
  return rpc().triggerCommand<T>(contextId, command, filepath(), args)
}

const provider = runner().provider

function convertElementToCssSelector(element: Element) {
  if (!element || !(element instanceof Element)) {
    throw new Error(
      `Expected DOM element to be an instance of Element, received ${typeof element}`,
    )
  }

  return getUniqueCssSelector(element)
}

function escapeIdForCSSSelector(id: string) {
  return id
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)

      if (char === ' ' || char === '#' || char === '.' || char === ':' || char === '[' || char === ']' || char === '>' || char === '+' || char === '~' || char === '\\') {
        // Escape common special characters with backslashes
        return `\\${char}`
      }
      else if (code >= 0x10000) {
        // Unicode escape for characters outside the BMP
        return `\\${code.toString(16).toUpperCase().padStart(6, '0')} `
      }
      else if (code < 0x20 || code === 0x7F) {
        // Non-printable ASCII characters (0x00-0x1F and 0x7F) are escaped
        return `\\${code.toString(16).toUpperCase().padStart(2, '0')} `
      }
      else if (code >= 0x80) {
        // Non-ASCII characters (0x80 and above) are escaped
        return `\\${code.toString(16).toUpperCase().padStart(2, '0')} `
      }
      else {
        // Allowable characters are used directly
        return char
      }
    })
    .join('')
}

function getUniqueCssSelector(el: Element) {
  const path = []
  let parent: null | ParentNode
  let hasShadowRoot = false
  // eslint-disable-next-line no-cond-assign
  while (parent = getParent(el)) {
    if ((parent as Element).shadowRoot) {
      hasShadowRoot = true
    }

    const tag = el.tagName
    if (el.id) {
      path.push(`#${escapeIdForCSSSelector(el.id)}`)
    }
    else if (!el.nextElementSibling && !el.previousElementSibling) {
      path.push(tag.toLowerCase())
    }
    else {
      let index = 0
      let sameTagSiblings = 0
      let elementIndex = 0

      for (const sibling of parent.children) {
        index++
        if (sibling.tagName === tag) {
          sameTagSiblings++
        }
        if (sibling === el) {
          elementIndex = index
        }
      }

      if (sameTagSiblings > 1) {
        path.push(`${tag.toLowerCase()}:nth-child(${elementIndex})`)
      }
      else {
        path.push(tag.toLowerCase())
      }
    }
    el = parent as Element
  };
  return `${provider === 'webdriverio' && hasShadowRoot ? '>>>' : ''}${path.reverse().join(' > ')}`
}

function getParent(el: Element) {
  const parent = el.parentNode
  if (parent instanceof ShadowRoot) {
    return parent.host
  }
  return parent
}

function createUserEvent(): UserEvent {
  const keyboard = {
    unreleased: [] as string[],
  }

  return {
    setup() {
      return createUserEvent()
    },
    click(element: Element, options: UserEventClickOptions = {}) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_click', css, options)
    },
    dblClick(element: Element, options: UserEventClickOptions = {}) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_dblClick', css, options)
    },
    tripleClick(element: Element, options: UserEventClickOptions = {}) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_tripleClick', css, options)
    },
    selectOptions(element, value) {
      const values = provider === 'webdriverio'
        ? getWebdriverioSelectOptions(element, value)
        : getSimpleSelectOptions(element, value)
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_selectOptions', css, values)
    },
    async type(element: Element, text: string, options: UserEventTypeOptions = {}) {
      const css = convertElementToCssSelector(element)
      const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
        '__vitest_type',
        css,
        text,
        { ...options, unreleased: keyboard.unreleased },
      )
      keyboard.unreleased = unreleased
    },
    clear(element: Element) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_clear', css)
    },
    tab(options: UserEventTabOptions = {}) {
      return triggerCommand('__vitest_tab', options)
    },
    async keyboard(text: string) {
      const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
        '__vitest_keyboard',
        text,
        keyboard,
      )
      keyboard.unreleased = unreleased
    },
    hover(element: Element, options: UserEventHoverOptions = {}) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_hover', css, options)
    },
    unhover(element: Element, options: UserEventHoverOptions = {}) {
      const css = convertElementToCssSelector(element.ownerDocument.body)
      return triggerCommand('__vitest_hover', css, options)
    },

    // non userEvent events, but still useful
    fill(element: Element, text: string, options) {
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_fill', css, text, options)
    },
    dragAndDrop(source: Element, target: Element, options = {}) {
      const sourceCss = convertElementToCssSelector(source)
      const targetCss = convertElementToCssSelector(target)
      return triggerCommand('__vitest_dragAndDrop', sourceCss, targetCss, options)
    },
  }
}

export const userEvent: UserEvent = createUserEvent()

function getWebdriverioSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement) {
  const options = [...element.querySelectorAll('option')] as HTMLOptionElement[]

  const arrayValues = Array.isArray(value) ? value : [value]

  if (!arrayValues.length) {
    return []
  }

  if (arrayValues.length > 1) {
    throw new Error('Provider "webdriverio" doesn\'t support selecting multiple values at once')
  }

  const optionValue = arrayValues[0]

  if (typeof optionValue !== 'string') {
    const index = options.indexOf(optionValue as HTMLOptionElement)
    if (index === -1) {
      throw new Error(`The element ${convertElementToCssSelector(optionValue)} was not found in the "select" options.`)
    }

    return [{ index }]
  }

  const valueIndex = options.findIndex(option => option.value === optionValue)
  if (valueIndex !== -1) {
    return [{ index: valueIndex }]
  }

  const labelIndex = options.findIndex(option =>
    option.textContent?.trim() === optionValue || option.ariaLabel === optionValue,
  )

  if (labelIndex === -1) {
    throw new Error(`The option "${optionValue}" was not found in the "select" options.`)
  }

  return [{ index: labelIndex }]
}

function getSimpleSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement) {
  return (Array.isArray(value) ? value : [value]).map((v) => {
    if (typeof v !== 'string') {
      return { element: convertElementToCssSelector(v) }
    }
    return v
  })
}

export function cdp() {
  return runner().cdp!
}

const screenshotIds: Record<string, Record<string, string>> = {}
export const page: BrowserPage = {
  get config() {
    return runner().config
  },
  viewport(width, height) {
    const id = runner().iframeId
    channel.postMessage({ type: 'viewport', width, height, id })
    return new Promise((resolve, reject) => {
      channel.addEventListener('message', function handler(e) {
        if (e.data.type === 'viewport:done' && e.data.id === id) {
          channel.removeEventListener('message', handler)
          resolve()
        }
        if (e.data.type === 'viewport:fail' && e.data.id === id) {
          channel.removeEventListener('message', handler)
          reject(new Error(e.data.error))
        }
      })
    })
  },
  async screenshot(options = {}) {
    const currentTest = state().current
    if (!currentTest) {
      throw new Error('Cannot take a screenshot outside of a test.')
    }

    if (currentTest.concurrent) {
      throw new Error(
        'Cannot take a screenshot in a concurrent test because '
        + 'concurrent tests run at the same time in the same iframe and affect each other\'s environment. '
        + 'Use a non-concurrent test to take a screenshot.',
      )
    }

    const repeatCount = currentTest.result?.repeatCount ?? 0
    const taskName = getTaskFullName(currentTest)
    const number = screenshotIds[repeatCount]?.[taskName] ?? 1

    screenshotIds[repeatCount] ??= {}
    screenshotIds[repeatCount][taskName] = number + 1

    const name
      = options.path || `${taskName.replace(/[^a-z0-9]/gi, '-')}-${number}.png`

    return triggerCommand('__vitest_screenshot', name, {
      ...options,
      element: options.element
        ? convertElementToCssSelector(options.element)
        : undefined,
    })
  },
}

function getTaskFullName(task: Task): string {
  return task.suite ? `${getTaskFullName(task.suite)} ${task.name}` : task.name
}
