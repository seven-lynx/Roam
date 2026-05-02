/**
 * Tests for form validation utilities.
 * Verifies: email format, password strength, password match, UI helpers.
 */

import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
} from '@/lib/validation'

// ─── validateEmail ─────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('returns valid for a well-formed email', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true })
  })

  it('returns valid for subdomains', () => {
    expect(validateEmail('user@mail.example.co.uk')).toEqual({ valid: true })
  })

  it('returns valid for plus-addressed email', () => {
    expect(validateEmail('user+tag@example.com')).toEqual({ valid: true })
  })

  it('returns invalid for empty string', () => {
    const result = validateEmail('')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/required/i)
  })

  it('returns invalid when @ is missing', () => {
    const result = validateEmail('notanemail')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/valid email/i)
  })

  it('returns invalid when domain is missing', () => {
    const result = validateEmail('user@')
    expect(result.valid).toBe(false)
  })

  it('returns invalid for leading/trailing spaces', () => {
    // The regex requires non-whitespace characters before and after @
    const result = validateEmail(' user@example.com')
    expect(result.valid).toBe(false)
  })
})

// ─── validatePassword ──────────────────────────────────────────────────────────

describe('validatePassword', () => {
  it('returns invalid with strength "weak" for empty string', () => {
    const result = validatePassword('')
    expect(result.valid).toBe(false)
    expect(result.strength).toBe('weak')
    expect(result.error).toMatch(/required/i)
  })

  it('returns invalid for password shorter than 8 characters', () => {
    const result = validatePassword('abc')
    expect(result.valid).toBe(false)
    expect(result.strength).toBe('weak')
    expect(result.error).toMatch(/8 characters/)
  })

  it('includes current length in the short-password error', () => {
    const result = validatePassword('abcd')
    expect(result.error).toContain('4/8')
  })

  it('returns valid with strength "weak" for all-lowercase 8+ char password', () => {
    const result = validatePassword('abcdefgh')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('weak')
  })

  it('returns strength "fair" for lowercase + uppercase', () => {
    const result = validatePassword('Abcdefgh')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('fair')
  })

  it('returns strength "good" for lowercase + uppercase + number', () => {
    const result = validatePassword('Abcdefg1')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('good')
  })

  it('returns strength "strong" for all four character types', () => {
    const result = validatePassword('Abcdefg1!')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('strong')
  })

  it('returns no error message for valid passwords', () => {
    const result = validatePassword('ValidPass1!')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })
})

// ─── validatePasswordsMatch ────────────────────────────────────────────────────

describe('validatePasswordsMatch', () => {
  it('returns valid when passwords match', () => {
    expect(validatePasswordsMatch('secret123', 'secret123')).toEqual({ valid: true })
  })

  it('returns invalid for empty confirmPassword', () => {
    const result = validatePasswordsMatch('secret123', '')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/confirm/i)
  })

  it('returns invalid when passwords differ', () => {
    const result = validatePasswordsMatch('secret123', 'different')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/do not match/i)
  })

  it('is case-sensitive', () => {
    const result = validatePasswordsMatch('Secret123', 'secret123')
    expect(result.valid).toBe(false)
  })
})

// ─── getPasswordStrengthColor ──────────────────────────────────────────────────

describe('getPasswordStrengthColor', () => {
  it('maps each strength to the correct Tailwind class', () => {
    expect(getPasswordStrengthColor('weak')).toBe('bg-red-500')
    expect(getPasswordStrengthColor('fair')).toBe('bg-orange-500')
    expect(getPasswordStrengthColor('good')).toBe('bg-yellow-500')
    expect(getPasswordStrengthColor('strong')).toBe('bg-green-500')
  })
})

// ─── getPasswordStrengthLabel ──────────────────────────────────────────────────

describe('getPasswordStrengthLabel', () => {
  it('maps each strength to the correct display label', () => {
    expect(getPasswordStrengthLabel('weak')).toBe('Weak')
    expect(getPasswordStrengthLabel('fair')).toBe('Fair')
    expect(getPasswordStrengthLabel('good')).toBe('Good')
    expect(getPasswordStrengthLabel('strong')).toBe('Strong')
  })
})
