import { describe, expect, it } from 'vitest'
import { ENABLE_GRID_DEBUG, ENABLE_OFFICE_BUILDER, ENABLE_PATH_PREVIEW } from './officeMode'

describe('office mode', () => {
  it('keeps the editor disabled for the static diorama by default', () => {
    expect(ENABLE_OFFICE_BUILDER).toBe(false)
  })

  it('keeps the path preview disabled for the released app', () => {
    expect(ENABLE_PATH_PREVIEW).toBe(false)
  })

  it('keeps the grid debug visualizer active until the alignment is verified', () => {
    // TEMPORARY: flip to false once the blocked-cell overlay has been visually
    // confirmed against the 3D furniture and removed from the released app.
    expect(ENABLE_GRID_DEBUG).toBe(true)
  })
})
