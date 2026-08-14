import { describe, expect, it } from 'vitest'
import { ENABLE_OFFICE_BUILDER, ENABLE_PATH_PREVIEW } from './officeMode'

describe('office mode', () => {
  it('keeps the editor disabled for the static diorama by default', () => {
    expect(ENABLE_OFFICE_BUILDER).toBe(false)
  })

  it('keeps the path preview disabled for the released app', () => {
    expect(ENABLE_PATH_PREVIEW).toBe(false)
  })
})
