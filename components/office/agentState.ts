/** Librarian agent states — the four MASTER_SPEC §3 expressions. */
export type AgentState = 'idle' | 'processing' | 'walking' | 'error'

export const AGENT_STATES: readonly AgentState[] = ['idle', 'processing', 'walking', 'error']

/**
 * LCD face style per state (pure config; the canvas drawing lives in
 * agentFace.ts so this stays unit-testable in Node).
 */
export const FACE_STYLES: Record<AgentState, { glyph: string; screen: string; ink: string; glow: string }> = {
  idle: { glyph: '^ ^', screen: '#0b1622', ink: '#7de3ff', glow: '#38bdf8' },
  processing: { glyph: '- -', screen: '#14100b', ink: '#ffd166', glow: '#f59e0b' },
  walking: { glyph: 'O O', screen: '#0b1622', ink: '#7de3ff', glow: '#38bdf8' },
  error: { glyph: 'X X', screen: '#1a0b0b', ink: '#ff6b6b', glow: '#ef4444' },
}
