# Milestone 3: The Brain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-robot Zustand task system in which autonomous idle robots wander safely, queued verification tasks are claimed atomically, and each assigned robot walks to a validated Whiteboard or Printer staging cell, works for two seconds, and returns to wandering.

**Architecture:** Zustand stores only durable intent and lifecycle (`taskQueue`, agent status, current task, target cell, and command revision); it must not receive per-frame Three.js positions or paths. A dispatcher hook atomically claims queued work for idle agents, while each `AgentRobot` owns its local A* path, Catmull-Rom curve/fallback motor, wander timer, and processing timeout. The existing static office remains the scene source of truth; two robot instances are mounted beside it, and a temporary client-side HTML overlay enqueues test tasks.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber 9, Three.js 0.185, Zustand 5.0.14, existing A* / transform-aware grid, Vitest, Playwright. No physics, colliders, animation rigs, Supabase, LLM, or new UI framework.

## Global Constraints

- Use **npm only**; promote the already transitively installed Zustand 5.0.14 to a direct `package.json` dependency and update `package-lock.json` with npm.
- The released app uses exactly **two robots**, `blue` and `green`; do not implement the specification's 3–4 robot cast.
- Permanently set `<Canvas frameloop="always">` for M3 autonomous motion. Remove per-robot `setFrameloop` switching; no robot may turn the shared Canvas back to `demand`.
- Preserve the M1 visual baseline exactly: camera position/target/zoom/near/far, lighting intensities/colors/positions, 4096² shadows and shadow camera, renderer tone mapping/exposure, SSAO, Bloom, ToneMapping, DPR, background, and post-processing chain. Only the frameloop value and its runtime metadata/test contract may change.
- Preserve the M2 transform-aware 36×28 grid, real OBJ footprint blocking, two cubicle access pockets, `createSafePathCurve` clearance validation, and orthogonal fallback. Never weaken obstacle clearance to force a curved task path.
- Do not store per-frame world position, rotation, curve points, or path arrays in Zustand. Those remain refs/local state inside `AgentRobot`.
- Idle wandering uses only in-bounds, unblocked, A*-reachable cells; random selection must be injectable/deterministic in unit tests.
- A task destination is a safe walkable **staging cell adjacent to a named asset**, not the asset's mesh center. The actual Whiteboard cell is elevated/blocked by scene context, and the Printer cell is occupied by the printer/table; routing directly into either mesh would violate M2 collision safety.
- The validated destination constants are Work Whiteboard 02 `[29, 4]` and Printer `[30, 13]` in the current locked-grid transform. The earlier Whiteboard `[19, 10]` target was the lounge-side Whiteboard 01 board; Whiteboard `[22, 10]` was also rejected during route audit because it overlapped the printer-table footprint after the cubicle-pocket exception was corrected. Keep destination constants centralized and test them against locked asset anchors and independent blockers.
- The temporary verification overlay follows `UI_PROMPTS.md`: root `absolute inset-0 z-10 pointer-events-none`; only the glass panel and its controls use `pointer-events-auto`.
- The grid-debug visualizer was a temporary M2 aid. M3 cleanup disables `ENABLE_GRID_DEBUG` and updates its focused test; path preview remains disabled.
- Apply `r3f-fundamentals`, `r3f-best-practices`, `vercel-react-best-practices`, `writing-plans`, and the repository memory protocol. If a real bug is found, use systematic debugging and immediately record the lesson.
- Validation gates: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Existing lint warnings in installed skill scripts are acceptable; new application errors are not.
- Do not commit or push during implementation unless the user separately requests it.

## What the original proposal gets wrong

1. **A task dispatcher cannot call one imperative robot ref and scale to two robots.** The current M2 `AgentLayer` has one ref and one blue robot. M3 needs a stable roster keyed by `blue`/`green`, with each robot reacting to its own store command revision.
2. **The shared Canvas cannot be toggled back to demand by one robot.** Two autonomous robots can overlap in time; one arriving must not freeze the other. The Canvas is therefore always-rendered for M3, and `AgentRobot` no longer owns frameloop policy.
3. **Idle wandering and task availability need separate concepts.** An idle robot may be physically moving through a wander path while remaining `status: 'idle'`, so a queued task can atomically preempt that wander. Task movement is `walking`; arrival is `processing`; completion returns to `idle`.
4. **The named asset centers are not valid navigation goals.** Whiteboard and Printer are elevated/occupied scene assets. The plan uses nearby, exact, tested staging cells and does not punch holes in obstacle rasterization.
5. **A random wanderer must not make E2E nondeterministic.** The random picker accepts an injected RNG, and browser tests target the explicit overlay destinations rather than waiting for random positions.
6. **The existing M2 click-to-move path is temporary verification behavior.** M3 replaces it with store-driven autonomous/task movement; the A* and smoothing engine remain, but the invisible click floor and one-robot imperative click seam are removed.

---

### Task 1: Promote Zustand and define the two-agent/grid contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (generated by npm)
- Modify: `components/office/agentGrid.ts`
- Modify: `components/office/officeMode.ts`
- Modify: `components/office/officeMode.test.ts`
- Create: `components/office/agentDestinations.ts`
- Create: `components/office/agentDestinations.test.ts`
- Modify: `components/office/agentGrid.test.ts`

**Interfaces:**
- Produces `AgentId = 'blue' | 'green'`.
- Produces `AGENT_START_CELLS: Record<AgentId, GridCell>` with blue `[6, 12]` and green resolved deterministically to `[4, 12]` using the same effective blocked set; both must be free and reachable from blue's dominant region.
- Produces destination config:

```ts
export type TaskDestination = 'whiteboard' | 'printer'
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  whiteboard: [29, 4],
  printer: [30, 13],
}
export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: 'Work Whiteboard',
  printer: 'Printer',
}
```

- Keeps the existing `AGENT_START_CELL` export as an alias for blue for compatibility with current grid tests and QA.
- Sets `ENABLE_GRID_DEBUG = false`; leaves `ENABLE_PATH_PREVIEW = false` and `ENABLE_OFFICE_BUILDER = false`.

- [ ] **Step 1: Write failing destination and spawn tests.**

```ts
it('keeps both robot starts free and connected', () => {
  const blocked = buildAgentBlockedCells()
  expect(blocked.has('6,12')).toBe(false)
  expect(blocked.has('4,12')).toBe(false)
  expect(findPath([6,12], [4,12], { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
})

it('keeps task goals exact, free, in bounds, and reachable', () => {
  const blocked = buildAgentBlockedCells()
  for (const goal of Object.values(TASK_DESTINATIONS)) {
    expect(blocked.has(`${goal[0]},${goal[1]}`)).toBe(false)
    expect(findPath([6,12], goal, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
  }
})
```

Also assert the Work Whiteboard 02 anchor maps to `[29,3]`, the Printer anchor maps to `[28,12]`, and each selected staging cell is within a small explicit distance of its anchor. This prevents a future locked-scene export from silently making the labels point to unrelated floor.

- [ ] **Step 2: Run the focused tests and confirm the new contract fails or is absent.**

Run:

```bash
npx vitest run components/office/agentGrid.test.ts components/office/agentDestinations.test.ts
```

Expected: the new module/constants are not yet available or the new assertions fail.

- [ ] **Step 3: Promote the existing transitive Zustand version directly.**

Run:

```bash
npm install zustand@5.0.14
```

Do not install a second state library or add a testing-only store dependency.

- [ ] **Step 4: Add deterministic starts, destination constants, and disable the completed M2 debug overlay.**

Use `buildAgentBlockedCells()`, `findFreeCell([4, 12], blocked, ...)`, and explicit assertions/tests rather than duplicating obstacle math. Keep all M2 grid dimensions and transforms unchanged.

- [ ] **Step 5: Run focused tests and typecheck.**

```bash
npx vitest run components/office/agentGrid.test.ts components/office/agentDestinations.test.ts components/office/officeMode.test.ts
npx tsc --noEmit
```

Expected: pass, with the two starts and both destination staging cells validated against the actual locked scene.

- [ ] **Step 6: Commit the dependency/grid contract only if the user chooses execution.**

```bash
git add package.json package-lock.json components/office/agentGrid.ts components/office/agentGrid.test.ts components/office/officeMode.ts components/office/officeMode.test.ts components/office/agentDestinations.ts components/office/agentDestinations.test.ts
git commit -m "feat: define two-agent M3 destinations and starts"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 2: Build the atomic Zustand brain

**Files:**
- Create: `components/office/agentStore.ts`
- Create: `components/office/agentStore.test.ts`

**Interfaces:**

```ts
import type { AgentState } from './agentState'
import type { AgentId, TaskDestination } from './agentDestinations'
import type { GridCell } from './pathfinding'

export type Task = {
  id: string
  destination: TaskDestination
  createdAt: number
}

type AgentCommandKind = 'task' | 'wander' | null
export type AgentRecord = {
  id: AgentId
  color: string
  status: AgentState
  currentTask: Task | null
  target: GridCell | null
  targetKind: AgentCommandKind
  commandRevision: number
}

export type AgentStore = {
  taskQueue: Task[]
  agents: Record<AgentId, AgentRecord>
  enqueueTask: (destination: TaskDestination) => string
  dispatchAvailableTasks: () => void
  requestWander: (agentId: AgentId, target: GridCell) => boolean
  arriveAtTask: (agentId: AgentId) => boolean
  completeTask: (agentId: AgentId) => boolean
  failTask: (agentId: AgentId) => boolean
  finishWander: (agentId: AgentId) => boolean
  resetForTests: () => void
}
```

State semantics are explicit:

- `idle + currentTask=null`: eligible for dispatch and may be physically wandering.
- `walking + currentTask!=null + targetKind='task'`: task route, `O O` face.
- `processing + currentTask!=null + target=null`: arrived at the named destination and waiting two seconds, `- -` face.
- `idle` after `completeTask`: task cleared; the robot's idle effect schedules wandering again.
- `wander` commands leave `status='idle'`, allowing a queued task to preempt the local wander path.
- Every accepted command increments `commandRevision`, so the same grid cell can be requested again without relying on object identity.
- `dispatchAvailableTasks` performs one synchronous Zustand `set` that repeatedly pairs queue entries with `blue`, then `green`, when they are idle and unassigned. It must not mutate state when no assignment is possible.
- `arriveAtTask`, `completeTask`, `failTask`, and `finishWander` verify the expected current phase before changing state, making stale timers and StrictMode effect replays harmless.
- `failTask` changes the agent to `error`, clears its target, and schedules/permits a controlled reset to idle; no task remains stuck in the queue.

- [ ] **Step 1: Write store transition tests before implementation.** Cover:
  - initial two-agent roster and empty queue;
  - enqueueing preserves FIFO order and returns unique IDs;
  - one task claims blue first, two tasks claim blue and green, and a third remains queued;
  - a wandering idle agent is still eligible and task assignment replaces its wander command;
  - destination arrival changes walking → processing without clearing the task;
  - completion changes processing → idle and clears the task;
  - stale completion/arrival calls return `false` and do not corrupt newer work;
  - a failed task enters error and cannot block subsequent dispatch.

- [ ] **Step 2: Run the store tests and confirm failure.**

```bash
npx vitest run components/office/agentStore.test.ts
```

- [ ] **Step 3: Implement the store with `create<AgentStore>()`.** Keep task IDs deterministic enough for tests (`task-1`, `task-2`, …) while including `createdAt: Date.now()` for runtime inspection. Do not use per-frame position updates or asynchronous dispatch inside the store.

- [ ] **Step 4: Run the store tests and typecheck.**

```bash
npx vitest run components/office/agentStore.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit the store.**

```bash
git add components/office/agentStore.ts components/office/agentStore.test.ts
git commit -m "feat: add atomic Zustand task queue and agent lifecycle"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 3: Add the dispatcher hook and deterministic wander picker

**Files:**
- Create: `components/office/useTaskDispatcher.ts`
- Create: `components/office/agentWandering.ts`
- Create: `components/office/agentWandering.test.ts`

**Interfaces:**

```ts
export function useTaskDispatcher(): void

export function pickWanderCell(
  current: GridCell,
  blocked: BlockedSet,
  options: {
    cols: number
    rows: number
    random?: () => number
    attempts?: number
  },
): GridCell | null
```

`useTaskDispatcher` selects only `taskQueue.length`, the two agent statuses, and whether each has a current task. An effect calls `dispatchAvailableTasks()` when those values change and once on mount. It must not use a broad subscription that recursively updates on its own no-op dispatch.

`pickWanderCell` samples valid cells, rejects the current cell and blocked/out-of-bounds cells, and verifies `findPath(current, candidate, ...)` before returning. If injected randomness repeatedly chooses invalid cells, it falls back to a deterministic scan of free cells; it returns `null` only when no reachable alternative exists.

- [ ] **Step 1: Write deterministic wander tests.** Cover blocked/current rejection, bounds, reachability, injected random index selection, deterministic fallback, and fully blocked/no-alternative behavior.
- [ ] **Step 2: Run focused tests and confirm the new modules fail.**

```bash
npx vitest run components/office/agentWandering.test.ts
```

- [ ] **Step 3: Implement the picker and hook.** Keep the hook free of direct robot refs; its only responsibility is assigning queued task intent through the atomic store.
- [ ] **Step 4: Run focused tests, all unit tests, and typecheck.**

```bash
npx vitest run components/office/agentWandering.test.ts components/office/agentStore.test.ts
npm test
npx tsc --noEmit
```

- [ ] **Step 5: Commit the dispatcher and picker.**

```bash
git add components/office/useTaskDispatcher.ts components/office/agentWandering.ts components/office/agentWandering.test.ts
git commit -m "feat: dispatch queued tasks and choose reachable wander cells"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 4: Convert `AgentRobot` into a store-controlled autonomous motor

**Files:**
- Modify: `components/office/AgentRobot.tsx`
- Modify: `components/office/agentState.test.ts` only if a new color/state contract needs coverage

**Interfaces:**

```tsx
<AgentRobot
  agentId="blue"
  start={AGENT_START_CELLS.blue}
  blocked={effectiveBlocked}
  grid={AGENT_GRID_TRANSFORM}
  color="#2fa8e0"
  name="agent-robot-blue"
/>
```

Behavior:

- Read only this robot's `status`, `target`, `targetKind`, `commandRevision`, and current task from the store.
- Remove the old one-robot imperative `moveTo`/`forwardRef` click seam and its `setFrameloop` calls. The robot reacts to a changed `commandRevision`, computes its local A* path from its current world position, and uses the existing safe Catmull-Rom curve or orthogonal fallback.
- A changed task command immediately clears any active wander path and routes to the task target. A changed wander command starts a wander route while the store status stays idle, so tasks can preempt it.
- Use `useFrame` only for lightweight position/rotation mutation and terminal arrival detection. Do not write every frame to React or Zustand. At task arrival, make one terminal store transition to `processing`; at wander arrival, make one terminal transition to clear the wander target.
- While `processing`, set a local two-second timeout (cleared on command changes and unmount) that calls `completeTask(agentId)`. The robot remains at the destination during that wait and displays `- -`.
- If path computation fails, call `failTask(agentId)` rather than leaving the agent walking forever.
- When idle with no target, schedule the next wander after a slow delay (for example 1.5–3.5 seconds), call `pickWanderCell` using the current cell and a random source, and issue `requestWander`. Clear that timer whenever a task command arrives.
- Keep the corrected physical geometry exactly: body y/overlap values and face plane `position.z === 0.55`; only add `color`/`agentId` props and store-driven behavior. Do not alter face layout, lighting, camera, or imported assets.
- Keep the face texture derived from the store's four-state value: idle `^ ^`, task walking `O O`, processing `- -`, and error `X X`.
- Keep robot-rigidbody collision out of scope; two robots may pass through each other, while both use the same static blocked set.

- [ ] **Step 1: Write/adjust a focused motor contract test or test seam.** Assert that task destination/path failure is reported and that the existing M2 curve helper remains the path source; unit-test pure transition behavior in the store rather than attempting to unit-test R3F's render loop.
- [ ] **Step 2: Implement store-controlled props, local motor refs, wander timer, processing timeout, and two-second task lifecycle.** Preserve constants and safe fallback from the current M2 implementation.
- [ ] **Step 3: Run typecheck, path/store tests, and lint.**

```bash
npx tsc --noEmit
npx vitest run components/office/pathfinding.test.ts components/office/agentStore.test.ts components/office/agentGrid.test.ts
npm run lint
```

- [ ] **Step 4: Commit the robot motor conversion.**

```bash
git add components/office/AgentRobot.tsx components/office/agentState.test.ts
 git commit -m "feat: make robots autonomous and task-driven"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 5: Mount the two-robot layer and permanent always-render contract

**Files:**
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `components/office/AgentLayer.tsx`
- Modify: `components/office/VoxelOffice.tsx` only if the static branch mount changes
- Modify: `e2e/office-smoke.spec.ts`

**Interfaces:**

`AgentLayer` becomes the stable roster host:

```tsx
useTaskDispatcher()

<AgentRobot agentId="blue" start={AGENT_START_CELLS.blue} ... />
<AgentRobot agentId="green" start={AGENT_START_CELLS.green} ... />
```

It retains the transform-aware `effectiveBlocked` memo and optional runtime QA handle, but removes the one-robot click floor, `AgentRobotHandle`, and M2 path preview wiring. It must expose a low-frequency browser contract such as:

```ts
type RuntimeAgent = {
  id: AgentId
  status: AgentState
  currentTask: Task | null
  target: GridCell | null
}
window.__NOTELINGS_AGENTS__ = {
  taskQueueLength: number
  agents: Record<AgentId, RuntimeAgent>
}
```

Update `OfficeCanvas` only as follows:

- `OFFICE_RENDER_PROFILE.frameloop` becomes `'always'`.
- Canvas `frameloop` becomes `"always"`.
- Camera profile metadata's frameloop type/value becomes `'always'`.
- Every other prop, constant, light, shadow, camera, renderer, composer, and postprocessing setting remains byte-for-byte equivalent.

- [ ] **Step 1: Extend/adjust the E2E runtime contract tests before implementation.** Assert exactly two named robots, distinct valid start cells, always frameloop, unchanged camera/light/shadow/postprocessing values, no grid-debug group, and zero builder scene.
- [ ] **Step 2: Implement the two-robot `AgentLayer` and permanent Canvas setting.** Keep `VoxelOffice`'s static/builder branching unchanged unless needed to pass the new layer props.
- [ ] **Step 3: Run the existing static E2E test and focused unit tests.**

```bash
npx vitest run components/office/agentGrid.test.ts components/office/officeMode.test.ts
npm run test:e2e -- --grep "static office"
```

- [ ] **Step 4: Commit the scene/Canvas integration.**

```bash
git add components/office/OfficeCanvas.tsx components/office/AgentLayer.tsx components/office/VoxelOffice.tsx e2e/office-smoke.spec.ts
git commit -m "feat: mount two autonomous office robots with always-on rendering"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 6: Add the temporary verification overlay

**Files:**
- Create: `components/office/Milestone3VerificationOverlay.tsx`
- Modify: `app/page.tsx`

**Interfaces:**

```tsx
export default function Milestone3VerificationOverlay(): JSX.Element | null
```

The component is client-only and development-only. It renders a compact glass card with:

- `Send to Whiteboard` button → `enqueueTask('whiteboard')`.
- `Send to Printer` button → `enqueueTask('printer')`.
- queue count and each robot's status/current task for visual verification;
- disabled styling only when the action is unavailable, never hiding queued work;
- accessible button names, focus-visible outlines, hover/pressed states, and a small live status region.

Use a root overlay that cannot swallow canvas clicks, even though the M2 floor click path has been removed:

```tsx
<div className="absolute inset-0 z-10 pointer-events-none">
  <section className="pointer-events-auto ..." aria-label="Milestone 3 task controls">
    {/* buttons and status */}
  </section>
</div>
```

Place it above `OfficeCanvas` in `app/page.tsx` while keeping the full-screen canvas and builder branch behavior intact. Do not add Framer Motion or a new UI package for a temporary two-button verification tool.

- [ ] **Step 1: Implement the overlay and page composition.** Keep overlay absent in production by checking `process.env.NODE_ENV !== 'production'` in the client component.
- [ ] **Step 2: Run lint/typecheck and inspect the accessible DOM.**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 3: Commit the verification controls.**

```bash
git add components/office/Milestone3VerificationOverlay.tsx app/page.tsx
git commit -m "feat: add temporary Milestone 3 task verification controls"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 7: Replace M2 click-to-move E2E with M3 queue/task lifecycle coverage

**Files:**
- Modify: `e2e/office-smoke.spec.ts`
- Optionally modify: `components/office/agentDestinations.test.ts` if browser/runtime assumptions reveal a destination mismatch

**Interfaces:**

The new Playwright test must prove the actual M3 loop, not random wandering timing:

1. Load `/`, wait for canvas and `window.__NOTELINGS_AGENTS__`.
2. Assert two robot groups/meshes exist, both start idle, and the runtime reports an empty queue.
3. Click `Send to Whiteboard`, assert one task is queued/claimed and one agent has `currentTask.destination === 'whiteboard'` with status `walking`.
4. Click `Send to Printer` before the first task finishes, assert the other idle agent claims it; do not require dynamic robot collision avoidance.
5. Observe both assignments route toward their exact destination staging cells, then enter `processing` for at least the configured two-second work interval.
6. Wait for both agents to return to idle with `currentTask === null`, task queue length zero, and scene positions within the destination tolerance at the completion moment.
7. Assert the overlay remains keyboard-accessible and buttons have the exact requested names.
8. Capture console/page errors and require `[]`.

Use a 60–90 second test timeout because the validated Printer route is 48 grid nodes at the existing safe movement speed. Do not assert random wander positions; add a short separate smoke assertion that an idle agent eventually changes cell from its start after the configured wander delay.

- [ ] **Step 1: Write the new failing E2E assertions against the intended runtime contract.** Remove the old click-to-move projection/click helper and the obsolete one-robot face-walk assumptions.
- [ ] **Step 2: Implement any missing runtime metadata or test waits.** Prefer condition-based Playwright waits on status/task/position, never fixed sleeps except the explicit two-second processing assertion window.
- [ ] **Step 3: Run the M3 E2E test locally.**

```bash
npm run test:e2e -- --grep "task queue|Milestone 3"
```

- [ ] **Step 4: Commit the E2E coverage.**

```bash
git add e2e/office-smoke.spec.ts
 git commit -m "test: cover two-agent task dispatch and completion"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

---

### Task 8: Documentation, memory update, review, and complete validation

**Files:**
- Modify: `post-processing.md`
- Modify: `handoff.md`
- Modify: `knowledge.md`
- Modify: `docs/lessons-learned.md` only when execution discovers a real issue
- Review all M3 source/test files with `code-reviewer-luna`

**Documentation content:**

- `post-processing.md`: replace the M2 conditional frameloop note with the M3 contract: autonomous agents require Canvas `frameloop="always"`; this is intentional and does not alter camera, lighting, shadows, or postprocessing.
- `handoff.md`: record the two-agent roster, atomic Zustand queue, dispatcher hook, idle wander semantics, validated Whiteboard/Printer staging cells, two-second processing, temporary overlay, always frameloop, validation results, and next step M4 UI/LLM/Supabase.
- `knowledge.md`: add the store interfaces and the critical rule that Zustand owns intent/lifecycle while R3F refs own per-frame motion; document that an idle wander can be preempted because wander leaves status idle; note that dynamic robot collisions remain out of scope.
- If any error is fixed (especially stale click-to-move E2E assumptions, task race, timer cleanup, or Canvas render-loop behavior), immediately add a structured lesson with Symptom / Root cause / Fix / Avoid in future / Status before proceeding.

- [ ] **Step 1: Run final review after implementation.** Spawn `code-reviewer-luna` to inspect task races, StrictMode behavior, stale timers, target validity, exact two-robot scope, no per-frame Zustand updates, and preservation of M1 rendering settings.
- [ ] **Step 2: Fix review findings and rerun affected tests.**
- [ ] **Step 3: Run all validation gates in parallel where independent.**

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run test:e2e
```

- [ ] **Step 4: Perform browser QA with `npm run dev`.** Verify both robots visibly wander with `^ ^`, each button interrupts an idle wanderer, task movement shows `O O`, destination wait shows `- -`, completion returns to `^ ^`, the camera/lighting/postprocessing remain unchanged, and there are no browser errors.
- [ ] **Step 5: Update memory files immediately after the substantial change.**
- [ ] **Step 6: Leave the work uncommitted/unpushed unless the user explicitly asks for commit/push.**

---

## Self-review

### Spec coverage
- Zustand task queue and two-agent roster: Tasks 1–2.
- Dispatcher hook that claims idle agents: Task 3.
- Idle random wandering over valid A* cells: Tasks 3–4.
- Task-specific Whiteboard/Printer routing: Tasks 1, 4, and 7.
- Two-second destination work phase and idle reset: Tasks 2, 4, and 7.
- Temporary HTML verification buttons: Task 6.
- Permanent `frameloop="always"` without M1 visual-setting changes: Task 5 and its E2E contract.
- Smooth M2 pathing retained with collision-safe fallback: Task 4.
- Exactly two robots: Tasks 1, 5, and 7.

### Deliberate non-goals

- No notes/LLM/Supabase integration; that is Milestone 4.
- No authentication, physics, robot-robot collision system, rigged animation, WebSockets, or dynamic obstacle mutation.
- No full glassmorphism product UI; the overlay is temporary QA tooling and follows the overlay pointer-event contract.
- No per-frame Zustand position synchronization.
- No weakening of obstacle maps or spline clearance for destination convenience.

### Plan consistency checks

- `AgentId`, `TaskDestination`, `GridCell`, `AgentState`, `AgentRecord`, `Task`, and `AgentStore` are defined once and reused by later tasks.
- Store commands are revisioned, so repeated same-cell commands are observable.
- `status='idle'` during wander is intentional and documented; only task walking uses `walking`.
- Destination constants are exact and tested against the actual current locked-scene anchors.
- Frameloop metadata changes from `demand` to `always` everywhere it is asserted, while all visual settings remain unchanged.
- Existing M2 safe pathing remains the motor implementation; no task-specific alternate collision logic is introduced.

**Plan complete and saved to `docs/superpowers/plans/2026-08-08-milestone-3-brain.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review checkpoints.

**2. Inline Execution** — execute tasks in this session using executing-plans with batch checkpoints.

No feature code has been modified by this planning pass; only this plan document is new.
