import { describe, expect, it } from 'vitest'
import { LoginInputSchema, RegisterInputSchema } from './authSchemas'

describe('LoginInputSchema', () => {
  it('accepts username or email identifiers', () => {
    expect(LoginInputSchema.parse({ identifier: 'bob', password: 'correct-horse' })).toMatchObject({ identifier: 'bob' })
    expect(LoginInputSchema.parse({ identifier: ' bob@example.com ', password: 'x'.repeat(10) })).toMatchObject({
      identifier: 'bob@example.com',
    })
  })

  it('rejects empty identifiers or passwords', () => {
    expect(LoginInputSchema.safeParse({ identifier: '', password: 'x' }).success).toBe(false)
    expect(LoginInputSchema.safeParse({ identifier: 'bob', password: '' }).success).toBe(false)
  })

  it('rejects over-long passwords (bcrypt 72-byte cap)', () => {
    expect(LoginInputSchema.safeParse({ identifier: 'bob', password: 'x'.repeat(73) }).success).toBe(false)
  })
})

describe('RegisterInputSchema', () => {
  it('accepts a valid username/email/password', () => {
    const parsed = RegisterInputSchema.parse({
      username: '  Bob_42 ',
      email: ' Bob@Example.com ',
      password: 'super-secret-password',
    })
    expect(parsed).toMatchObject({ username: 'Bob_42', email: 'Bob@Example.com' })
  })

  it('rejects short passwords', () => {
    const result = RegisterInputSchema.safeParse({ username: 'bob', email: 'b@e.com', password: 'short' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('10 characters')
    }
  })

  it('rejects invalid usernames', () => {
    expect(RegisterInputSchema.safeParse({ username: 'has space', email: 'b@e.com', password: 'x'.repeat(12) }).success).toBe(false)
    expect(RegisterInputSchema.safeParse({ username: 'a@b', email: 'b@e.com', password: 'x'.repeat(12) }).success).toBe(false)
  })

  it('rejects malformed email', () => {
    expect(RegisterInputSchema.safeParse({ username: 'bob', email: 'not-an-email', password: 'x'.repeat(12) }).success).toBe(false)
  })
})
