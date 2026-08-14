# M3 Tag Browser + M4 RAG Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Obsidian-style Tag Explorer (M3) and a strictly-grounded "Ask the Librarian" RAG chat (M4) to the Notelings SAMS control center without touching the 3D scene, pathfinding, or existing routes.

**Architecture:** Two additive feature surfaces inside the existing Bloom overlay. M3 = pure tag helpers + a service-role `GET /api/tags` route + a wide `.liquid-glass-strong` modal reading the already-realtime-synced Zustand notes mirror. M4 = a pure strict-grounding prompt/context builder + `POST /api/chat` (Vercel AI SDK `streamText`, `temperature: 0`) + a floating chat panel above the dock driven by `useChat` from the official `@ai-sdk/react` package.

**Tech Stack:** Next.js 16 App Router (nodejs routes), Vercel AI SDK `ai@7.0.58` + `@ai-sdk/google@4.0.39` (installed) + `@ai-sdk/react@4.0.61` (TO INSTALL), `@supabase/supabase-js`, Zustand 5 (existing notes mirror), zod v4, Tailwind v4 (`columns-*` masonry), framer-motion, lucide-react, react-hook-form (existing dock form).

## Global Constraints

- **Aesthetic (PHASE_2_SPEC_FINAL_UPDATED §2):** grayscale only (`text-white/80`, `text-white/50`, …); no colored borders/backgrounds; Poppins standard + Source Serif 4 italics for accents; interactions `hover:scale-105 transition-transform`; Lucide icons in rounded `bg-white/10` containers; all new panels use `.liquid-glass` / `.liquid-glass-strong`.
- **Non-destructive (§5):** never break the R3F canvas, pathfinding, or base Supabase connection. Existing routes `GET /api/notes`, `PATCH/DELETE /api/notes/[id]`, `POST /api/categorize` behavior is unchanged.
- **Realtime rule (§5):** the store's `notes` mirror (initial fetch + Supabase Realtime) is the single source of truth for filtering — tag clicks must NOT poll; they read `useAgentStore.getState().notes`.
- **Server-only discipline:** `createServerSupabase()` (service role) is only importable from route handlers / server modules (`import 'server-only'`); the anon browser client stays read-only for Realtime. The AI SDK must never be imported by client components.
- **Dock default:** "New Note" mode is the default — the E2E baseline asserts `Type a new note` / `Submit note` accessible names and MUST stay green.
- **Archived scope (user decision):** archived notes are excluded from RAG context and tag-browser results (pending/in_transit/filed only).
- **Ask before installing packages** (repo rule): the ONLY new dependency is `@ai-sdk/react@4.0.61` (user-approved).
- zod v4, TypeScript strict, `npm test` (vitest), `npm run lint`, `npx tsc --noEmit`, `npm run test:e2e` (Playwright, dev server required).

---

### Task 1: Install `@ai-sdk/react`

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

```bash
npm install @ai-sdk/react@^4.0.61
```

- [ ] **Step 2: Verify it resolves and exports useChat**

```bash
node -e "const p=require('./node_modules/@ai-sdk/react/package.json'); console.log(p.version, JSON.stringify(Object.keys(p.exports||{})))"
grep -c 'declare function useChat' node_modules/@ai-sdk/react/dist/index.d.ts
```

Expected: version 4.x; `useChat` found (count ≥ 1).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @ai-sdk/react for useChat (M4 RAG chat)"
```

---

### Task 2: Pure tag helpers

**Files:**
- Create: `lib/notes/tags.ts`
- Test: `lib/notes/tags.test.ts`

**Interfaces:**
- Produces:
  - `collectUniqueTags(notes: readonly NoteRecord[]): string[]` — every distinct tag across the notes, deduped case-insensitively (first casing wins), sorted `localeCompare`.
  - `notesWithTag(notes: readonly NoteRecord[], tag: string): NoteRecord[]` — notes whose `tags` contain the tag (case-insensitive match), **excluding `status === 'archived'`**.
  - `tagCounts(notes: readonly NoteRecord[]): Map<string, number>` — count per normalized (lowercased) tag over non-archived notes.

- Consumes: `NoteRecord` from `lib/notes/types.ts` (no other imports; module stays scene-free and client-safe).

- [ ] **Step 1: Write the failing test**

`lib/notes/tags.test.ts` — fixtures: `{ id:'1', content:'a', category:'Work', tags:['roadmap','Q3'], status:'filed', created_at:'2026-08-01T00:00:00Z' }`, `{ id:'2', …, tags:['roadmap','budget'], status:'in_transit', … }`, `{ id:'3', …, tags:['ROADMAP'], status:'archived', … }`, `{ id:'4', …, tags:[], status:'filed', … }`.

Assertions:
- `collectUniqueTags` returns `['budget', 'Q3', 'roadmap']` (case-insensitive dedupe keeps first casing `roadmap`, sorted).
- `notesWithTag(notes, 'ROADMAP')` returns ids `['1','2']` (case-insensitive, archived `3` excluded).
- `notesWithTag(notes, 'roadmap')` same result.
- `tagCounts` map: `roadmap → 2`, `budget → 1`, `q3 → 1` (archived excluded).
- Empty input → `[]` / empty map.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/notes/tags.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/notes/tags.ts`**

```ts
import type { NoteRecord } from './types'

const ACTIVE_STATUSES = new Set(['pending', 'in_transit', 'filed'])

function activeNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  return notes.filter((note) => ACTIVE_STATUSES.has(note.status))
}

export function collectUniqueTags(notes: readonly NoteRecord[]): string[] {
  const byLower = new Map<string, string>()
  for (const note of activeNotes(notes)) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase()
      if (!byLower.has(key)) byLower.set(key, tag)
    }
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b))
}

export function notesWithTag(notes: readonly NoteRecord[], tag: string): NoteRecord[] {
  const needle = tag.toLowerCase()
  return activeNotes(notes).filter((note) => note.tags.some((t) => t.toLowerCase() === needle))
}

export function tagCounts(notes: readonly NoteRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const note of activeNotes(notes)) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/notes/tags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notes/tags.ts lib/notes/tags.test.ts
git commit -m "feat(m3): pure tag helpers — unique tags, tag filter, counts"
```

---

### Task 3: `GET /api/tags` route

**Files:**
- Create: `app/api/tags/route.ts`

**Interfaces:**
- Produces: `GET → { tags: string[] }` (unique tags across ALL notes including archived — the archive row still carries knowledge of its tags; the UI filters them out via the store). Response validated against `TagsResponseSchema`.
- Consumes: `createServerSupabase()` from `lib/supabase/server.ts`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const TagsResponseSchema = z.object({ tags: z.array(z.string()) })

/** M3: all unique tags in the vault (service role). Lightweight: reads only the tags column. */
export async function GET() {
  const { data, error } = await createServerSupabase().from('notes').select('tags')
  if (error) {
    return NextResponse.json({ error: 'Could not load tags' }, { status: 500 })
  }
  const seen = new Set<string>()
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? []) as string[]) seen.add(tag)
  }
  const tags = [...seen].sort((a, b) => a.localeCompare(b))
  return NextResponse.json(TagsResponseSchema.parse({ tags }))
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/tags/route.ts
git commit -m "feat(m3): GET /api/tags — unique tag list from Supabase"
```

---

### Task 4: `GlassModal` width variant

**Files:**
- Modify: `components/notelings/GlassModal.tsx`

**Interfaces:**
- Produces: `size?: 'default' | 'wide'` prop (default `'default'`, width unchanged: `w-[min(92vw,540px)]`; `'wide'`: `w-[min(92vw,880px)]`).
- Consumes: nothing new (existing `open/onClose/title/children` contract unchanged).

- [ ] **Step 1: Add the prop**

```tsx
type GlassModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** M3: 'wide' for the tag explorer masonry. Default: 'default'. */
  size?: 'default' | 'wide'
}

export default function GlassModal({ open, onClose, title, children, size = 'default' }: GlassModalProps) {
  // ...
  className={`liquid-glass-strong ${size === 'wide' ? 'w-[min(92vw,880px)]' : 'w-[min(92vw,540px)]'} rounded-[2rem] p-7`}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors (existing `GlassModal` callers unaffected — prop optional).

- [ ] **Step 3: Commit**

```bash
git add components/notelings/GlassModal.tsx
git commit -m "feat(m3): GlassModal wide size variant"
```

---

### Task 5: Tag Explorer modal

**Files:**
- Create: `components/notelings/TagExplorerModal.tsx`

**Interfaces:**
- Produces: `TagExplorerModal({ open, onClose }: { open: boolean; onClose: () => void })`.
- Consumes: `GlassModal` (size `'wide'`), `collectUniqueTags`/`notesWithTag`/`tagCounts` from `lib/notes/tags.ts`, `useAgentStore` notes mirror, `NoteCard` (read-only: pass no `onEdit`/`onArchive`), `Spinner` from `@/components/ui/spinner`.

Behavior:
- On `open`, fetch `GET /api/tags` once → `{ tags }` state; `loading` → spinner; failure → inline error text with a Retry button.
- Tag chip row (wrap): each chip `rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:scale-105` with count; selected chip `bg-white/20 text-white`.
- Selecting a tag shows the masonry grid: container `columns-2 lg:columns-3 gap-3`; each `NoteCard` wrapped in a div with `mb-3 break-inside-avoid`; notes from `notesWithTag(Object.values(storeNotes), tag)`; empty → "No notes with this tag."
- "All tags" (deselect) chip toggles back to the tag list.
- Modal has a live count `N tags` in the header row.

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAgentStore } from '@/components/office/agentStore'
import { collectUniqueTags, notesWithTag, tagCounts } from '@/lib/notes/tags'
import GlassModal from './GlassModal'
import NoteCard from './NoteCard'
import { Spinner } from '@/components/ui/spinner'

type TagExplorerModalProps = { open: boolean; onClose: () => void }

export default function TagExplorerModal({ open, onClose }: TagExplorerModalProps) {
  const notes = useAgentStore((state) => Object.values(state.notes))
  const [serverTags, setServerTags] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open || serverTags !== null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/tags')
      .then((res) => { if (!res.ok) throw new Error(`tags ${res.status}`); return res.json() as Promise<{ tags: string[] }> })
      .then((json) => { if (!cancelled) setServerTags(json.tags) })
      .catch(() => { if (!cancelled) setError('Could not load tags.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, serverTags])

  const counts = tagCounts(notes)
  const allTags = serverTags ?? collectUniqueTags(notes)
  const matches = selected ? notesWithTag(notes, selected) : []

  return (
    <GlassModal open={open} onClose={onClose} title="Tag Explorer" size="wide">
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-white/50"><Spinner className="size-4" /> Loading tags…</div>
        ) : error ? (
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-6">
            <p className="text-xs text-white/50">{error}</p>
            <button type="button" onClick={() => setServerTags(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-transform hover:scale-105">Retry</button>
          </div>
        ) : allTags.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center text-xs text-white/30">No tags yet — notes get LLM tags as they&apos;re filed.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={selected === null}
                onClick={() => setSelected(null)}
                className={`rounded-full px-3 py-1.5 text-xs transition-transform duration-200 hover:scale-105 ${selected === null ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}
              >
                All tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected === tag}
                  onClick={() => setSelected(selected === tag ? null : tag)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-transform duration-200 hover:scale-105 ${selected === tag ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  #{tag} <span className="text-white/40">{counts.get(tag.toLowerCase()) ?? 0}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="columns-2 gap-3 lg:columns-3">
                {matches.map((note) => (
                  <div key={note.id} className="mb-3 break-inside-avoid">
                    <NoteCard note={note} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </GlassModal>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/notelings/TagExplorerModal.tsx
git commit -m "feat(m3): Tag Explorer modal — unique tags + masonry grid"
```

---

### Task 6: Dock search button

**Files:**
- Modify: `components/notelings/TerminalDock.tsx`

- [ ] **Step 1: Wire the Search button + modal**

Add to the dock row (between `CommandDock` and the divider):

```tsx
<button
  type="button"
  aria-label="Explore tags"
  onClick={() => setTagExplorerOpen(true)}
  className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
>
  <Search size={15} />
</button>
```

Add state `const [tagExplorerOpen, setTagExplorerOpen] = useState(false)` and render `<TagExplorerModal open={tagExplorerOpen} onClose={() => setTagExplorerOpen(false)} />` (outside the dock panel, sibling of it). Import `Search` from `lucide-react` and `TagExplorerModal`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/notelings/TerminalDock.tsx
git commit -m "feat(m3): tag explorer search button in the dock"
```

**M3 checkpoint → user tests the Tag Explorer before M4 begins.**

---

### Task 7: Strict-grounding chat context (pure)

**Files:**
- Create: `lib/notes/chatContext.ts`
- Test: `lib/notes/chatContext.test.ts`

**Interfaces:**
- Produces:
  - `LIBRARIAN_SYSTEM_PROMPT: string` — the fixed rule block (verbatim below).
  - `buildNotesContext(notes: readonly NoteRecord[]): string` — numbered `<notes>` block, non-archived only, each entry `[n] (category, tags: …) content`, newest-first order preserved from caller.
  - `buildLibrarianSystemPrompt(notes: readonly NoteRecord[]): string` — `LIBRARIAN_SYSTEM_PROMPT + '\n\n' + buildNotesContext(notes)`.
- Consumes: `NoteRecord` from `lib/notes/types.ts` only. **NO AI SDK import** (vitest must run this without the SDK).

- [ ] **Step 1: Write the failing test**

`lib/notes/chatContext.test.ts`:
- `buildLibrarianSystemPrompt([])` contains the exact refusal sentence `I couldn't find any notes related to that.` and `<notes>` with no entries.
- `buildLibrarianSystemPrompt(fixtures)` contains `[1]` and the note's content; archived note content is NOT present.
- The prompt says "only" / restricts to the notes (assert the word `only` is present).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/notes/chatContext.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/notes/chatContext.ts`**

```ts
import type { NoteRecord } from './types'

/**
 * M4 "Ask the Librarian" — strict grounding contract (PHASE_2_SPEC_FINAL_UPDATED
 * M4). Kept free of the AI SDK so vitest can test the exact wording.
 */
export const LIBRARIAN_SYSTEM_PROMPT =
  'You are the Librarian of a personal "Second Brain" note vault. You answer questions ' +
  'about the user\'s notes. STRICT RULES — follow every one:\n' +
  '1. Ground your answer ONLY in the notes in the <notes> section below. Do not use outside ' +
  'knowledge, training data, assumptions, or guesses.\n' +
  '2. If the question cannot be fully answered from the provided notes, refuse explicitly and ' +
  'exactly: "I couldn\'t find any notes related to that." Do not answer, speculate, or elaborate.\n' +
  '3. If there are no notes, always refuse with the exact sentence above.\n' +
  '4. When you do answer, cite the note(s) you used with their bracketed numbers, e.g. [1], [2].\n' +
  '5. Be concise. Never invent facts, dates, or quotes that are not in the notes.'

export function buildNotesContext(notes: readonly NoteRecord[]): string {
  const active = notes.filter((note) => note.status !== 'archived')
  if (active.length === 0) return '<notes>\n(no notes)\n</notes>'
  const lines = active.map(
    (note, index) =>
      `[${index + 1}] (${note.category}, tags: ${note.tags.join(', ') || 'none'}) ${note.content}`,
  )
  return `<notes>\n${lines.join('\n')}\n</notes>`
}

export function buildLibrarianSystemPrompt(notes: readonly NoteRecord[]): string {
  return `${LIBRARIAN_SYSTEM_PROMPT}\n\n${buildNotesContext(notes)}`
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/notes/chatContext.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notes/chatContext.ts lib/notes/chatContext.test.ts
git commit -m "feat(m4): strict-grounding librarian prompt + notes context builder"
```

---

### Task 8: Chat request schema (client-safe)

**Files:**
- Create: `lib/notes/chatApi.ts`
- Test: `lib/notes/chatApi.test.ts`

**Interfaces:**
- Produces:
  - `ChatRequestSchema = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().optional(), parts: z.array(z.unknown()).optional() })).min(1).max(20) })`
  - `normalizeChatMessages(messages: ChatRequest['messages']): { role: 'user' | 'assistant'; content: string }[]` — extracts text from `content` or `parts[].text`, keeps only non-empty user/assistant messages (drops system).
- Consumes: zod only.

- [ ] **Step 1: Write the failing test**

Assertions: plain `{role:'user', content:'hi'}` → `[{role:'user', content:'hi'}]`; parts-based `{role:'user', parts:[{type:'text', text:'hello'}]}` → content `'hello'`; empty-content message dropped; system message dropped.

- [ ] **Step 2: Verify it fails** — `npx vitest run lib/notes/chatApi.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { z } from 'zod'

/** M4: client-safe chat schemas shared by the route and (indirectly) useChat. */
export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().optional(),
        parts: z.array(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(20),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export type ModelMessage = { role: 'user' | 'assistant'; content: string }

/** Normalize UI messages (content or parts[]) to plain text model messages. */
export function normalizeChatMessages(messages: ChatRequest['messages']): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    let text = ''
    if (typeof message.content === 'string') text = message.content
    else {
      for (const part of message.parts ?? []) {
        if (part && typeof part === 'object' && 'type' in part && (part as { type?: unknown }).type === 'text') {
          const t = (part as { text?: unknown }).text
          if (typeof t === 'string') text += t
        }
      }
    }
    if (text.trim()) out.push({ role: message.role as 'user' | 'assistant', content: text })
  }
  return out
}
```

- [ ] **Step 4: Verify it passes** — `npx vitest run lib/notes/chatApi.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notes/chatApi.ts lib/notes/chatApi.test.ts
git commit -m "feat(m4): chat request schema + UI-message normalizer"
```

---

### Task 9: `POST /api/chat` route

**Files:**
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Produces: `POST { messages } → toUIMessageStreamResponse()` stream (consumed by `useChat`).
- Consumes: `streamText`/`google` (server-only), `createServerSupabase()`, `ChatRequestSchema`/`normalizeChatMessages`, `buildLibrarianSystemPrompt`.
- Constants: `CHAT_LLM_TIMEOUT_MS = 25_000`, `CHAT_NOTE_LIMIT = 150`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { ChatRequestSchema, normalizeChatMessages } from '@/lib/notes/chatApi'
import { buildLibrarianSystemPrompt } from '@/lib/notes/chatContext'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const CHAT_LLM_TIMEOUT_MS = 25_000
const CHAT_NOTE_LIMIT = 150

/** M4: "Ask the Librarian" — strictly-grounded RAG over the user's notes.
 *  temperature 0 + maxRetries 0 + the refusal system prompt = no hallucination.
 */
export async function POST(request: Request) {
  let input: { messages: unknown }
  try {
    input = ChatRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid chat request' }, { status: 400 })
  }

  const { data, error } = await createServerSupabase()
    .from('notes')
    .select('content, category, tags, status, created_at')
    .in('status', ['pending', 'in_transit', 'filed'])
    .order('created_at', { ascending: false })
    .limit(CHAT_NOTE_LIMIT)

  if (error) {
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 })
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: buildLibrarianSystemPrompt(data ?? []),
    messages: normalizeChatMessages(input.messages),
    temperature: 0,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(CHAT_LLM_TIMEOUT_MS),
  })

  return result.toUIMessageStreamResponse()
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Live smoke test**

```bash
curl -N -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What did I plan for Q3?"}]}'
```

Expected: newline-delimited JSON lines beginning with `{"type":"start",…}` followed by `text-delta` lines (UIMessage protocol). With no notes in the DB, the first `text-delta` should be the refusal sentence.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(m4): POST /api/chat — grounded RAG streaming route (temp 0)"
```

---

### Task 10: Librarian chat hook (wraps useChat)

**Files:**
- Create: `components/notelings/useLibrarianChat.ts`

**Interfaces:**
- Produces: `useLibrarianChat()` → `{ messages, input, setInput, sendMessage, status, error }` (re-exports from `useChat` plus terminal logging).
- Consumes: `useChat` from `@ai-sdk/react`, `useAgentStore.logTerminal`.

- [ ] **Step 1: Implement**

```ts
'use client'

import { useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { useAgentStore } from '@/components/office/agentStore'

/** M4: Ask-the-Librarian chat state, wired to /api/chat with terminal logging. */
export function useLibrarianChat() {
  const chat = useChat({ api: '/api/chat', sendExtraMessageFields: true })
  const logTerminal = useAgentStore((state) => state.logTerminal)

  const sendMessage = useCallback(
    (content: string) => {
      logTerminal(`Asking the Librarian: "${content.slice(0, 48)}"`)
      void chat.sendMessage(content)
    },
    [chat.sendMessage, logTerminal],
  )

  return { ...chat, sendMessage }
}
```

(If `sendMessage` is unavailable in this useChat version, fall back to `chat.handleSubmit` with a synthetic event — verify against `node_modules/@ai-sdk/react/dist/index.d.ts` at implementation time.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/notelings/useLibrarianChat.ts
git commit -m "feat(m4): useLibrarianChat hook wrapping useChat"
```

---

### Task 11: Chat panel (floating conversation above the dock)

**Files:**
- Create: `components/notelings/ChatPanel.tsx`

**Interfaces:**
- Produces: `ChatPanel({ chat }: { chat: ReturnType<typeof useLibrarianChat> })` — renders only when `chat.messages.length > 0` or `chat.status === 'submitted'`; empty state otherwise.
- Consumes: framer-motion `AnimatePresence`/`motion.div` (slide-up), `GlassPanel strong`, `Spinner`.

- [ ] **Step 1: Implement**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import GlassPanel from './GlassPanel'
import { Spinner } from '@/components/ui/spinner'
import type { useLibrarianChat } from './useLibrarianChat'

type ChatPanelProps = { chat: ReturnType<typeof useLibrarianChat> }

export default function ChatPanel({ chat }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat.messages, chat.status])

  const hasConversation = chat.messages.length > 0 || chat.status === 'submitted'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 bottom-[92px] z-20 flex justify-center p-4 md:bottom-[104px]"
    >
      <GlassPanel strong className="pointer-events-auto w-[min(760px,calc(100vw-2rem))] rounded-[2rem]">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium tracking-tight text-white">
              Ask the <em className="font-serif font-normal italic text-white/80">Librarian</em>
            </p>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
              grounded · temp 0
            </span>
          </div>
          <div ref={scrollRef} data-chat-log className="terminal-log-scroll flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto pr-1">
            {!hasConversation ? (
              <p className="rounded-2xl bg-white/[0.03] px-4 py-6 text-center text-xs text-white/30">
                Ask about anything in your notes — answers are grounded strictly in what you&apos;ve filed.
              </p>
            ) : (
              chat.messages.map((message) => (
                <div key={message.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${message.role === 'user' ? 'self-end bg-white/15 text-white' : 'self-start liquid-glass text-white/85'}`}>
                  {message.content}
                  {message.role === 'assistant' && chat.status === 'streaming' && message.id === chat.messages[chat.messages.length - 1]?.id && (
                    <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-white/70 align-middle" />
                  )}
                </div>
              ))
            )}
            {chat.status === 'submitted' && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-xs text-white/50">
                <Spinner className="size-3" /> Searching your notes…
              </div>
            )}
          </div>
          {chat.error && <p role="alert" className="text-xs text-white/60">Something went wrong. Please try again.</p>}
        </div>
      </GlassPanel>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/notelings/ChatPanel.tsx
git commit -m "feat(m4): floating librarian chat panel above the dock"
```

---

### Task 12: New Note / Ask AI toggle + dock wiring

**Files:**
- Modify: `components/notelings/CommandDock.tsx`
- Modify: `components/notelings/TerminalDock.tsx`

**Interfaces:**
- Consumes: `useLibrarianChat` (mounted in `TerminalDock`), `ChatPanel`.
- Produces: `CommandDock` gains `mode?: 'note' | 'chat'` (default `'note'`) and `onAsk?: (content: string) => void`.

- [ ] **Step 1: Extend `CommandDock`**

- Props: `mode = 'note'`, `onAsk`.
- Placeholder: `mode === 'chat' ? 'Ask the Librarian…' : 'Type a new note…'`.
- Input `aria-label`: `mode === 'chat' ? 'Ask the Librarian' : 'Type a new note'`.
- Submit button `aria-label`: `mode === 'chat' ? 'Ask the Librarian' : 'Submit note'`; icon `BookOpen` in chat mode, `Send` in note mode.
- `onSubmit`: if `mode === 'chat'` → `await onAsk?.(content)` then `reset()`; else existing `submitNote`.

- [ ] **Step 2: Wire `TerminalDock`**

- State: `mode: 'note' | 'chat'`, `const chat = useLibrarianChat()` (always mounted so the conversation survives toggling).
- Segmented toggle (left of the input row, above it on mobile):

```tsx
<div role="group" aria-label="Dock mode" className="flex gap-1 rounded-full bg-white/10 p-1">
  <button type="button" aria-pressed={mode === 'note'} onClick={() => setMode('note')}
    className={`rounded-full px-3 py-1 text-[11px] transition-transform duration-200 hover:scale-105 ${mode === 'note' ? 'bg-white/20 text-white' : 'text-white/50'}`}>
    New Note
  </button>
  <button type="button" aria-pressed={mode === 'chat'} onClick={() => setMode('chat')}
    className={`rounded-full px-3 py-1 text-[11px] transition-transform duration-200 hover:scale-105 ${mode === 'chat' ? 'bg-white/20 text-white' : 'text-white/50'}`}>
    Ask AI
  </button>
</div>
```

- Render `<ChatPanel chat={chat} />` as a sibling of the dock (always mounted; `AnimatePresence` handles its appear/disappear via `hasConversation`). Wrap in `<AnimatePresence>` where `ChatPanel` is consumed.
- Pass `<CommandDock embedded mode={mode} onAsk={(content) => chat.sendMessage(content)} />`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/notelings/CommandDock.tsx components/notelings/TerminalDock.tsx
git commit -m "feat(m4): New Note / Ask AI dock toggle + chat wiring"
```

---

### Task 13: Unit tests + full validation

- [ ] **Step 1: Run the whole suite**

```bash
npx tsc --noEmit && npm test && npm run lint && npm run build
```

Expected: tsc 0 errors; all unit tests pass (109 + new: tags, chatContext, chatApi); lint 0 errors; production build succeeds.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "test: M3/M4 unit coverage + validation pass"
```

---

### Task 14: E2E — baseline guards + M3 + M4 specs

**Files:**
- Modify: `e2e/office-smoke.spec.ts` (baseline: assert the Search + Ask AI toggle exist; note mode still default)
- Create: `e2e/tag-explorer.spec.ts`
- Create: `e2e/librarian-chat.spec.ts`

- [ ] **Step 1: Baseline guard additions** (in the existing baseline test, after the terminal assertions):

```ts
await expect(page.getByRole('button', { name: 'Explore tags' })).toBeVisible()
await expect(page.getByRole('button', { name: 'Ask AI' })).toBeVisible()
await expect(page.getByRole('textbox', { name: 'Type a new note' })).toBeVisible()
```

- [ ] **Step 2: `e2e/tag-explorer.spec.ts`**

```ts
// Mock /api/tags + /api/notes (empty board), goto '/', dismiss welcome,
// click 'Explore tags' → modal with 'All tags' + '#roadmap' chip visible.
// Mock /api/tags → { tags: ['roadmap', 'budget'] } and /api/notes →
// one filed note tagged ['roadmap'] so clicking #roadmap shows its card in
// the masonry grid and clicking 'All tags' hides it again.
```

- [ ] **Step 3: `e2e/librarian-chat.spec.ts`**

Mock `POST /api/chat` with a hand-crafted UIMessage-protocol stream (content-type `text/plain; charset=utf-8`):

```
{"type":"start","message":{"id":"mock-assistant","role":"assistant","content":[],"parts":[{"type":"text","text":""}]}}
{"type":"text-delta","delta":"I couldn't find any notes related to that."}
{"type":"finish","finishReason":"stop","usage":{"inputTokens":1,"outputTokens":2},"messages":[]}
```

Steps: goto '/', dismiss welcome, click 'Ask AI' toggle → placeholder `Ask the Librarian…`; fill + submit; expect the refusal text visible in `[data-chat-log]`; expect the terminal to contain `Asking the Librarian:`.

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e
```

Expected: 6/6 green (4 existing + 2 new). Note: SwiftShader headless is slow — keep the new specs' budgets generous (`test.setTimeout(60_000)`).

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(e2e): M3 tag explorer + M4 librarian chat specs"
```

---

### Task 15: Docs + memory

**Files:**
- Modify: `docs/activity-log.md` (auto via hook), `handoff.md`, `knowledge.md`

- [ ] **Step 1: Update memory files**

- `handoff.md`: append "Work completed — M3 Tag Explorer + M4 Ask the Librarian" entry (route names, decisions: @ai-sdk/react installed, store-mirror filtering, archived excluded, floating panel; validation results).
- `knowledge.md`: update Architecture with the new routes/components; record `@ai-sdk/react` in the stack; note the `ai@7`/`@ai-sdk/react` split (no `ai/react`).
- `docs/lessons-learned.md`: add the v7 lesson — `ai/react` no longer exists; use `@ai-sdk/react`; `toUIMessageStreamResponse` replaces `toDataStreamResponse`.

- [ ] **Step 2: Commit**

```bash
git add handoff.md knowledge.md docs/lessons-learned.md
git commit -m "docs: M3/M4 session updates + AI SDK v7 lesson"
```

---

## Self-Review

- **Spec coverage:** M3 search icon in dock ✓ (Task 6), `.liquid-glass-strong` modal ✓ (Task 5), unique tags from Supabase ✓ (Task 3), masonry grid ✓ (Task 5). M4 chat toggle ✓ (Task 12), `app/api/chat/route.ts` ✓ (Task 9), strict grounding = temperature 0 + refusal system prompt ✓ (Tasks 7/9). Non-destructive constraints ✓ (additive only). Realtime rule ✓ (store mirror).
- **Placeholder scan:** every step has concrete code; the only conditional is the `sendMessage` vs `handleSubmit` fallback in Task 10, gated on the installed `.d.ts` (verified at implementation time).
- **Type consistency:** `useLibrarianChat` return feeds `ChatPanel` via `ReturnType<typeof useLibrarianChat>`; `TagExplorerModal` consumes `collectUniqueTags`/`notesWithTag`/`tagCounts` signatures from Task 2; `normalizeChatMessages` output type matches `streamText`'s `messages` input.
