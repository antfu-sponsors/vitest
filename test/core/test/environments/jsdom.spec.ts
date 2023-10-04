// @vitest-environment jsdom

import { createColors, getDefaultColors, setupColors } from '@vitest/utils'
import { processError } from '@vitest/utils/error'
import { afterEach, expect, test } from 'vitest'

afterEach(() => {
  setupColors(createColors(true))
})

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor >= 15)('MessageChannel and MessagePort are available', () => {
  expect(MessageChannel).toBeDefined()
  expect(MessagePort).toBeDefined()
})

test.runIf(nodeMajor >= 17)('structuredClone is available', () => {
  expect(structuredClone).toBeDefined()
})

test.runIf(nodeMajor >= 18)('fetch, Request, Response, and BroadcastChannel are available', () => {
  expect(fetch).toBeDefined()
  expect(Request).toBeDefined()
  expect(Response).toBeDefined()
  expect(TextEncoder).toBeDefined()
  expect(TextDecoder).toBeDefined()
  expect(BroadcastChannel).toBeDefined()
})

test('toContain correctly handles DOM nodes', () => {
  const wrapper = document.createElement('div')
  const child = document.createElement('div')
  const external = document.createElement('div')
  wrapper.appendChild(child)

  expect(wrapper).toContain(child)
  expect(wrapper).not.toContain(external)

  wrapper.classList.add('flex', 'flex-col')

  expect(wrapper.classList).toContain('flex-col')
  expect(wrapper.classList).not.toContain('flex-row')

  expect(() => {
    expect(wrapper).toContain('some-element')
  }).toThrowErrorMatchingInlineSnapshot(`"toContain() expected a DOM node as the argument, but got string"`)

  expect(() => {
    expect(wrapper.classList).toContain('flex-row')
  }).toThrowErrorMatchingInlineSnapshot(`"expected "flex flex-col" to contain "flex-row""`)
  expect(() => {
    expect(wrapper.classList).toContain(2)
  }).toThrowErrorMatchingInlineSnapshot(`"class name value must be string, received "number""`)

  setupColors(getDefaultColors())

  try {
    expect(wrapper.classList).toContain('flex-row')
    expect.unreachable()
  }
  catch (err: any) {
    expect(processError(err).diff).toMatchInlineSnapshot(`
      "- Expected
      + Received

      - flex flex-col flex-row
      + flex flex-col"
    `)
  }

  try {
    expect(wrapper.classList).not.toContain('flex')
    expect.unreachable()
  }
  catch (err: any) {
    expect(processError(err).diff).toMatchInlineSnapshot(`
      "- Expected
      + Received

      - flex-col
      + flex flex-col"
    `)
  }
})
