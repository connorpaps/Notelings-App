import { describe, expect, it } from 'vitest'
import { AGENT_STATES, FACE_STYLES } from './agentState'

describe('agentState', () => {
  it('defines exactly the four spec states in order', () => {
    expect(AGENT_STATES).toEqual(['idle', 'processing', 'walking', 'error'])
  })

  it('maps each state to the exact spec expression glyphs', () => {
    expect(FACE_STYLES.idle.glyph).toBe('^ ^')
    expect(FACE_STYLES.processing.glyph).toBe('- -')
    expect(FACE_STYLES.walking.glyph).toBe('O O')
    expect(FACE_STYLES.error.glyph).toBe('X X')
  })

  it('gives every state a full style tuple', () => {
    for (const state of AGENT_STATES) {
      const style = FACE_STYLES[state]
      expect(style.screen.length).toBeGreaterThan(0)
      expect(style.ink.length).toBeGreaterThan(0)
      expect(style.glow.length).toBeGreaterThan(0)
    }
  })
})
