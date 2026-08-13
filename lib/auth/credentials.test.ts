import { describe, expect, it } from 'vitest'
import { isEmailLike, isValidUsername, normalizeEmail, normalizeUsername } from './credentials'

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  Connor_Paps  ')).toBe('connor_paps')
    expect(normalizeUsername('DEMO')).toBe('demo')
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })
})

describe('isValidUsername', () => {
  it('accepts letters, digits, dashes, and underscores', () => {
    expect(isValidUsername('bob')).toBe(true)
    expect(isValidUsername('bob_the_2nd')).toBe(true)
    expect(isValidUsername('a-b')).toBe(true)
    expect(isValidUsername('42')).toBe(false) // below min length
    expect(isValidUsername('a1')).toBe(false)
  })

  it('rejects spaces, symbols, and bad shapes', () => {
    expect(isValidUsername('has space')).toBe(false)
    expect(isValidUsername('has@at')).toBe(false)
    expect(isValidUsername('has.dot')).toBe(false)
    expect(isValidUsername('-starts-with-dash')).toBe(false)
    expect(isValidUsername('_starts-with-underscore')).toBe(false)
    expect(isValidUsername('a'.repeat(25))).toBe(false)
    expect(isValidUsername('a'.repeat(24))).toBe(true)
  })
})

describe('isEmailLike', () => {
  it('treats identifiers containing @ as email', () => {
    expect(isEmailLike('user@example.com')).toBe(true)
    expect(isEmailLike('bob')).toBe(false)
  })
})
