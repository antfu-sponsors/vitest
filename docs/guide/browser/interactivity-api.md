---
title: Interactivity API | Browser Mode
---

# Interactivity API

Vitest implements a subset of [`@testing-library/user-event`](https://testing-library.com/docs/user-event) APIs using [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) or [webdriver](https://www.w3.org/TR/webdriver/) APIs instead of faking events which makes the browser behaviour more reliable and consistent with how users interact with a page.

Almost every `userEvent` method inherits its provider options. To see all available options in your IDE, add `webdriver` or `playwright` types to your `tsconfig.json` file:

::: code-group
```json [playwright]
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/playwright"
    ]
  }
}
```
```json [webdriverio]
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/webdriverio"
    ]
  }
}
```
:::

## userEvent.setup

- **Type:** `() => UserEvent`

Creates a new user event instance. This is useful if you need to keep the state of keyboard to press and release buttons correctly.

::: warning
Unlike `@testing-library/user-event`, the default `userEvent` instance from `@vitest/browser/context` is created once, not every time its methods are called! You can see the difference in how it works in this snippet:

```ts
import { userEvent as vitestUserEvent } from '@vitest/browser/context'
import { userEvent as originalUserEvent } from '@testing-library/user-event'

await vitestUserEvent.keyboard('{Shift}') // press shift without releasing
await vitestUserEvent.keyboard('{/Shift}') // releases shift

await originalUserEvent.keyboard('{Shift}') // press shift without releasing
await originalUserEvent.keyboard('{/Shift}') // DID NOT release shift because the state is different
```

This behaviour is more useful because we do not emulate the keyboard, we actually press the Shift, so keeping the original behaviour would cause unexpected issues when typing in the field.
:::

## userEvent.click

- **Type:** `(element: Element, options?: UserEventClickOptions) => Promise<void>`

Click on an element. Inherits provider's options. Please refer to your provider's documentation for detailed explanation about how this method works.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('clicks on an element', async () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.click(logo)
})
```

References:

- [Playwright `locator.click` API](https://playwright.dev/docs/api/class-locator#locator-click)
- [WebdriverIO `element.click` API](https://webdriver.io/docs/api/element/click/)
- [testing-library `click` API](https://testing-library.com/docs/user-event/convenience/#click)

## userEvent.dblClick

- **Type:** `(element: Element, options?: UserEventDoubleClickOptions) => Promise<void>`

Triggers a double click event on an element.

Please refer to your provider's documentation for detailed explanation about how this method works.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('triggers a double click on an element', async () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.dblClick(logo)
})
```

References:

- [Playwright `locator.dblclick` API](https://playwright.dev/docs/api/class-locator#locator-dblclick)
- [WebdriverIO `element.doubleClick` API](https://webdriver.io/docs/api/element/doubleClick/)
- [testing-library `dblClick` API](https://testing-library.com/docs/user-event/convenience/#dblClick)

## userEvent.tripleClick

- **Type:** `(element: Element, options?: UserEventTripleClickOptions) => Promise<void>`

Triggers a triple click event on an element. Since there is no `tripleclick` in browser api, this method will fire three click events in a row, and so you must check [click event detail](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event#usage_notes) to filter the event: `evt.detail === 3`.

Please refer to your provider's documentation for detailed explanation about how this method works.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('triggers a triple click on an element', async () => {
  const logo = screen.getByRole('img', { name: /logo/ })
  let tripleClickFired = false
  logo.addEventListener('click', (evt) => {
    if (evt.detail === 3) {
      tripleClickFired = true
    }
  })

  await userEvent.tripleClick(logo)
  expect(tripleClickFired).toBe(true)
})
```

References:

- [Playwright `locator.click` API](https://playwright.dev/docs/api/class-locator#locator-click): implemented via `click` with `clickCount: 3` .
- [WebdriverIO `browser.action` API](https://webdriver.io/docs/api/browser/action/): implemented via actions api with `move` plus three `down + up + pause` events in a row
- [testing-library `tripleClick` API](https://testing-library.com/docs/user-event/convenience/#tripleClick)

## userEvent.fill

- **Type:** `(element: Element, text: string) => Promise<void>`

Fill an `input/textarea/conteneditable` element with text. This will remove any existing text in the input before typing the new value.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('update input', async () => {
  const input = screen.getByRole('input')

  await userEvent.fill(input, 'foo') // input.value == foo
  await userEvent.fill(input, '{{a[[') // input.value == {{a[[
  await userEvent.fill(input, '{Shift}') // input.value == {Shift}
})
```

::: tip
This API is faster than using [`userEvent.type`](#userevent-type) or [`userEvent.keyboard`](#userevent-keyboard), but it **doesn't support** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}{selectall}`).

We recommend using this API over [`userEvent.type`](#userevent-type) in situations when you don't need to enter special characters.
:::

References:

- [Playwright `locator.fill` API](https://playwright.dev/docs/api/class-locator#locator-fill)
- [WebdriverIO `element.setValue` API](https://webdriver.io/docs/api/element/setValue)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

## userEvent.keyboard

- **Type:** `(text: string) => Promise<void>`

The `userEvent.keyboard` allows you to trigger keyboard strokes. If any input has a focus, it will type characters into that input. Otherwise, it will trigger keyboard events on the currently focused element (`document.body` if there are no focused elements).

This API supports [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard).

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('trigger keystrokes', async () => {
  await userEvent.keyboard('foo') // translates to: f, o, o
  await userEvent.keyboard('{{a[[') // translates to: {, a, [
  await userEvent.keyboard('{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
  await userEvent.keyboard('{a>5}') // press a without releasing it and trigger 5 keydown
  await userEvent.keyboard('{a>5/}') // press a for 5 keydown and then release it
})
```

References:

- [Playwright `Keyboard` API](https://playwright.dev/docs/api/class-keyboard)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

## userEvent.tab

- **Type:** `(options?: UserEventTabOptions) => Promise<void>`

Sends a `Tab` key event. This is a shorthand for `userEvent.keyboard('{tab}')`.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('tab works', async () => {
  const [input1, input2] = screen.getAllByRole('input')

  expect(input1).toHaveFocus()

  await userEvent.tab()

  expect(input2).toHaveFocus()

  await userEvent.tab({ shift: true })

  expect(input1).toHaveFocus()
})
```

References:

- [Playwright `Keyboard` API](https://playwright.dev/docs/api/class-keyboard)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `tab` API](https://testing-library.com/docs/user-event/convenience/#tab)

## userEvent.type

- **Type:** `(element: Element, text: string, options?: UserEventTypeOptions) => Promise<void>`

::: warning
If you don't rely on [special characters](https://testing-library.com/docs/user-event/keyboard) (e.g., `{shift}` or `{selectall}`), it is recommended to use [`userEvent.fill`](#userevent-fill) instead.
:::

The `type` method implements `@testing-library/user-event`'s [`type`](https://testing-library.com/docs/user-event/utility/#type) utility built on top of [`keyboard`](https://testing-library.com/docs/user-event/keyboard) API.

This function allows you to type characters into an input/textarea/conteneditable element. It supports [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard).

If you just need to press characters without an input, use [`userEvent.keyboard`](#userevent-keyboard) API.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('update input', async () => {
  const input = screen.getByRole('input')

  await userEvent.type(input, 'foo') // input.value == foo
  await userEvent.type(input, '{{a[[') // input.value == foo{a[
  await userEvent.type(input, '{Shift}') // input.value == foo{a[
})
```

References:

- [Playwright `locator.press` API](https://playwright.dev/docs/api/class-locator#locator-press)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

## userEvent.clear

- **Type:** `(element: Element) => Promise<void>`

This method clears the input element content.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('clears input', async () => {
  const input = screen.getByRole('input')

  await userEvent.fill(input, 'foo')
  expect(input).toHaveValue('foo')

  await userEvent.clear(input)
  expect(input).toHaveValue('')
})
```

References:

- [Playwright `locator.clear` API](https://playwright.dev/docs/api/class-locator#locator-clear)
- [WebdriverIO `element.clearValue` API](https://webdriver.io/docs/api/element/clearValue)
- [testing-library `clear` API](https://testing-library.com/docs/user-event/utility/#clear)

## userEvent.selectOptions

- **Type:** `(element: Element, values: HTMLElement | HTMLElement[] | string | string[], options?: UserEventSelectOptions) => Promise<void>`

The `userEvent.selectOptions` allows selecting a value in a `<select>` element.

::: warning
If select element doesn't have [`multiple`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-multiple) attribute, Vitest will select only the first element in the array.

Unlike `@testing-library`, Vitest doesn't support [listbox](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role) at the moment, but we plan to add support for it in the future.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('clears input', async () => {
  const select = screen.getByRole('select')

  await userEvent.selectOptions(select, 'Option 1')
  expect(select).toHaveValue('option-1')

  await userEvent.selectOptions(select, 'option-1')
  expect(select).toHaveValue('option-1')

  await userEvent.selectOptions(select, [
    screen.getByRole('option', { name: 'Option 1' }),
    screen.getByRole('option', { name: 'Option 2' }),
  ])
  expect(select).toHaveValue(['option-1', 'option-2'])
})
```

::: warning
`webdriverio` provider doesn't support selecting multiple elements because it doesn't provide API to do so.
:::

References:

- [Playwright `locator.selectOption` API](https://playwright.dev/docs/api/class-locator#locator-select-option)
- [WebdriverIO `element.selectByIndex` API](https://webdriver.io/docs/api/element/selectByIndex)
- [testing-library `selectOptions` API](https://testing-library.com/docs/user-event/utility/#-selectoptions-deselectoptions)

## userEvent.hover

- **Type:** `(element: Element, options?: UserEventHoverOptions) => Promise<void>`

This method moves the cursor position to the selected element. Please refer to your provider's documentation for detailed explanation about how this method works.

::: warning
If you are using `webdriverio` provider, the cursor will move to the center of the element by default.

If you are using `playwright` provider, the cursor moves to "some" visible point of the element.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('hovers logo element', async () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.hover(logo)
})
```

References:

- [Playwright `locator.hover` API](https://playwright.dev/docs/api/class-locator#locator-hover)
- [WebdriverIO `element.moveTo` API](https://webdriver.io/docs/api/element/moveTo/)
- [testing-library `hover` API](https://testing-library.com/docs/user-event/convenience/#hover)

## userEvent.unhover

- **Type:** `(element: Element, options?: UserEventHoverOptions) => Promise<void>`

This works the same as [`userEvent.hover`](#userevent-hover), but moves the cursor to the `document.body` element instead.

::: warning
By default, the cursor position is in the center (in `webdriverio` provider) or in "some" visible place (in `playwright` provider) of the body element, so if the currently hovered element is already in the same position, this method will have no effect.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('unhover logo element', async () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.unhover(logo)
})
```

References:

- [Playwright `locator.hover` API](https://playwright.dev/docs/api/class-locator#locator-hover)
- [WebdriverIO `element.moveTo` API](https://webdriver.io/docs/api/element/moveTo/)
- [testing-library `hover` API](https://testing-library.com/docs/user-event/convenience/#hover)

## userEvent.dragAndDrop

- **Type:** `(source: Element, target: Element, options?: UserEventDragAndDropOptions) => Promise<void>`

Drags the source element on top of the target element. Don't forget that the `source` element has to have the `draggable` attribute set to `true`.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'
import '@testing-library/jest-dom' // adds support for "toHaveTextContent"

test('drag and drop works', async () => {
  const source = screen.getByRole('img', { name: /logo/ })
  const target = screen.getByTestId('logo-target')

  await userEvent.dragAndDrop(source, target)

  expect(target).toHaveTextContent('Logo is processed')
})
```

::: warning
This API is not supported by the default `preview` provider.
:::

References:

- [Playwright `frame.dragAndDrop` API](https://playwright.dev/docs/api/class-frame#frame-drag-and-drop)
- [WebdriverIO `element.dragAndDrop` API](https://webdriver.io/docs/api/element/dragAndDrop/)
