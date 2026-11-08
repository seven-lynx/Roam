import { describe, it, expect, afterEach } from 'vitest'

import { isExtensionContext } from '../lib/extension-context'

// The setup file installs a chrome mock with a runtime id, so every test restores it.
type ChromeSlot = { chrome?: { runtime?: { id?: unknown } } }
const slot = globalThis as ChromeSlot
const installed = slot.chrome

describe('isExtensionContext', () => {
  afterEach(() => {
    slot.chrome = installed
  })

  it('is true when chrome.runtime.id is present', () => {
    slot.chrome = { runtime: { id: 'test-extension-id' } }
    expect(isExtensionContext()).toBe(true)
  })

  it('is false when the page has no chrome global at all', () => {
    // What a dist/popup.html opened over file:// actually looks like — issue #75
    delete slot.chrome
    expect(isExtensionContext()).toBe(false)
  })

  it('is false when runtime exists but carries no id', () => {
    slot.chrome = { runtime: {} }
    expect(isExtensionContext()).toBe(false)
  })

  it('is false when runtime.id is empty', () => {
    slot.chrome = { runtime: { id: '' } }
    expect(isExtensionContext()).toBe(false)
  })
})
