/**
 * Pure username/email helpers shared by the auth API routes and their unit
 * tests. Normalization keeps a single canonical spelling (lowercase) so the
 * `usernames` unique index on lower(username) is consistent with lookups.
 */

/** 3-24 chars, starts with a letter or digit, then letters/digits/_/-. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/i

export const USERNAME_MIN = 3
export const USERNAME_MAX = 24

/** bcrypt (Supabase's password hasher) ignores bytes past 72; enforce the cap. */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(input)
}

/** An identifier containing '@' is treated as an email address. */
export function isEmailLike(identifier: string): boolean {
  return identifier.includes('@')
}
