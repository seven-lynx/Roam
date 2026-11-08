// validate.ts — shared input validation for popup and background handlers.
//
// The background is authoritative (it writes to the database); the popup uses
// the same helpers purely to give inline feedback before a round-trip.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 200;
export const PASSWORD_MIN = 8;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normaliseUsername(raw));
}

/** Returns an error message, or null when the value is acceptable. */
export function validateDisplayName(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null; // optional — empty clears it
  if (value.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return null;
}

export function validateBio(raw: string): string | null {
  const value = raw.trim();
  if (value.length > BIO_MAX) return `Keep it under ${BIO_MAX} characters.`;
  return null;
}

/** Minimum viable rule set; the web app shows a strength meter on top of this. */
export function validatePassword(raw: string): string | null {
  if (raw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!/[a-zA-Z]/.test(raw) || !/[0-9]/.test(raw)) return 'Include at least one letter and one number.';
  return null;
}
