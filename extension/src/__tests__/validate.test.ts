import { describe, it, expect } from 'vitest';
import {
  isUuid,
  normaliseUsername,
  isValidUsername,
  validateDisplayName,
  validateBio,
  validatePassword,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  PASSWORD_MIN,
} from '../lib/validate';

describe('isUuid', () => {
  it('accepts a canonical uuid in either case', () => {
    expect(isUuid('c1000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isUuid('C1000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('rejects malformed ids', () => {
    const bad = ['', 'abc', 'c1000000-0000-0000-0000-00000000000', 'c1000000_0000_0000_0000_000000000001'];
    for (const value of bad) expect(isUuid(value)).toBe(false);
  });
});

describe('usernames', () => {
  it('trims and lowercases', () => {
    expect(normaliseUsername('  Ada_Lovelace ')).toBe('ada_lovelace');
  });

  it('accepts 3-20 lowercase alphanumerics and underscores', () => {
    expect(isValidUsername('ada')).toBe(true);
    expect(isValidUsername('ada_lovelace_1815')).toBe(true);
    expect(isValidUsername(' ADA ')).toBe(true);
  });

  it('rejects too short, too long and illegal characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(21))).toBe(false);
    expect(isValidUsername('ada lovelace')).toBe(false);
    expect(isValidUsername('ada-lovelace')).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('allows an empty value (it clears the field)', () => {
    expect(validateDisplayName('   ')).toBeNull();
  });

  it('rejects values over the limit', () => {
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toBeNull();
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).toMatch(/under/i);
  });
});

describe('validateBio', () => {
  it('accepts a normal bio', () => {
    expect(validateBio('Collecting weird corners of the web.')).toBeNull();
  });

  it('rejects oversized bios', () => {
    expect(validateBio('a'.repeat(BIO_MAX + 1))).toMatch(/under/i);
  });
});

describe('validatePassword', () => {
  it('accepts a password with letters and numbers past the minimum', () => {
    expect(validatePassword('roam1234')).toBeNull();
    expect(validatePassword('a1'.repeat(PASSWORD_MIN))).toBeNull();
  });

  it('rejects short passwords', () => {
    expect(validatePassword('a1'.repeat(2))).toMatch(/at least/i);
  });

  it('requires both a letter and a number', () => {
    expect(validatePassword('onlyletters')).toMatch(/letter and one number/i);
    expect(validatePassword('12345678')).toMatch(/letter and one number/i);
  });
});
