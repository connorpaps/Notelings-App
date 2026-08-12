# Notelings — Current State Audit

> Generated 2026-08-12. A reconciliation of the live codebase against `MASTER_SPEC_FINAL.md`, `PHASE_2_SPEC_FINAL_UPDATED.md`, `UI_PROMPTS.md`, and the 15 implemented plan docs in `docs/superpowers/plans/`.

---

## 1. Verdict

The app is **functionally complete** for every planned milestone except one. There is **one blocking item** before new features (uncommitted work) plus some documentation drift and minor spec deviations worth addressing.

- **Phase 1** (M1–M4) — ✅ complete
- **Phase 2** (M1–M4) — ✅ complete
- **Phase 2 M5 (Knowledge Graph)** — ⏭️ not started (the next feature)
- **Phase 3** — out of scope (with one item already pulled forward; see §5)

---

## 2. Milestone status

| Milestone | Status | Evidence |
|---|---|---|
| **P1 · M1** Static 3D room (R3F canvas, ortho camera, voxel office) | ✅ | `OfficeCanvas` / office scene; now uses the GLB office |
| **P1 · M2** Puppet robots (LCD face states, 2D grid A*, click-to-move) | ✅ | `AgentRobot`, `pathfinding.ts`, `agentFace` |
| **P1 · M3** Brain (Zustand task queue + dispatcher, multi-robot) | ✅ | `agentStore.ts`, `useTaskDispatcher` |
| **P1 · M4** Interface & LLM (2D UI, `/api/categorize`, Supabase save) | ✅ | `NotelingsUI`, `app/api/categorize/route.ts` |
| **P2 · M1** SAMS control center (Kanban + Terminal, Realtime) | ✅ | `KanbanPanel`, `TerminalDock`, `useNotesRealtime` |
| **P2 · M2** Note management (Edit + agentic Archive) | ✅ | `NoteEditModal`, `enqueueArchive`, `useArchiveToasts` |
| **P2 · M3** Obsidian-style Tag Browser | ✅ | `TagExplorerModal`, `GET /api/tags` |
| **P2 · M4** "Ask the Librarian" RAG chat | ✅ | `POST /api/chat`, `useLibrarianChat`, `ChatPanel` |
| **P2 · M5** Knowledge Graph | ⏭️ Next | Not started |

**Folded into Phase 2 (2026-08-10, all shipped):** clickable `[n]` citations, deterministic counting (`countIntent.ts`), embedding retrieval for >150 notes, tag filter input.

---

## 3. Spec edge cases & non-goals

| Item | Status | Notes |
|---|---|---|
| LLM timeout/failure → toast + red sentinel error + save Uncategorized | ✅ | Degraded path in `/api/categorize` + `signalError('red')` |
| Pathfinding failure → emergency reset | ⚠️ partial | See §6 (no "Lounge"/teleport; error→auto-recover, note dropped) |
| Massive input (zod, 1000-char cap) | ✅ | `NoteInputSchema` trim 1–1000 |
| No authentication | ✅ | Single-user, browser-session |
| No physics/colliders | ✅ | Coordinate-based lerp only |
| No rigged animations | ✅ | Capsules slide/float |
| No multi-user sync | ✅ | Realtime is one-directional DB→UI only |

---

## 4. 🔴 Blocking: uncommitted work

All of the current session's work is **uncommitted** (`git status -sb` → `main...origin/main`, in sync but nothing pushed). New features should build on a clean, committed baseline.

**Modified (21):**
`app/page.tsx`, `components/notelings/NotelingsUI.tsx`, `components/office/AgentLayer.tsx`, `AgentRobot.tsx`, `GridDebugOverlay.tsx`, `GridEditorPanel.tsx`, `agentDestinations.ts`, `agentDestinations.test.ts`, `gridEditor.test.ts`, `gridEditorStore.ts`, `newOfficeGrid.test.ts`, `newOfficeGrid.ts`, `newOfficeGridData.ts`, `newOfficeLayout.ts`, `officeMode.ts`, `officeMode.test.ts`, `e2e/office-smoke.spec.ts`, `scripts/lock-in-grid.mjs`, `docs/lessons-learned.md`, `handoff.md`, `knowledge.md`

**New (2):**
`components/notelings/OfficeViewControls.tsx`, `components/office/officeViewStore.ts`

**Untracked (1, unrelated):** `2026-08-08 00-14-26.mp4`

### What's in this uncommitted batch
- **Nav map lock-in** — hand-painted map baked into `newOfficeGridData.ts` (1192 blocked / 572 free cells).
- **Trash staging re-point** — `[26,8]` → `[27,8]` (bin's own cell is now correctly blocked; robot stops one cell east).
- **Robot scale 10% smaller** — `ROBOT_VISUAL_SCALE` 0.8 → 0.72.
- **Note card scaled too** — new `NOTE_SCALE = 0.9` on the carried card (reads proportional to the body).
- **Nav editor + Hide UI toggles** — removed `ENABLE_GRID_DEBUG`; added `useOfficeViewStore` + header `OfficeViewControls` ("Edit nav" opens the hidden-by-default editor, "Hide UI" collapses the chrome while staying reachable).
- **Storage key bump** — `notelings-grid-editor-v2` (pre-lock-in painted deltas never re-apply).

---

## 5. 🟡 Documentation drift (recommend fixing before new features)

- **`UI_PROMPTS.md` is stale.** It still describes the original MotionSites UI — Inter/Outfit fonts, `TaskQueuePanel`, and the three original agent-card gradients. The shipped app is the **Bloom reskin**: Poppins / Source Serif 4, the Kanban replaced `TaskQueuePanel`, and the welcome/cards were rebuilt. Since AGENTS.md names `UI_PROMPTS.md` the "source of truth for the 2D overlay", it is actively misleading.
- **`MASTER_SPEC_FINAL.md` §3 is stale.** It still says the office is assembled from voxel `.obj` assets. The active office is now the **GLB** (`public/models/3D_Note_Office_2/3d_note_office.glb`, 10.1×10.1 m). The "3D Engine Overhaul" is listed in `PHASE_2_SPEC_FINAL_UPDATED.md` §4 as a **Phase-3 "do not build now"** item — but the user already pulled it forward and shipped it (2026-08-10). The roadmap text should note that.
- **`PHASE_2_SPEC_FINAL_UPDATED.md` is current** (M1–M4 marked complete, M5 next, plus the "Additional additions" section).

---

## 6. 🟢 Minor deviations (awareness only, not blockers)

- **Pathfinding "emergency reset"** (`MASTER_SPEC_FINAL.md` §6) says the stuck agent should "drop the note, teleport back to the Lounge, and reset to IDLE." The implementation instead does `failTask` → `error` (red glow + `X X` face) → auto-recover to `idle`. There is no "Lounge" in the GLB office and no teleport; the note is **dropped, not re-queued**. If note-loss on pathfinding failure matters, this is the one behavioral gap to close.
- **"No interactive clicks on 3D meshes"** (Phase 2 spec §2) is technically broken by the Nav Grid Editor's floor click/drag (`GridDebugOverlay`). It is a dev-only tool gated behind the hidden-by-default "Edit nav" toggle, so it does not affect the product surface.

---

## 7. ⚪ Optional housekeeping

- **Untracked file** — `2026-08-08 00-14-26.mp4` (user's screen recording). Add to `.gitignore` or remove.
- **Legacy dead code** — preserved as backup since the GLB swap: `VoxelOffice_Legacy.tsx`, `agentGrid.ts`, `officeLayout.ts`, `officeBuilder*`, `OfficeModel.tsx`, `Floor.tsx`, `GridDebugOverlay`'s old OBJ path. Safe to prune now that the GLB office is stable.
- **Orphaned localStorage key** — `notelings-grid-editor-v1` (superseded by `-v2`). Harmless.
- **Full e2e re-run** — only the 4 office-smoke specs were re-run this session; `librarian-chat.spec.ts` and `tag-explorer.spec.ts` (2 more) are unaffected but should be re-run before the commit for a fully clean baseline.

---

## 8. Validation status (current session)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 166/166 passed |
| `npm run lint` | 0 errors (160 baseline warnings) |
| `npx playwright test e2e/office-smoke.spec.ts` | 4/4 passed |
| Browser (Chrome) | toggles verified, no console errors |
| Dev server | HTTP 200 |

---

## 9. Next feature

The only un-built planned milestone is **Phase 2 · M5: the Knowledge Graph** (Obsidian-style note/tag network view, e.g. `react-force-graph-2d`, notes as nodes, shared-tag edges).

### Recommended order
1. Commit + push the current work (§4).
2. Refresh `UI_PROMPTS.md` and `MASTER_SPEC_FINAL.md` (§5).
3. Run the full e2e suite.
4. Write the M5 plan (per the repo's `writing-plans` discipline) and get approval.
