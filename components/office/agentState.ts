/** Librarian agent states — the four MASTER_SPEC §3 expressions. */
export type AgentState = 'idle' | 'processing' | 'walking' | 'error'

export const AGENT_STATES: readonly AgentState[] = ['idle', 'processing', 'walking', 'error']

/**
 * LCD face style per state (pure config; the canvas drawing lives in
 * agentFace.ts so this stays unit-testable in Node). Screens are LIGHT with
 * dark glyphs — maximum contrast so the expression reads at diorama scale
 * and survives tone mapping + SSAO.
 */
export const FACE_STYLES: Record<AgentState, { glyph: string; screen: string; ink: string; glow: string }> = {
  idle: { glyph: '^ ^', screen: '#e9f7ff', ink: '#0f2a3f', glow: '#38bdf8' },
  processing: { glyph: '- -', screen: '#fff4dd', ink: '#7a4b00', glow: '#f59e0b' },
  walking: { glyph: 'O O', screen: '#e9f7ff', ink: '#0f2a3f', glow: '#38bdf8' },
  error: { glyph: 'X X', screen: '#ffe9e9', ink: '#7a0f0f', glow: '#ef4444' },
}
