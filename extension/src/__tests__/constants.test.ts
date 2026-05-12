import { describe, it, expect } from 'vitest'
import { FALLBACK_CATEGORIES } from '../lib/constants'
import type { CategoryItem } from '../lib/messages'

describe('FALLBACK_CATEGORIES', () => {
  it('contains exactly 8 entries', () => {
    expect(FALLBACK_CATEGORIES).toHaveLength(8)
  })

  it('every entry has a non-empty id, name, and icon', () => {
    for (const cat of FALLBACK_CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.icon).toBeTruthy()
    }
  })

  it('all IDs are unique', () => {
    const ids = FALLBACK_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all IDs match the expected UUID prefix for category seed rows', () => {
    // Seeded category UUIDs all start with c1000000-
    for (const cat of FALLBACK_CATEGORIES) {
      expect(cat.id).toMatch(/^c1000000-/)
    }
  })

  it('conforms to the CategoryItem interface shape', () => {
    // Type-level check: assignment would fail to compile if shape is wrong.
    // Runtime check: verify each field type.
    for (const cat of FALLBACK_CATEGORIES) {
      const typed: CategoryItem = cat
      expect(typeof typed.id).toBe('string')
      expect(typeof typed.name).toBe('string')
      expect(typeof typed.icon).toBe('string')
    }
  })
})
