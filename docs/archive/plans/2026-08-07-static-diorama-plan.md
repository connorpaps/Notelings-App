# Static Diorama Camera and Demand Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the office from a camera-orbitable scene into a permanently locked orthographic diorama while preserving the high-quality rendering baseline and ensuring demand-mode interactions still render correctly.

**Architecture:** Keep the existing Canvas-owned orthographic camera at the approved isometric position, target, and zoom, but remove `OrbitControls` and disable the development builder by default. The normal app path will mount only the static office Canvas and locked scene, avoiding builder provider state, panel DOM, TransformControls, selection wiring, and editable-scene objects. Keep one explicit feature flag/activation seam so the builder can be re-enabled later; when activated, its TransformControls will explicitly invalidate the R3F root during gizmo changes so direct Three.js mutations remain visible under `frameloop="demand"`. Production already renders the locked office scene and will share the same fixed camera.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber 9, Drei `TransformControls`, Three.js, `@react-three/postprocessing`, TypeScript, Vitest, Playwright.

## Global Constraints

- Do not add a graphics toggle, renderer-tier branch, `PerformanceMonitor`, adaptive DPR, or alternate scene.
- Keep `Canvas frameloop="demand"`.
- Preserve ACES Filmic renderer configuration and the existing `<EffectComposer enableNormalPass>` chain.
- Preserve `SSAO` at `samples={32}` and `rings={4}` with the current radius, intensity, bias, and luminance settings.
- Preserve the directional shadow map at `4096 × 4096`, native soft shadows, lighting, scene composition, assets, and builder persistence.
- Remove `<OrbitControls>` completely; users must not rotate, pan, or zoom the office camera.
- Keep browser resize support so the fixed camera remains centered and the orthographic projection updates with the Canvas dimensions.
- Do not change the database, dependencies, locked builder baseline, or asset IDs.
- Do not claim literal guaranteed 0% OS-level GPU usage; demand rendering should stop the render loop while idle, apart from browser/compositor work and non-R3F activity.

## Current Context and Decisions

- `components/office/OfficeCanvas.tsx` already uses `frameloop="demand"`, `dpr={[1, 2]}`, `shadows="soft"`, `THREE.ACESFilmicToneMapping`, 4096² shadows, and 32-sample/4-ring SSAO.
- The current camera is configured through the Canvas `camera` prop as an orthographic camera: position `[24, 22, 24]`, zoom `38`, near `-100`, far `300`; `onCreated` points it at `[0, 1.5, 0]`.
- `OrbitControls` is the only camera-motion mechanism and currently consumes `orbitEnabled` from `OfficeBuilderContext`.
- `OfficeBuilderScene` uses `TransformControls` for object editing. Gizmo drag mutates Three.js objects directly, so demand rendering needs an explicit `invalidate()` listener on the TransformControls `change` event.
- Scene asset loading and React state updates already trigger R3F updates through mounting/state changes; numeric builder edits should continue to use React state updates.

## User Decision

The user chose to hide and disable the development builder for now, while keeping it reactivatable later for office editing. The default static-diorama path must not mount builder-only runtime work or UI, so the inactive builder has no meaningful performance cost beyond any unavoidable build-time code inclusion.

Implementation consequence:

- Add one clearly named source-controlled feature flag, for example `ENABLE_OFFICE_BUILDER = false`, at the app composition boundary.
- When disabled, render the static Canvas/locked scene without `OfficeBuilderProvider`, `OfficeBuilderPanel`, builder localStorage hydration, editable builder items, selection callbacks, or TransformControls.
- Keep the builder files and activation path intact for later re-enabling; do not delete the builder or alter its storage schema.
- Keep the fixed-camera implementation compatible with builder activation, including explicit demand-mode invalidation for TransformControls.

---

### Task 1: Define the static app composition and enforce the fixed camera profile

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `components/office/VoxelOffice.tsx` if needed to ensure the disabled builder scene is never mounted
- Test: `e2e/office-smoke.spec.ts`
- Update: `post-processing.md`

**Interfaces:**
- Consumes: current Canvas camera configuration and scene metadata handles.
- Produces: one fixed orthographic camera with stable position, target, zoom, and no camera controls.

- [ ] Add `ENABLE_OFFICE_BUILDER = false` at the app composition boundary, and conditionally mount the provider/panel only when it is true. Avoid rendering a hidden provider or panel: disabled mode must not hydrate builder localStorage or mount editable items/TransformControls.
- [ ] Ensure the normal disabled-builder Canvas path does not call `useOfficeBuilder`; use a small optional interaction boundary or explicit no-op selection callbacks so the static scene can render without builder context.
- [ ] Extract named constants in `OfficeCanvas.tsx` for the approved camera profile:

```ts
const CAMERA_POSITION: [number, number, number] = [24, 22, 24]
const CAMERA_TARGET: [number, number, number] = [0, 1.5, 0]
const CAMERA_ZOOM = 38
const CAMERA_NEAR = -100
const CAMERA_FAR = 300
```

- [ ] Keep `orthographic` on `<Canvas>` and pass the constants through the existing `camera={{ ... }}` prop.
- [ ] Keep `camera.lookAt(...CAMERA_TARGET)` in `onCreated`; do not add a second camera that could compete with the Canvas default.
- [ ] Remove the `OrbitControls` import and JSX entirely.
- [ ] Remove `orbitEnabled` from the `useOfficeBuilder()` destructuring in `OfficeCanvas.tsx`; if the builder is disabled by default, do not make the static Canvas depend on the full builder context just to handle empty-space selection.
- [ ] Preserve the builder activation seam so re-enabling the feature later restores the existing editable workflow without changing the locked-scene data.
- [ ] Keep `onPointerMissed` for builder deselection; it is scene selection behavior, not camera movement.
- [ ] Add fixed-camera runtime metadata to the existing window test handle or a dedicated `__NOTELINGS_CAMERA_PROFILE__` object containing position, target, zoom, near, far, and `controls: false`.
- [ ] Preserve `frameloop="demand"`, `dpr={[1, 2]}`, shadows, ACES, 4096² shadows, and the existing EffectComposer/SSAO/ToneMapping chain without quality reductions.
- [ ] Update `post-processing.md` to state that the camera is now fixed and that demand rendering is used for idle sleeping and event-driven invalidation.

---

### Task 2: Remove obsolete orbit state and keep the dormant builder reactivatable

**Files:**
- Modify: `components/office/OfficeBuilderContext.tsx`
- Test: existing builder/unit tests if they cover context shape

**Interfaces:**
- Consumes: existing builder context actions and persistence behavior.
- Produces: a builder context with no camera-orbit state while retaining transform drag state and click suppression.

- [ ] Remove `orbitEnabled: boolean` and `setOrbitEnabled` from `BuilderContextValue`.
- [ ] Remove the `orbitEnabled` React state initialized to `true`.
- [ ] Remove `setOrbitEnabled` from the provider value and dependency list.
- [ ] Keep `setTransformDragging`, `clearSuppressedClick`, and `consumeSuppressedClick`; these protect selection around gizmo drag release when the dormant builder is reactivated.
- [ ] Do not change storage keys, hydration, malformed-storage handling, reset behavior, or the locked 60-item baseline.

---

### Task 3: Make TransformControls reliable under demand rendering

**Files:**
- Modify: `components/office/OfficeBuilderScene.tsx`
- Test: `e2e/office-smoke.spec.ts`

**Interfaces:**
- Consumes: selected object refs, TransformControls, `updateTransform`, and builder click suppression.
- Produces: visible, responsive gizmo movement while the Canvas is demand-rendered.

- [ ] Import `useThree` from `@react-three/fiber` alongside the existing `ThreeEvent` type import.
- [ ] In `BuilderTransformGizmo`, read `invalidate` using `const invalidate = useThree((state) => state.invalidate)`.
- [ ] Register a `change` event listener on the TransformControls event target that calls `invalidate()`.
- [ ] Keep the existing `dragging-changed` listener to update serialized transforms and click suppression, but remove `setOrbitEnabled(!event.value)` and the cleanup call that re-enables OrbitControls.
- [ ] Keep cleanup for both event listeners and `clearSuppressedClick()`.
- [ ] Ensure numeric transform edits still re-render through React state updates; do not add `useFrame` or a continuous loop.
- [ ] Add an e2e interaction check that selects a visible item, changes a transform through the panel or gizmo, and confirms the scene metadata/serialized builder transform changes while the camera profile remains unchanged.

Expected event shape:

```tsx
const invalidate = useThree((state) => state.invalidate)

useEffect(() => {
  const controls = controlsRef.current
  if (!controls) return

  const eventTarget = controls as unknown as {
    addEventListener: (type: string, listener: () => void) => void
    removeEventListener: (type: string, listener: () => void) => void
  }
  const onChange = () => invalidate()

  eventTarget.addEventListener('change', onChange)
  return () => eventTarget.removeEventListener('change', onChange)
}, [invalidate])
```

The final implementation may combine this with the existing `dragging-changed` effect, but both listeners must be removed during cleanup.

---

### Task 4: Update the runtime and browser contracts

**Files:**
- Modify: `e2e/office-smoke.spec.ts`
- Modify: `playwright.config.ts` only if test projects need naming/coverage updates
- Modify: `components/office/OfficeCanvas.tsx` only for test metadata

**Interfaces:**
- Consumes: runtime scene/camera/renderer handles and builder localStorage.
- Produces: regression coverage proving the camera is static and quality settings remain high.

- [ ] Assert the Canvas is visible and every approved builder item still mounts with at least one mesh.
- [ ] Assert the fixed camera profile:
  - position approximately `[24, 22, 24]`
  - target `[0, 1.5, 0]` or equivalent look direction
  - zoom `38`
  - near `-100`
  - far `300`
  - controls absent/disabled
- [ ] Assert the renderer remains configured with ACES tone mapping and the key light has:
  - shadows enabled
  - shadow map `[4096, 4096]`
  - shadow bounds `[-30, 30, 30, -30]`
- [ ] Assert the static Canvas contract through runtime metadata or source-level contract checks:
  - `frameloop: 'demand'`
  - no OrbitControls object mounted
  - postprocessing active
  - SSAO baseline remains 32 samples / 4 rings
- [ ] Keep persistence assertions for the v4 builder state and readable JSON mirror.
- [ ] Keep the zero console/page error gate. Standard Three.js deprecation warnings should not be treated as errors.
- [ ] Add a browser resize smoke action if practical: resize the viewport, verify the canvas remains visible, and verify the camera orientation/target does not change.
- [ ] Assert the builder is inactive by default: no builder panel, no editable builder scene marker, no TransformControls, and no new builder localStorage hydration/write caused by opening the static app.
- [ ] Keep a separate activation-path test or source-level assertion for the feature flag so future reactivation cannot silently break.

Avoid asserting literal GPU utilization or promising guaranteed 0% GPU usage; browser/compositor overhead is outside R3F's frameloop.

---

### Task 5: Update project memory and documentation

**Files:**
- Modify: `post-processing.md`
- Modify: `handoff.md`
- Modify: `knowledge.md`
- Modify: `docs/lessons-learned.md` only if a new demand/TransformControls issue is discovered

- [ ] State that the office is a locked static diorama with no user camera rotation, pan, or zoom.
- [ ] Record the fixed camera profile and that `frameloop="demand"` is intentional.
- [ ] Record that TransformControls uses explicit `invalidate()` events for demand-mode drag rendering.
- [ ] Preserve the note that demand rendering sleeps the R3F render loop while idle but does not guarantee literal zero total GPU usage at the browser/OS level.
- [ ] Record that the development builder is disabled by default and must be reactivated through the feature flag before object editing is available; once reactivated, editing is limited to the fixed camera view unless a separate editor-only camera workflow is later authorized.

---

### Task 6: Validate the implementation

**Files:**
- No additional source files; validate all modified files.

- [ ] Run TypeScript validation:

```bash
npx tsc --noEmit
```

- [ ] Run unit tests:

```bash
npm test
```

- [ ] Run lint and ensure there are zero application errors; existing skill-script warnings may remain:

```bash
npm run lint
```

- [ ] Run the production build:

```bash
npm run build
```

- [ ] Run the single Chromium smoke suite:

```bash
npm run test:e2e
```

- [ ] Run browser QA at the target 1440×900 viewport and confirm:
  - office is centered and fixed
  - drag/pan/zoom gestures do not alter the camera
  - the builder panel is absent and no builder runtime work is mounted by default
  - the first load renders the complete high-quality scene
  - idle demand mode does not continuously repaint
  - no browser/page errors occur

---

## Self-review

- **Spec coverage:** camera lock, removal of OrbitControls, fixed orthographic framing, demand rendering, 4096² shadows, ACES, 32/4 SSAO, demand invalidation for TransformControls, builder compatibility, runtime assertions, documentation, and validation are all covered.
- **Performance claim:** the plan treats demand rendering as “no continuous R3F render loop while idle,” not as a guaranteed literal 0% GPU reading.
- **Composition protection:** the plan does not alter model placement, lighting, shadows, postprocessing quality, asset IDs, persistence, or production/static scene composition.
- **Known tradeoff:** the builder is intentionally disabled by default, so future spatial edits require reactivating the feature flag first. Once reactivated, the fixed camera limits inspection of occluded/back-facing objects unless a separate editor-only camera workflow is later authorized.
- **Performance boundary:** disabled mode must not mount the builder provider, panel, editable scene, TransformControls, or localStorage hydration. This keeps the dormant editing feature from adding runtime work to the static diorama.
