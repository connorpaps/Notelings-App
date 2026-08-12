import { describe, expect, it } from 'vitest'
import { buildGraphData, CATEGORY_GRAPH_COLOR } from './graphData'
import type { NoteRecord } from './types'

const note = (over: Partial<NoteRecord>): NoteRecord => ({
  id: 'n1',
  content: 'x',
  category: 'Work',
  tags: [],
  status: 'filed',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})

describe('buildGraphData', () => {
  it('excludes archived notes entirely', () => {
    const g = buildGraphData([
      note({ id: 'a', status: 'archived', tags: ['react'] }),
      note({ id: 'b', tags: ['react'] }),
    ])
    expect(g.nodes.map((n) => n.id)).toEqual(['tag:react', 'note:b'])
  })

  it('builds one tag hub per unique tag (case-insensitive) with correct degree', () => {
    const g = buildGraphData([
      note({ id: 'a', created_at: '2026-08-02T00:00:00Z', tags: ['React'] }),
      note({ id: 'b', tags: ['react', 'finance'] }),
    ])
    const hub = g.nodes.find((n) => n.id === 'tag:react')
    expect(hub?.type).toBe('tag')
    expect(hub?.name).toBe('React') // first casing wins (newest note first)
    expect(hub?.degree).toBe(2)
  })

  it('creates one edge per note-tag pair, tag -> note', () => {
    const g = buildGraphData([note({ id: 'a', tags: ['x', 'y'] })])
    expect(g.links).toEqual([
      { id: 'tag:x->note:a', source: 'tag:x', target: 'note:a' },
      { id: 'tag:y->note:a', source: 'tag:y', target: 'note:a' },
    ])
  })

  it('keeps category on note nodes and isolates untagged notes', () => {
    const g = buildGraphData([note({ id: 'lonely', category: 'Admin', tags: [] })])
    const node = g.nodes.find((n) => n.id === 'note:lonely')
    expect(node?.category).toBe('Admin')
    expect(node?.degree).toBe(0)
    expect(g.links).toHaveLength(0)
  })

  it('is deterministic (tag hubs sorted; notes newest-first by created_at, id tiebreak)', () => {
    const notes = [
      note({ id: 'old', created_at: '2026-08-01T00:00:00Z', tags: ['z'] }),
      note({ id: 'new', created_at: '2026-08-02T00:00:00Z', tags: ['a'] }),
      note({ id: 'mid', created_at: '2026-08-02T00:00:00Z', tags: ['a'] }),
    ]
    const first = buildGraphData(notes)
    const second = buildGraphData(notes)
    expect(first).toEqual(second)
    expect(first.nodes[0].id).toBe('tag:a') // sorted hubs first
    expect(first.nodes.map((n) => n.id).filter((id) => id.startsWith('note:'))).toEqual([
      'note:new',
      'note:mid',
      'note:old',
    ])
  })

  it('maps category colors to the robot identity palette', () => {
    expect(CATEGORY_GRAPH_COLOR).toEqual({
      Work: '#2fa8e0',
      Admin: '#43c98b',
      Uncategorized: '#ef4444',
    })
  })
})
