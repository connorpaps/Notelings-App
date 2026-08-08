import { describe, expect, it } from 'vitest'
import { ENABLE_OFFICE_BUILDER } from './officeMode'

describe('office mode', () => {
  it('keeps the editor disabled for the static diorama by default', () => {
    expect(ENABLE_OFFICE_BUILDER).toBe(false)
  })
})
