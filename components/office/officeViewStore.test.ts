import { beforeEach, describe, expect, it } from 'vitest'
import { useOfficeViewStore } from './officeViewStore'

beforeEach(() => {
  useOfficeViewStore.getState().resetForTests()
})

describe('useOfficeViewStore graph state', () => {
  it('starts closed', () => {
    expect(useOfficeViewStore.getState().graphOpen).toBe(false)
  })

  it('toggleGraph flips it', () => {
    useOfficeViewStore.getState().toggleGraph()
    expect(useOfficeViewStore.getState().graphOpen).toBe(true)
    useOfficeViewStore.getState().toggleGraph()
    expect(useOfficeViewStore.getState().graphOpen).toBe(false)
  })

  it('closeGraph closes it', () => {
    useOfficeViewStore.getState().toggleGraph()
    useOfficeViewStore.getState().closeGraph()
    expect(useOfficeViewStore.getState().graphOpen).toBe(false)
  })
})
