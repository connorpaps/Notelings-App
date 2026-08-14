# M5: Knowledge Graph (Bipartite Hub Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the visual capstone — a full-screen, frozen-layout, 2D-canvas bipartite force graph (tag hubs ↔ note satellites) with hover-focus, a GPU-animated "side-peek" note editor, and agentic archive, without stealing CPU from the React Three Fiber office behind it.

**Architecture:** Pure data transform (`lib/notes/graphData.ts`) turns the realtime store mirror (`useAgentStore.state.notes`) into `{ nodes, edges }` for `react-force-graph-2d`. The layout is pre-computed with `warmupTicks` and **frozen** with `cooldownTicks={0}` (d3-force never runs a tick loop — validated against force-graph docs; node `x/y` persist by id across data changes, so tag edits swap instantly without re-animation). The overlay is a full-screen scrim at `z-40`; the "side-peek" is a `.liquid-glass-strong` right rail that slides via **transform + opacity only** (60fps-animation skill). All notes come from the existing store mirror — **no new API routes, no DB changes**.

**Tech Stack:** `react-force-graph-2d@^1.29.1` (peer `react: '*'` → React 19 safe; wraps `force-graph@^1.51`/d3-force internally), React 19 / Next 16 App Router, Tailwind v4, framer-motion (existing dep), zustand `useOfficeViewStore` + `useAgentStore`, zod 4, Vitest + Playwright.

## Global Constraints

- `npm` only (never yarn/pnpm). **Package install required:** `react-force-graph-2d` (user-approved via milestone; the ONLY new dep).
- React 19.2 + Next 16 App Router; do not touch the R3F canvas/`frameloop` (non-destructive rule).
- Store selectors must return **stable references** (select `state.notes` map, then `useMemo` — fresh arrays in selectors crash with "getServerSnapshot should be cached").
- Overlays mounted inside `pointer-events-none` roots must set `pointer-events-auto` on interactive containers (established lesson).
- Z-order: graph overlay `z-40` (covers chrome `z-20`/dock `z-30`/mobile kanban `z-40`), below `GlassModal z-50`.
- Categories are ONLY `Work | Admin | Uncategorized` (the doc's "IDEAS" does not exist). Category colors = robot identity colors: Work `#2fa8e0`, Admin `#43c98b`, Uncategorized `#ef4444` (only accent colors allowed).
- **Archived notes are excluded from the graph** (established user decision; same `ACTIVE_STATUSES` set as `lib/notes/tags.ts` = pending/in_transit/filed).
- Fonts: Poppins (`--font-sans`) for tag hub text; serif italic accents (`--font-serif`) for headings only.
- Physics freeze is a hard requirement: `warmupTicks={250}` + `cooldownTicks={0}`; no background tick loop. Overlay unmounts on close (AnimatePresence) → zero ongoing cost.
- Side-peek animation: ONLY `transform: translateX` + `opacity` (framer-motion), duration ≈ 280ms, `useReducedMotion` → instant. The overlay follows the approved translucent `bg-black/60 backdrop-blur-md` treatment, keeping the R3F office dimly visible behind the graph.
- Validation gate before commit: `npx tsc --noEmit`, `npm test`, `npm run lint` (0 errors, existing warning baseline), `npm run build`, `npm run test:e2e` (warm dev server first; `NEXT_PUBLIC_PRESERVE_DRAWING_BUFFER=1` for e2e).

---

### Task 1: Install `react-force-graph-2d` and verify the toolchain stays green

**Files:**
- Modify: `package.json` (via npm), `package-lock.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `react-force-graph-2d` resolvable from any client component; a working baseline for Task 5's dynamic import.

- [ ] **Step 1: Install**

```bash
npm install react-force-graph-2d
npm ls react-force-graph-2d force-graph
```

Expected: `react-force-graph-2d@1.29.1` + `force-graph@^1.51` installed with **no peer-dep errors** (peer range is `react: '*'`). If npm errors on peers, stop and report — do not use `--legacy-peer-deps`.

- [ ] **Step 2: Verify the package ships TypeScript types**

Check `node_modules/react-force-graph-2d/package.json` for a `types`/`typings` field. If absent, create `types/react-force-graph-2d.d.ts` with a minimal shim (see Task 5 for the props actually used) and add it to the `tsconfig.json` `include` if needed.

- [ ] **Step 3: Baseline validation**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errors, 173/173 tests (baseline unchanged — no code touched yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(m5): add react-force-graph-2d for the Knowledge Graph"
```

---

### Task 2: Pure bipartite graph builder + unit tests

**Files:**
- Create: `lib/notes/graphData.ts`
- Test: `lib/notes/graphData.test.ts`

**Interfaces:**
- Consumes: `NoteRecord` from `lib/notes/types.ts`; `collectUniqueTags`/`tagCounts` from `lib/notes/tags.ts`.
- Produces:
  - `type GraphNode = { id: string; type: 'note' | 'tag'; noteId?: string; category?: NoteCategory; name?: string; degree: number }` — note ids `note:<uuid>`, tag ids `tag:<normalized-name>`.
  - `type GraphLink = { id: string; source: string; target: string }` — always `source` = tag hub, `target` = note satellite.
  - `type GraphData = { nodes: GraphNode[]; links: GraphLink[] }`
  - `buildGraphData(notes: readonly NoteRecord[]): GraphData`
  - `CATEGORY_GRAPH_COLOR: Record<NoteCategory, string>` = `{ Work: '#2fa8e0', Admin: '#43c98b', Uncategorized: '#ef4444' }`
  - `graphNodeDegree(g: GraphData, id: string): number`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/notes/graphData.test.ts
import { describe, expect, it } from 'vitest'
import { buildGraphData, CATEGORY_GRAPH_COLOR, graphNodeDegree } from './graphData'
import type { NoteRecord } from './types'

const note = (over: Partial<NoteRecord>): NoteRecord => ({
  id: 'n1', content: 'x', category: 'Work', tags: [], status: 'filed',
  created_at: '2026-08-01T00:00:00Z', ...over,
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
      note({ id: 'a', tags: ['React'] }),
      note({ id: 'b', tags: ['react', 'finance'] }),
    ])
    const hub = g.nodes.find((n) => n.id === 'tag:react')
    expect(hub?.type).toBe('tag')
    expect(hub?.name).toBe('React') // first casing wins
    expect(hub?.degree).toBe(2)
    expect(graphNodeDegree(g, 'tag:react')).toBe(2)
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

  it('is deterministic (stable order: tag hubs sorted, notes newest-first by created_at, id tiebreak)', () => {
    const notes = [
      note({ id: 'old', created_at: '2026-08-01T00:00:00Z', tags: ['z'] }),
      note({ id: 'new', created_at: '2026-08-02T00:00:00Z', tags: ['a'] }),
      note({ id: 'mid', created_at: '2026-08-02T00:00:00Z', tags: ['a'] }),
    ]
    const first = buildGraphData(notes)
    const second = buildGraphData(notes)
    expect(first).toEqual(second)
    expect(first.nodes[0].id).toBe('tag:a') // sorted hubs first
    expect(first.nodes.map((n) => n.id).filter((id) => id.startsWith('note:')))
      .toEqual(['note:new', 'note:mid', 'note:old'])
  })

  it('maps category colors to the robot identity palette', () => {
    expect(CATEGORY_GRAPH_COLOR).toEqual({
      Work: '#2fa8e0', Admin: '#43c98b', Uncategorized: '#ef4444',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notes/graphData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/notes/graphData.ts`**

```ts
import { collectUniqueTags } from './tags'
import type { NoteCategory, NoteRecord } from './types'

/** M5: category identity colors = the robot identity palette (only accents). */
export const CATEGORY_GRAPH_COLOR: Record<NoteCategory, string> = {
  Work: '#2fa8e0',
  Admin: '#43c98b',
  Uncategorized: '#ef4444',
}

export type GraphNode = {
  id: string
  type: 'note' | 'tag'
  /** note nodes only */
  noteId?: string
  category?: NoteCategory
  /** tag nodes only — display name (first casing wins) */
  name?: string
  degree: number
}

export type GraphLink = { id: string; source: string; target: string }
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] }

const ACTIVE_STATUSES = new Set(['pending', 'in_transit', 'filed'])

function activeNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  return notes.filter((note) => ACTIVE_STATUSES.has(note.status))
}

function noteSort(a: NoteRecord, b: NoteRecord): number {
  return (
    b.created_at.localeCompare(a.created_at) ||
    a.id.localeCompare(b.id) // deterministic tiebreak
  )
}

/**
 * M5 bipartite transform: tag hubs (white text) + note satellites (dots).
 * Edges run ONLY tag -> note, so multi-tag notes sit between their hubs.
 * Node ids are stable (`tag:<lower>` / `note:<uuid>`) so react-force-graph
 * preserves frozen x/y positions across data changes.
 */
export function buildGraphData(notes: readonly NoteRecord[]): GraphData {
  const active = activeNotes(notes).sort(noteSort)
  const hubNames = new Map<string, string>() // lower -> display casing
  for (const tag of collectUniqueTags(active)) hubNames.set(tag.toLowerCase(), tag)

  const degree = new Map<string, number>()
  for (const note of active) {
    degree.set(`note:${note.id}`, note.tags.length)
    for (const tag of note.tags) {
      const hubId = `tag:${tag.toLowerCase()}`
      degree.set(hubId, (degree.get(hubId) ?? 0) + 1)
    }
  }

  const nodes: GraphNode[] = [
    ...[...hubNames.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lower, display]) => ({
        id: `tag:${lower}`, type: 'tag' as const, name: display,
        degree: degree.get(`tag:${lower}`) ?? 0,
      })),
    ...active.map((note) => ({
      id: `note:${note.id}`, type: 'note' as const, noteId: note.id,
      category: note.category, degree: degree.get(`note:${note.id}`) ?? 0,
    })),
  ]

  const links: GraphLink[] = active.flatMap((note) =>
    note.tags.map((tag) => ({
      id: `tag:${tag.toLowerCase()}->note:${note.id}`,
      source: `tag:${tag.toLowerCase()}`,
      target: `note:${note.id}`,
    })),
  )

  return { nodes, links }
}

export function graphNodeDegree(g: GraphData, id: string): number {
  return g.nodes.find((n) => n.id === id)?.degree ?? 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notes/graphData.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notes/graphData.ts lib/notes/graphData.test.ts
git commit -m "feat(m5): bipartite graph data builder (tag hubs + note satellites)"
```

---

### Task 3: Extract shared note-edit helpers (DRY for the side-peek editor)

**Files:**
- Create: `lib/notes/noteEdit.ts`
- Test: `lib/notes/noteEdit.test.ts`
- Modify: `components/notelings/NoteEditModal.tsx` (import helpers; behavior unchanged)

**Interfaces:**
- Consumes: `NOTE_CONTENT_MAX` from `lib/notes/categorization.ts`.
- Produces:
  - `export const MAX_TAGS = 5`, `export const MAX_TAG_LENGTH = 40`
  - `export const EditNoteSchema` (zod — content 1..NOTE_CONTENT_MAX, tags: string)
  - `export function parseTags(value: string): string[]` (comma-split, trim, drop empty)
  - `export function validateTags(tags: string[]): string | null` — returns an error message or `null` (caps + per-tag length; mirrors the toast text from NoteEditModal).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/notes/noteEdit.test.ts
import { describe, expect, it } from 'vitest'
import { EditNoteSchema, parseTags, validateTags } from './noteEdit'

describe('parseTags', () => {
  it('splits commas, trims, drops empties', () => {
    expect(parseTags(' react, finance ,,  x  ')).toEqual(['react', 'finance', 'x'])
  })
  it('returns [] for empty input', () => expect(parseTags('')).toEqual([]))
})

describe('validateTags', () => {
  it('accepts up to 5 tags of up to 40 chars', () =>
    expect(validateTags(['a', 'b', 'c', 'd', 'e'])).toBeNull())
  it('rejects >5 tags', () =>
    expect(validateTags(['a', 'b', 'c', 'd', 'e', 'f'])).toMatch(/at most 5/))
  it('rejects an over-long tag', () =>
    expect(validateTags(['x'.repeat(41)])).toMatch(/40 characters/))
})

describe('EditNoteSchema', () => {
  it('parses a valid payload', () =>
    expect(EditNoteSchema.parse({ content: ' hello ', tags: 'a, b' })).toEqual({ content: 'hello', tags: 'a, b' }))
  it('rejects empty content', () =>
    expect(EditNoteSchema.safeParse({ content: '   ', tags: '' }).success).toBe(false))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notes/noteEdit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/notes/noteEdit.ts`** (copy the schema/parse/caps verbatim from `NoteEditModal.tsx` lines ~10-35)

```ts
import { z } from 'zod'
import { NOTE_CONTENT_MAX } from './categorization'

export const MAX_TAGS = 5
export const MAX_TAG_LENGTH = 40

export const EditNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note cannot be empty')
    .max(NOTE_CONTENT_MAX, `Notes are limited to ${NOTE_CONTENT_MAX} characters`),
  tags: z.string(),
})

export function parseTags(value: string): string[] {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

/** Returns a user-facing error message, or null when valid. */
export function validateTags(tags: string[]): string | null {
  if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return `Tags: at most ${MAX_TAGS}, each up to ${MAX_TAG_LENGTH} characters.`
  }
  return null
}
```

- [ ] **Step 4: Refactor `NoteEditModal.tsx` to use the helpers** — delete the local `EditNoteSchema`/`parseTags`/`MAX_TAGS`/`MAX_TAG_LENGTH`, import `{ EditNoteSchema, parseTags, validateTags }` from `@/lib/notes/noteEdit`, and replace the manual toast check with `const invalid = validateTags(tagList); if (invalid) { toast.error(invalid); return }`. No other behavior change.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run lib/notes/noteEdit.test.ts && npx tsc --noEmit && npm test`
Expected: new tests pass; full suite still 173 + new tests green; tsc 0.

- [ ] **Step 6: Commit**

```bash
git add lib/notes/noteEdit.ts lib/notes/noteEdit.test.ts components/notelings/NoteEditModal.tsx
git commit -m "refactor(m5): extract shared note-edit helpers for the graph side-peek"
```

---

### Task 4: Open triggers — `graphOpen` store state + header & dock buttons

**Files:**
- Modify: `components/office/officeViewStore.ts`
- Test: `components/office/officeViewStore.test.ts`
- Modify: `components/notelings/OfficeViewControls.tsx` (add Graph button)
- Modify: `components/notelings/TerminalDock.tsx` (add graph icon button next to Search)

**Interfaces:**
- Consumes: existing `useOfficeViewStore` (zustand).
- Produces: `graphOpen: boolean`, `toggleGraph: () => void`, `closeGraph: () => void` on `useOfficeViewStore`. Header + dock buttons that call `toggleGraph`.

- [ ] **Step 1: Write the failing store test**

```ts
// components/office/officeViewStore.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { useOfficeViewStore } from './officeViewStore'

beforeEach(() => useOfficeViewStore.getState().resetForTests?.())

describe('useOfficeViewStore graph state', () => {
  it('starts closed', () => expect(useOfficeViewStore.getState().graphOpen).toBe(false))
  it('toggleGraph flips it', () => {
    useOfficeViewStore.getState().toggleGraph()
    expect(useOfficeViewStore.getState().graphOpen).toBe(true)
  })
  it('closeGraph closes it', () => {
    useOfficeViewStore.getState().toggleGraph()
    useOfficeViewStore.getState().closeGraph()
    expect(useOfficeViewStore.getState().graphOpen).toBe(false)
  })
})
```

(If `officeViewStore` has no existing `resetForTests`, add a plain reset to the store — see Step 2 — and guard the test call.)

- [ ] **Step 2: Extend `officeViewStore.ts`** — add `graphOpen: false` to state, `toggleGraph: () => set((s) => ({ graphOpen: !s.graphOpen }))`, `closeGraph: () => set({ graphOpen: false })`, and a `resetForTests` that restores defaults.

- [ ] **Step 3: Header button** — in `OfficeViewControls.tsx`, add a third button to the control cluster (before "Edit nav"):

```tsx
import { Network } from 'lucide-react'
// inside component:
const graphOpen = useOfficeViewStore((s) => s.graphOpen)
const toggleGraph = useOfficeViewStore((s) => s.toggleGraph)
// in the JSX cluster, matching the existing button anatomy exactly:
<button type="button" onClick={toggleGraph} aria-pressed={graphOpen}
  aria-label={graphOpen ? 'Close knowledge graph' : 'Open knowledge graph'}
  title={graphOpen ? 'Close knowledge graph' : 'Open knowledge graph'}
  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10 active:scale-95 ${graphOpen ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}>
  <Network size={13} strokeWidth={2.5} />
  <span className="hidden sm:inline">Graph</span>
</button>
```

- [ ] **Step 4: Dock button** — in `TerminalDock.tsx`, next to the Search button, add a matching icon button (`Network` icon, `aria-label="Open knowledge graph"`) that calls `useOfficeViewStore.getState().toggleGraph()`.

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `npx vitest run components/office/officeViewStore.test.ts && npx tsc --noEmit && npm run lint`
Expected: store tests pass; tsc 0; lint 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add components/office/officeViewStore.ts components/office/officeViewStore.test.ts components/notelings/OfficeViewControls.tsx components/notelings/TerminalDock.tsx
git commit -m "feat(m5): knowledge-graph open trigger (header + dock)"
```

---

### Task 5: The graph canvas + full-screen overlay (frozen physics, neural-glass look)

**Files:**
- Create: `components/notelings/KnowledgeGraphCanvas.tsx` (client; the force-graph wrapper)
- Create: `components/notelings/KnowledgeGraphOverlay.tsx` (client; scrim, header, mount/unmount, debug handle)
- Modify: `components/notelings/NotelingsUI.tsx` (mount the overlay)

**Interfaces:**
- Consumes: `buildGraphData`, `CATEGORY_GRAPH_COLOR` (Task 2); `useAgentStore(state => state.notes)` map + `useMemo`; `useOfficeViewStore` `graphOpen`/`closeGraph`.
- Produces:
  - `KnowledgeGraphCanvas({ graphData, hoveredId, focusedTag, onNodeHover, onNodeClick, onBackgroundClick })` — renders `ForceGraph2D` (next/dynamic, `ssr: false`), owns the canvas callbacks + a ResizeObserver, exposes `window.__NOTELINGS_GRAPH__`.
  - `KnowledgeGraphOverlay()` — reads `graphOpen`; renders `<AnimatePresence>`-gated full-screen overlay at `z-40` with header (title, live node/edge counts, close button), empty state, and mounts the canvas + side-peek (Task 6).

- [ ] **Step 1: Create `KnowledgeGraphCanvas.tsx`**

Key implementation notes (actual code at the named boundaries — the rest follows the repo's client-component style):

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef } from 'react'
import type { GraphData } from '@/lib/notes/graphData'
import { CATEGORY_GRAPH_COLOR } from '@/lib/notes/graphData'
import type { ForceGraphMethods } from 'react-force-graph-2d'

// Bundle the force-graph lib only when the overlay opens (SSR-safe).
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const HUB_FONT = '"Poppins", sans-serif'
const FOCUS_ALPHA = 0.1           // dimmed (non-connected) opacity
const EDGE_COLOR = 'rgba(255,255,255,0.1)'

type Props = {
  graphData: GraphData
  hoveredId: string | null
  focusedTag: string | null
  onNodeHover: (id: string | null) => void
  onNodeClick: (id: string) => void
  onBackgroundClick: () => void
}
```

Then, inside the component:
- Keep `const graphRef = useRef<ForceGraphMethods | null>(null)`.
- **Frozen physics (d3-viz skill):** `<ForceGraph2D ... warmupTicks={250} cooldownTicks={0} />`. `warmupTicks` runs the d3-force simulation synchronously before the first paint; `cooldownTicks={0}` stops the tick loop forever — pan/zoom/hover cost zero physics CPU. On `graphData` change the lib re-fires but stops after 0 ticks and node `x/y` persist by id (validated) → instant swap, no jitter.
- **Custom renderer:** `nodeCanvasObject={(node, ctx, globalScale) => {...}}` and `nodeCanvasObjectMode={() => 'replace'}`:
  - Determine `active = focusedTag === null || node.id === focusedTag || node.type === 'note' && nodeIsConnectedToFocusedTag(node)`; when focused, non-active nodes render at `alpha = FOCUS_ALPHA`.
  - Tag hub: `ctx.font = \`${Math.max(9, Math.min(7 + Math.sqrt(node.degree) * 1.6, 17))}px ${HUB_FONT}\``, fillStyle white (`rgba(255,255,255,${active ? 0.95 : FOCUS_ALPHA})`), `textAlign='center'`, `textBaseline='middle'`, draw `truncateLabel(node.name, 18)`.
  - Note satellite: dim gray dot — `ctx.beginPath(); ctx.arc(node.x, node.y, 2.4, 0, 2*Math.PI); ctx.fillStyle = node.id === hoveredId ? CATEGORY_GRAPH_COLOR[node.category] : (active ? '#888' : 'rgba(136,136,136,0.1)'); ctx.fill()`. Hovered note node gets its **category color** + a 3px halo ring.
  - Hovered tag hub: bold the font + a faint underline/halo rect behind the text.
- **Hit areas:** `nodePointerAreaPaint={(node, color, ctx) => {...}}` — for notes `arc(node.x, node.y, 6, ...)`; for tags measure `ctx.measureText(label)` and `fillRect` the padded bbox.
- **Edges:** `linkColor={() => focusedTag === null ? EDGE_COLOR : linkTouchesFocused(link) ? EDGE_COLOR : 'rgba(255,255,255,0.01)'}`, `linkWidth={1}`.
- **Interaction:** `onNodeHover={(n) => onNodeHover(n?.id ?? null)}`, `onNodeClick={(n) => onNodeClick(n.id)}`, `onBackgroundClick={onBackgroundClick}`, `enableNodeDrag` (default) so a frozen node still follows the cursor when dragged (`fx/fy`), `enablePanInteraction`/`enableZoomInteraction` default.
- **Sizing:** measure the parent with `ResizeObserver` into state; pass `width`/`height`.
- **Debug handle** (set once in an effect, kept current):

```ts
useEffect(() => {
  const api = {
    get nodeCount() { return graphRef.current?.graphData().nodes.length ?? 0 },
    get linkCount() { return graphRef.current?.graphData().links.length ?? 0 },
    nodePositions: () => (graphRef.current?.graphData().nodes ?? []).map((n) => ({ id: n.id, x: n.x, y: n.y })),
  }
  ;(window as unknown as Record<string, unknown>).__NOTELINGS_GRAPH__ = api
  return () => { delete (window as unknown as Record<string, unknown>).__NOTELINGS_GRAPH__ }
}, [])
```

- [ ] **Step 2: Create `KnowledgeGraphOverlay.tsx`**

- Reads `graphOpen`/`closeGraph` from `useOfficeViewStore`; selects `state.notes` (stable map) and derives `const graphData = useMemo(() => buildGraphData(Object.values(notesMap)), [notesMap])`.
- `const [hoveredId, setHoveredId] = useState<string | null>(null)`, `const [focusedTag, setFocusedTag] = useState<string | null>(null)`, `const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)`.
- Handlers: `onNodeClick` → `node.type === 'note' ? setSelectedNoteId(node.noteId!) : setFocusedTag(f => f === node.id ? null : node.id)`; `onBackgroundClick` → `setFocusedTag(null); setSelectedNoteId(null)`.
- ESC: `useEffect` keydown — if `selectedNoteId` → close panel only; else `closeGraph()`. Clear `hoveredId`/`focusedTag`/`selectedNoteId` on close.
- Render (wrapped in `AnimatePresence`):

```tsx
{graphOpen && (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    className="pointer-events-auto fixed inset-0 z-40 bg-black/60"
    role="dialog" aria-modal="true" aria-label="Knowledge graph"
  >
    {/* Header — glass pill, Poppins title + serif accent, live counts, close */}
    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 md:p-6">
      <div className="liquid-glass flex items-center gap-3 rounded-full px-4 py-2">
        <p className="text-sm font-medium tracking-tight text-white">
          Knowledge <em className="font-serif font-normal italic text-white/80">Graph</em>
        </p>
        <span className="text-[11px] text-white/50">
          {graphData.nodes.filter((n) => n.type === 'tag').length} tags · {graphData.nodes.filter((n) => n.type === 'note').length} notes
        </span>
      </div>
      <button type="button" aria-label="Close knowledge graph" onClick={closeGraph}
        className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95">
        <X size={16} />
      </button>
    </div>

    {graphData.nodes.length === 0 ? (
      <div className="flex h-full items-center justify-center">
        <p className="liquid-glass rounded-2xl px-6 py-8 text-sm text-white/40">
          No notes yet — submit a note to grow your brain.
        </p>
      </div>
    ) : (
      <KnowledgeGraphCanvas graphData={graphData} hoveredId={hoveredId} focusedTag={focusedTag}
        onNodeHover={setHoveredId} onNodeClick={handleNodeClick} onBackgroundClick={handleBackgroundClick} />
    )}

    <GraphSidePeek noteId={selectedNoteId} onClose={() => setSelectedNoteId(null)} />
  </motion.div>
)}
```

- Full-screen **scrim is `bg-black/60 backdrop-blur-md`** per the M5 aesthetic brief. The dimmed office remains visibly present behind the graph.
- **Mount `KnowledgeGraphOverlay`** in `NotelingsUI` next to the mobile kanban sheet (outside the `!hidden` block — the graph works even in Hide-UI mode).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. If `react-force-graph-2d` types are missing (Task 1 fallback), write the minimal shim for the props used: `graphData`, `warmupTicks`, `cooldownTicks`, `nodeCanvasObject`, `nodeCanvasObjectMode`, `nodePointerAreaPaint`, `linkColor`, `linkWidth`, `onNodeHover`, `onNodeClick`, `onBackgroundClick`, `width`, `height`, plus `ForceGraphMethods`.

- [ ] **Step 4: Manual browser smoke** (dev server must be warm)

Open the app → click the dock **Graph** button → verify: overlay fades in, tags render as white Poppins text, notes as gray dots, edges faint; the layout is **already settled** (no dancing) and stays frozen while panning/zooming; R3F office visible dimmed behind; 0 console errors. Then close via Esc and via the header X.

- [ ] **Step 5: Commit**

```bash
git add components/notelings/KnowledgeGraphCanvas.tsx components/notelings/KnowledgeGraphOverlay.tsx components/notelings/NotelingsUI.tsx
git commit -m "feat(m5): frozen-layout neural-glass knowledge graph overlay"
```

---

### Task 6: The "Side-Peek" note panel (GPU-only slide, read/edit/archive)

**Files:**
- Create: `components/notelings/GraphSidePeek.tsx`
- Modify: `components/notelings/KnowledgeGraphOverlay.tsx` (mount the panel — already referenced in Task 5)

**Interfaces:**
- Consumes: `GraphSidePeek({ noteId: string | null, onClose: () => void })`; `useAgentStore` (`notes` map, `upsertNote`, `markNoteArchiving`, `enqueueArchive`, `logTerminal`, `archivingNoteIds`); `EditNoteSchema`/`parseTags`/`validateTags` (Task 3); `NoteRecordSchema` from `lib/notes/notesApi`; `timeAgo` from `lib/notes/kanban`; `Spinner` from `@/components/ui/spinner`.
- Produces: a `.liquid-glass-strong` right rail (fixed, `right-0`, full-height, `w-[min(92vw,400px)]`) that reads/edits/archives the selected note; auto-closes when the note leaves the store (archived/removed).

- [ ] **Step 1: Implement the panel shell — 60fps-compliant slide (60fps-animation skill)**

```tsx
'use client'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
// ...imports as listed in Interfaces...

export default function GraphSidePeek({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const reduceMotion = useReducedMotion()
  const notes = useAgentStore((state) => state.notes)
  const note = noteId ? notes[noteId] ?? null : null

  // Auto-close when the note leaves the vault (agentic archive delivery / delete).
  useEffect(() => {
    if (noteId && !notes[noteId]) onClose()
  }, [noteId, notes, onClose])

  return (
    <AnimatePresence>
      {note && (
        <motion.aside
          key="side-peek"
          // transform + opacity ONLY — compositor-animated, no layout thrash over the 3D scene.
          initial={{ x: '105%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '105%', opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
          className="liquid-glass-strong pointer-events-auto fixed inset-y-0 right-0 z-50 w-[min(92vw,400px)]"
          role="dialog" aria-modal="false" aria-label="Note side panel"
        >
          {/* header: category chip + status dot + close */}
          {/* read view: content, tags chips, created time, Edit + Archive buttons */}
          {/* edit view (toggled): textarea + tags input, Save/Cancel (Task 3 helpers) */}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
```

Per the 60fps skill: the slide animates **only `x` (transform) and `opacity`**; the `blur(50px)` backdrop-filter is static (never animated) and bounded to the 400px panel, so the compositor handles the motion. No `width/height/top/left/box-shadow` animation anywhere. `useReducedMotion` shortens it to instant. The panel does not block the graph canvas: width ≤ 400px, `aria-modal="false"`, and the rest of the overlay stays interactive.

- [ ] **Step 2: Read view**

Reuse `NoteCard`-style anatomy but as the panel body: `note.category` chip, `STATUS_DOT`-style status dot (copy the 4-row map from `NoteCard.tsx`), `note.content` (full, `whitespace-pre-wrap`), tag chips `#{tag}`, `timeAgo(note.created_at)`. Buttons (matching the repo's `rounded-full bg-white/10 ... hover:scale-105 active:scale-95` anatomy): **Edit** (Pencil icon → edit mode), **Archive** (Archive icon → agentic flow, Step 3), Close (X).

- [ ] **Step 3: Edit view + agentic archive**

- Edit mode uses `useForm` + `zodResolver(EditNoteSchema)` with `defaultValues: { content: note.content, tags: note.tags.join(', ') }`. Submit: `const tagList = parseTags(tags); const invalid = validateTags(tagList); if (invalid) { toast.error(invalid); return }` → `PATCH /api/notes/${note.id}` `{ content, tags: tagList }` → `NoteRecordSchema.safeParse` → `upsertNote(parsed.data)` + `logTerminal(...)` + `toast.success('Note updated.')` → exit edit mode. On failure `toast.error('Could not update the note.')` and stay. (Identical contract to `NoteEditModal`.)
- **Archive (user decision: agentic, consistent with the Kanban):**

```ts
const handleArchive = () => {
  if (!note) return
  markNoteArchiving(note.id)
  logTerminal(`Archive requested: "${note.content.slice(0, 24)}"`)
  toast(`Archiving…`, { id: `archiving-${note.id}` })
  enqueueArchive({ noteId: note.id, category: note.category, content: note.content, tags: note.tags })
  onClose() // close the panel; the note leaves the graph when the robot files it
}
```

The note stays a satellite while the robot walks (status still `filed`); when delivery lands, realtime PATCHes the store → `buildGraphData` drops the archived node → panel auto-closes (already closed). If `note.status === 'archived'` (race), render nothing. Show the `Archiving…` pulse while `archivingNoteIds.has(note.id)`.

- [ ] **Step 4: Typecheck + lint + unit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 0 errors; full suite green (174 + noteEdit tests).

- [ ] **Step 5: Manual browser smoke**

From the graph, click a note dot → panel slides in from the right (smooth, GPU). Edit tags → Save → graph edges update **without the layout re-animating** (frozen). Click Archive → panel closes, `Archiving…` toast, robot walks to the trash behind the dimmed overlay; when delivered, the dot disappears from the graph. Esc closes the panel, then the overlay.

- [ ] **Step 6: Commit**

```bash
git add components/notelings/GraphSidePeek.tsx components/notelings/KnowledgeGraphOverlay.tsx
git commit -m "feat(m5): side-peek note panel (GPU slide, edit, agentic archive)"
```

---

### Task 7: E2E — `knowledge-graph.spec.ts`

**Files:**
- Create: `e2e/knowledge-graph.spec.ts`
- Modify: `playwright.config.ts` only if `testMatch` needs widening (check first — the M3/M4 specs already widened it)

**Interfaces:**
- Consumes: dev server + the debug handle `window.__NOTELINGS_GRAPH__` (Task 5); store mirror fed by a mocked `GET /api/notes`.

- [ ] **Step 1: Write the spec** (mirror the existing specs' helpers: `page.route('**/api/notes', ...)` to serve a fixture with ~3 tags / ~5 notes incl. one archived + one untagged; `page.route('**/api/categorize', ...)` if the harness submits anything — the graph spec does not submit)

Assertions:
1. **Open + counts:** click the dock graph button → overlay `role="dialog"` visible; `page.waitForFunction(() => (window as any).__NOTELINGS_GRAPH__?.linkCount > 0)`; node/link counts match the fixture (e.g. 3 tag hubs + 4 non-archived note nodes; archived excluded).
2. **Frozen layout:** read `nodePositions()`, `page.waitForTimeout(600)`, read again → deep-equal (tolerance 1e-6). This is the CPU-freeze regression guard.
3. **Hover focus:** `page.mouse.move` over a node position (from the debug handle + `graphScreenCoords`) → assert via the handle that `hoveredId` is set — or assert a class/pixel change; keep the assertion on the handle for determinism.
4. **Note click → side-peek:** click a note node's screen coords → `getByRole('dialog', { name: 'Note side panel' })` visible and shows the note's content.
5. **Edit tags → graph updates:** fill the tags input, Save → wait for the handle's `linkCount` to change to the expected new value; assert `nodeCount` unchanged (no duplicate hubs).
6. **Archive request:** click Archive → assert the `Archiving…` toast + the note's id present in `useAgentStore`'s `archivingNoteIds` via `window.__NOTELINGS_STORE__` if exposed (else assert the toast only) — the full robot walk is covered by the existing office archive e2e; do not duplicate the long walk here.
7. **Esc:** press Escape → overlay closes (panel already closed).
8. **Console:** zero console errors (existing helper).

- [ ] **Step 2: Run the suite**

Run: `npm run test:e2e` (warm dev server first — known cold-compile flake)
Expected: all specs green including the new one; no new console errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/knowledge-graph.spec.ts
git commit -m "test(m5): knowledge graph e2e (open, frozen layout, hover, side-peek edit, archive)"
```

---

### Task 8: Docs + full validation + memory protocol

**Files:**
- Modify: `knowledge.md`, `handoff.md`, `CURRENT_STATE.md` (mark M5 row), `docs/lessons-learned.md` (append any force-graph/cooldown gotchas discovered, e.g. "cooldownTicks=0 freezes the tick loop; node x/y persist by id; keep node objects id-stable")

- [ ] **Step 1: Full validation gate**

Run: `npx tsc --noEmit && npm test && npm run lint && npm run build && npm run test:e2e`
Expected: tsc 0, full unit suite green, lint 0 errors (existing warning baseline), production build ✓, e2e green.

- [ ] **Step 2: Update memory files** — append a "Work completed — M5 Knowledge Graph" entry to `handoff.md` (what changed, why, validation), a condensed architecture note to `knowledge.md` (graph data source = store mirror, warmupTicks 250 / cooldownTicks 0, z-40 overlay, side-peek transform-only slide, debug handle name), the M5 status in `CURRENT_STATE.md`, and any new lessons. Keep files lean (< ~200 lines).

- [ ] **Step 3: Final commit**

```bash
git add knowledge.md handoff.md CURRENT_STATE.md docs/lessons-learned.md
git commit -m "docs(m5): knowledge graph milestone — memory + state updates"
```

---

## Self-Review

**Spec coverage (MILESTONE_5_GRAPH.md):**
- Bipartite hub model (tag hubs + note satellites, tag→note edges only) → Task 2. ✅
- `react-force-graph-2d` + 2D canvas (no extra WebGL context) → Tasks 1, 5. ✅
- Physics freezing (`warmupTicks` + `cooldownTicks={0}`) → Task 5 (validated against the lib; `cooldownTicks={0}` = stop immediately). ✅
- Neural-glass look: translucent blurred scrim, white Poppins tag text, `#888` note dots, `rgba(255,255,255,0.1)` edges, hover focus with category colors, 10% fade → Task 5. ✅
- Side-peek editor (read/edit/archive, tags edit re-computes graph) → Tasks 6 + 2. ✅
- Skill application: writing-plans (this doc), d3-viz (warmup/freeze + data prep), 60fps-animation (transform/opacity-only slide, reduced-motion), vercel-react-best-practices (dynamic import, useMemo, stable selectors), shadcn (repo UI conventions) → woven into Tasks 5-6. ✅
- Non-destructive: no R3F/canvas/frameloop changes; overlay is additive DOM at z-40. ✅

**Placeholder scan:** no TBDs; every code step shows the actual implementation or the exact prop/pattern to use.

**Type consistency:** `GraphNode.id`/`GraphLink.source|target` strings match the `nodeCanvasObject`/`linkColor` accessors; `GraphSidePeek({ noteId, onClose })` matches its mount in Task 5; `validateTags` returns `string | null` and is used consistently; store fields (`graphOpen`, `toggleGraph`, `closeGraph`) are defined in Task 4 and consumed in Tasks 5-7.

**Execution handoff:** after user approval, execute with `executing-plans` (inline, with checkpoints) or subagent-driven — see the approval message.
