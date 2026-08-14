# Performance First Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Notelings frame pacing, Retina/lower-tier behavior, and renderer resource use while preserving the approved GLB office composition, Bloom/liquid-glass identity, robot readability, and task-delivery behavior, then prove the result against the current renderer baseline with repeatable FPS and visual comparisons.

**Architecture:** Add a small, pure render-profile module that separates high-quality desktop settings from a conservative balanced profile. The default high profile keeps the current visual recipe while capping WebGL DPR at 1; constrained devices use a balanced profile with a smaller but tighter shadow map and cheaper SSAO. Add a local Playwright performance probe and deterministic runtime contracts so FPS, backbuffer size, renderer work, startup timing, and visual artifacts can be compared before and after the changes without putting flaky FPS assertions into normal CI.

**Tech Stack:** React 19, Next.js 16 App Router, React Three Fiber 9, Three.js 0.185, `@react-three/postprocessing`, Playwright, Vitest, TypeScript.

## Global Constraints

- Preserve the active GLB office at `public/models/3D_Note_Office_2/3d_note_office.glb`; do not re-open the legacy OBJ assembly or change navigation geometry.
- Preserve the approved camera `[24, 22, 24]`, target `[0, 1, 0]`, zoom `86`, transparent WebGL canvas, exposure `1.2`, Bloom look, robot scale/faces/note card, and UI composition unless a visual comparison proves a change is necessary.
- Keep `frameloop="always"` in this first pass; autonomous robot wandering and task delivery currently depend on it. Demand-rendering work is a later, separately measured phase.
- Do not change the Knowledge Graph, Supabase schema, authentication, AI behavior, or task/agent lifecycle in this performance pass.
- Do not install packages. Use the existing Playwright and Vitest dependencies.
- Do not edit generated `.next` output or manually edit `next-env.d.ts`; do not stage or modify the unrelated untracked `2026-08-08 00-14-26.mp4`.
- Preserve the existing `preserveDrawingBuffer` rule: disabled for normal runtime, enabled only by the Playwright web-server environment.
- Never add React state setters or pathfinding/curve construction to `useFrame`.
- Use `npm`, run E2E with a fresh server via `CI=1`, and run the full repository validation before declaring the pass complete.
- Treat the current `HEAD` (`e73d234`) plus its existing generated `next-env.d.ts` working-tree diff and unrelated MP4 as the comparison context; application edits must be isolated from those artifacts.

## Current Evidence and Decisions

- `PERFORMANCE_AUDIT_2026-08-13.md` measured approximately 60 FPS at device scale factor 1 and 28–29 FPS at device scale factor 2 at 1440×900. The source currently uses `dpr={[1, 2]}`, so the audit’s highest-confidence fix is still pending in this checkout.
- The active scene is approximately 18 MB, 717 meshes, 703 geometries, 125k triangles, 675 shadow casters, and 25 textures. Triangle count is not the first target; pixel count, post-processing, and shadow work are.
- Current renderer settings are `dpr={[1,2]}`, 4096² shadows over a ±30 cascade, SSAO `32 / 4`, Bloom, ToneMapping, and `frameloop="always"`.
- The old `post-processing.md` claims `dpr={1}` and contains stale legacy camera/preserve-buffer statements. It must be corrected only after the new runtime profile is verified.
- Current E2E already exposes scene, camera, renderer, and render-profile handles and asserts the high-quality baseline. Those contracts should be extended rather than replaced.
- The Knowledge Graph was approximately FPS-neutral at 21 notes and is explicitly out of scope for this pass.

---

## Task 1: Create a repeatable base measurement and visual-capture harness

**Files:**
- Create: `scripts/performance-probe.mjs`
- Create: `e2e/performance-renderer.spec.ts` (initially as a visual-capture-only spec; renderer assertions are added in Task 4)
- Modify: `playwright.config.ts` to include `performance-renderer.spec.ts` in the existing Chromium project
- Modify: `package.json` only if a short `perf:probe` script is useful; do not add a dependency.
- Test artifacts only: `docs/.performance-artifacts/` (ignored by `.gitignore`; never commit generated measurements or screenshots).

**Interfaces:**
- Consumes: `window.__NOTELINGS_SCENE__`, `window.__NOTELINGS_RENDERER__`, `window.__NOTELINGS_RENDER_PROFILE__`, the active canvas, and the current local dev server.
- Produces: JSON and PNG artifacts that can be run against the unchanged base and the changed app with identical viewport/device settings.

- [ ] **Step 1: Implement the probe CLI.**

  Support these exact options through `process.argv`: `--label <name>`, `--url <url>` defaulting to `http://localhost:3000`, `--device-scale-factor <1|2|3>` defaulting to `1`, `--viewport <width>x<height>` defaulting to `1440x900`, `--duration-ms <number>` defaulting to `5000`, and `--headed` to opt out of headless mode. Launch the existing Playwright Chromium with the same SwiftShader arguments as `playwright.config.ts` unless `--headed` is supplied without those arguments.

  After navigation, wait for the canvas and the `new-office-scene` mesh count above 100. Sample with `requestAnimationFrame` for the requested duration and return:

  ```ts
  {
    label: string
    viewport: { width: number; height: number; deviceScaleFactor: number }
    canvas: { cssWidth: number; cssHeight: number; width: number; height: number }
    renderer: {
      pixelRatio: number
      fps: number
      p95FrameMs: number
      framesOver16_7ms: number
      frameCount: number
      callsPerFrame: number
      trianglesPerFrame: number
      geometries: number
      textures: number
    }
    profile: unknown
    scene: { meshes: number; shadowCasters: number; triangles: number }
  }
  ```

  Capture one full-page screenshot and one canvas screenshot beside the JSON file. Use `docs/.performance-artifacts/<label>-full.png`, `docs/.performance-artifacts/<label>-canvas.png`, and `docs/.performance-artifacts/<label>.json`.

- [ ] **Step 2: Run the probe and visual capture against the unchanged base.**

  Run the same scenarios before source edits:

  ```bash
  node scripts/performance-probe.mjs --label base-dsf1 --device-scale-factor 1 --viewport 1440x900
  node scripts/performance-probe.mjs --label base-dsf2 --device-scale-factor 2 --viewport 1440x900
  node scripts/performance-probe.mjs --label base-mobile --device-scale-factor 3 --viewport 390x844
  PERF_LABEL=base CI=1 npx playwright test e2e/performance-renderer.spec.ts --workers=1
  ```

  The initial `performance-renderer.spec.ts` must capture the same three visual states later used after implementation: initialized idle desktop, mocked active note-delivery/processing desktop, and initialized mobile. Run headed measurements on this Windows machine where possible; retain the existing audit’s SwiftShader results as a warning, not as a desktop-performance claim. Record FPS, p95 frame time, backbuffer dimensions, renderer calls/triangles, GLB startup time, and any console/page errors.

- [ ] **Step 3: Define the visual comparison checklist before changing renderer settings.**

  Use the captured base screenshots as the visual reference. Review at 1440×900 and 390×844 for:

  - Skybridge background framing, scrims, and transparent canvas corners.
  - Office framing, floor placement, camera zoom, GLB texture color, and visible furniture.
  - Contact shadows under desks/walls, shadow edges, and SSAO depth in furniture pockets.
  - Bloom highlight restraint and overall exposure/contrast.
  - Robot body scale, LCD-face placement/readability, carried-note visibility, and error glow.
  - Glass-panel blur, glow ring, ambient glow, welcome gate, terminal dock, and board legibility.

  Do not accept a performance result that improves FPS by materially degrading any item in this list.

**Validation:** The probe must produce valid JSON, screenshots, no page errors, and a base artifact set before renderer code changes begin.

---

## Task 2: Add pure render profiles and capability resolution

**Files:**
- Create: `components/office/renderProfile.ts`
- Create: `components/office/renderProfile.test.ts`

**Interfaces:**
- Produces `OfficeRenderQuality`, `OfficeRenderProfile`, `OFFICE_RENDER_PROFILES`, `resolveOfficeRenderQuality`, and `getBrowserRenderCapabilities` for `OfficeCanvas` and tests.
- The profile object must contain the values needed by Canvas, the directional shadow light, EffectComposer, and the browser debug handle.

- [ ] **Step 1: Write unit tests for profile invariants and resolution.**

  Cover these exact cases:

  ```ts
  expect(OFFICE_RENDER_PROFILES.high.dpr).toBe(1)
  expect(OFFICE_RENDER_PROFILES.high.shadowMapSize).toEqual([4096, 4096])
  expect(OFFICE_RENDER_PROFILES.high.shadowCascade).toBe(30)
  expect(OFFICE_RENDER_PROFILES.high.ssao.samples).toBe(32)
  expect(OFFICE_RENDER_PROFILES.high.ssao.rings).toBe(4)

  expect(OFFICE_RENDER_PROFILES.balanced.dpr).toBe(1)
  expect(OFFICE_RENDER_PROFILES.balanced.shadowMapSize).toEqual([2048, 2048])
  expect(OFFICE_RENDER_PROFILES.balanced.shadowCascade).toBe(14)
  expect(OFFICE_RENDER_PROFILES.balanced.ssao.samples).toBe(16)
  expect(OFFICE_RENDER_PROFILES.balanced.ssao.rings).toBe(2)
  expect(OFFICE_RENDER_PROFILES.balanced.bloom).toEqual(OFFICE_RENDER_PROFILES.high.bloom)
  expect(OFFICE_RENDER_PROFILES.balanced.toneMappingExposure).toBe(1.2)
  ```

  Test resolver behavior for a forced `high` override, a forced `balanced` override, a desktop capability (`coarsePointer: false`, `hardwareConcurrency: 12`, `deviceMemory: 16`), and constrained capabilities (`coarsePointer: true`, `hardwareConcurrency: 4`, `deviceMemory: 4`). The desktop resolves to `high`; either coarse pointer, four-or-fewer logical cores, or four-or-fewer GiB reported device memory resolves to `balanced` when no override is supplied. Unknown/invalid overrides resolve through automatic capability selection.

- [ ] **Step 2: Implement the immutable profiles.**

  Keep the high profile visually identical to the current renderer except for the DPR cap:

  ```ts
  high = {
    quality: 'high',
    dpr: 1,
    shadows: true,
    shadowMapSize: [4096, 4096],
    shadowCascade: 30,
    ssao: { samples: 32, rings: 4, radius: 2.4, intensity: 2, bias: 0.3, luminanceInfluence: 0.65 },
    bloom: { luminanceThreshold: 1, intensity: 0.2 },
    toneMappingExposure: 1.2,
  }
  ```

  Use this balanced profile as the first constrained-device experiment:

  ```ts
  balanced = {
    quality: 'balanced',
    dpr: 1,
    shadows: true,
    shadowMapSize: [2048, 2048],
    shadowCascade: 14,
    ssao: { samples: 16, rings: 2, radius: 2.4, intensity: 2, bias: 0.3, luminanceInfluence: 0.65 },
    bloom: { luminanceThreshold: 1, intensity: 0.2 },
    toneMappingExposure: 1.2,
  }
  ```

  Do not disable shadows or Bloom in this pass. The balanced profile reduces pixel/shadow workload while preserving the visual language; a later experiment can measure disabling Bloom/SSAO independently.

- [ ] **Step 3: Implement capability resolution without introducing a render loop or package.**

  Read `matchMedia('(pointer: coarse)')`, `navigator.hardwareConcurrency`, and optional `navigator.deviceMemory` once when `OfficeCanvas` mounts. Support `NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=high|balanced|auto` as a local/test override, with `auto` as the default. Keep the resolver pure so it can be exhaustively unit-tested without a browser.

**Validation:** `npx vitest run components/office/renderProfile.test.ts` passes before the profile is wired into the scene.

---

## Task 3: Wire the selected profile into the R3F renderer

**Files:**
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `components/office/NewOfficeModel.tsx` only if the profile needs a clearly named shadow policy; do not change caster behavior in this pass.

**Interfaces:**
- Consumes: `getBrowserRenderCapabilities`, `resolveOfficeRenderQuality`, and `OFFICE_RENDER_PROFILES`.
- Produces: a runtime-selected Canvas profile and an expanded `window.__NOTELINGS_RENDER_PROFILE__` contract containing `quality`, `dpr`, `shadowMapSize`, `shadowCascade`, Bloom, SSAO, and exposure.

- [ ] **Step 1: Replace duplicated constants with the selected profile.**

  Keep camera constants and scene composition unchanged. Replace the current hard-coded renderer values as follows:

  ```tsx
  const [renderQuality] = useState(() => resolveOfficeRenderQuality(
    getBrowserRenderCapabilities(),
    process.env.NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY,
  ))
  const renderProfile = OFFICE_RENDER_PROFILES[renderQuality]
  ```

  Use `dpr={renderProfile.dpr}`, `shadows={renderProfile.shadows ? 'soft' : false}`, the profile shadow map size/cascade on `office-key`, and profile SSAO/Bloom values. Keep `EffectComposer enableNormalPass`, ToneMapping, `gl.alpha`, antialiasing, power preference, camera, lighting intensities, and renderer exposure unchanged.

- [ ] **Step 2: Preserve and extend runtime QA handles.**

  Keep `__NOTELINGS_SCENE__`, `__NOTELINGS_CAMERA__`, and `__NOTELINGS_RENDERER__`. Set `__NOTELINGS_RENDER_PROFILE__` to the selected profile plus the stable camera/frameloop fields already asserted by E2E. Add the selected `quality` and `dpr` so a browser measurement can prove which tier ran.

- [ ] **Step 3: Add a defensive comment documenting the quality boundary.**

  State that high quality is the approved desktop visual baseline, balanced quality is selected only for coarse-pointer/low-capability devices or an explicit local override, and both profiles cap WebGL DPR at 1 because the composer multiplies the pixel cost.

**Validation:** Run the focused office smoke after wiring. At desktop test capabilities it must still report high quality, DPR 1, 4096² shadows, ±30 cascade, SSAO 32/4, exposure 1.2, transparent corner alpha, and the existing camera/robot contracts.

---

## Task 4: Extend deterministic renderer and visual regression coverage

**Files:**
- Modify: `e2e/office-smoke.spec.ts`
- Modify: `e2e/performance-renderer.spec.ts` (add runtime profile assertions to the visual-capture spec created in Task 1)
- Modify: `playwright.config.ts` to pass through `NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY` for deterministic high/balanced fresh-server runs; add a mobile/coarse-pointer project only if the existing project cannot emulate it cleanly.

**Interfaces:**
- Consumes: runtime profile handles and the existing office scene contracts.
- Produces: deterministic protection against DPR regression and visual-quality regressions on desktop and constrained-device profiles.

- [ ] **Step 1: Update the desktop office smoke contract.**

  Keep all existing scene, camera, background, robot, transparency, and no-console-error assertions. Update the expected render profile to include `quality: 'high'`, `dpr: 1`, and the current high-quality settings. Assert `rendererPixelRatio === 1` at the existing 1440×900 context.

- [ ] **Step 2: Add a Retina/DPR-2 renderer test.**

  Use a dedicated Playwright context with `deviceScaleFactor: 2`, viewport 1440×900, and fine pointer. Load the office, wait for the GLB, then assert:

  - Selected quality is `high` for capable desktop capabilities.
  - Renderer pixel ratio is exactly `1`.
  - Canvas backbuffer width/height are no greater than CSS width/height.
  - Camera, exposure, transparency, GLB mesh count, and office texture/material contracts remain unchanged.

  This is the regression that the current DPR-1-only smoke cannot catch.

- [ ] **Step 3: Add a constrained-device profile test.**

  Run the focused spec once with `NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=high` and once with `NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=balanced` against fresh servers. Use a mobile/coarse-pointer context at 390×844 with device scale factor 3 for the balanced visual capture, and use the explicit override when Playwright’s emulation does not produce a reliable coarse pointer. Assert balanced quality, DPR 1, 2048² shadows, ±14 cascade, SSAO 16/2, unchanged Bloom/exposure, transparent canvas corners, and no page/console errors. The Playwright web-server environment must pass through the shell value rather than hard-code one tier.

- [ ] **Step 4: Add visual capture states without brittle FPS assertions.**

  Capture full-page and canvas screenshots in the same three states for base and changed builds:

  1. Initialized idle office at 1440×900.
  2. Active note-delivery/processing state using the existing mocked dispatch route.
  3. Mobile 390×844 initialized office with the UI visible.

  Use the same viewport, reduced-motion preference, server mode, wait conditions, and screenshot timing for both runs. Keep artifacts under `docs/.performance-artifacts/` and inspect them side by side. Do not use a loose pixel-diff threshold as the only visual gate because moving robots and browser text rasterization can hide meaningful shadow or color regressions.

**Validation:** Focused renderer E2E passes with a fresh server (`CI=1`) and records zero unexpected console/page errors. Existing delivery, degraded, archive, graph, and manual-capture flows remain covered by the normal suite.

---

## Task 5: Run the changed-versus-base performance evaluation

**Files:**
- No application files; produce ignored artifacts in `docs/.performance-artifacts/`.
- Modify `PERFORMANCE_AUDIT_2026-08-13.md` only after the comparison is complete, if the final numbers materially update its findings.

**Interfaces:**
- Consumes: base artifacts from Task 1, changed artifacts from the same probe and environments.
- Produces: an evidence-backed keep/revert decision for each first-pass setting.

- [ ] **Step 1: Re-run identical measurements against the changed app.**

  Run:

  Start fresh temporary servers for each forced profile so the client bundle receives the intended environment, then run:

  ```bash
  NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=high node scripts/performance-probe.mjs --label changed-high-dsf1 --device-scale-factor 1 --viewport 1440x900
  NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=high node scripts/performance-probe.mjs --label changed-high-dsf2 --device-scale-factor 2 --viewport 1440x900
  NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=balanced node scripts/performance-probe.mjs --label changed-balanced-mobile --device-scale-factor 3 --viewport 390x844
  PERF_LABEL=changed-high NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=high CI=1 npx playwright test e2e/performance-renderer.spec.ts --workers=1
  PERF_LABEL=changed-balanced NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=balanced CI=1 npx playwright test e2e/performance-renderer.spec.ts --workers=1
  ```

  Use the probe’s `--url` option to target each temporary port. Run both base and changed measurements with the same browser mode, warm-server procedure, duration, viewport, page state, and machine power/thermal state. Record median of at least three samples for each scenario rather than relying on one noisy run.

- [ ] **Step 2: Compare the renderer metrics.**

  Report absolute and percentage changes for:

  - FPS and p95 frame interval.
  - Frames over 16.7 ms.
  - WebGL backbuffer dimensions and pixel ratio.
  - Renderer calls/frame and triangles/frame.
  - Renderer geometry/texture memory counters.
  - Time from navigation to GLB scene readiness.
  - Console/page errors.

  The pass is successful only if the DPR-2 scenario no longer renders a 2× backbuffer and materially improves frame pacing, while the desktop DPR-1 scenario does not regress by more than 5% p95 frame time. The balanced profile must improve or maintain the constrained-device result; if it does not, keep the DPR cap and high profile but revert the balanced shadow/SSAO changes rather than retaining complexity without evidence.

- [ ] **Step 3: Compare visual artifacts before looking at the FPS result.**

  Review base/changed pairs at 100% zoom and as a contact sheet. Specifically inspect shadow coverage at all four office edges, contact shadows beneath large furniture, SSAO around desks and walls, texture colors, Bloom highlights, transparent corners, robot readability, and mobile UI legibility. A missing shadow, washed color, altered framing, clipped GLB asset, or materially weaker glass treatment is a visual regression even if FPS improves.

- [ ] **Step 4: Make the keep/revert decision per setting.**

  Keep `dpr=1` if it preserves the visual contract and improves the DPR-2 result. Keep the balanced 2048/±14/16/2 settings only if the constrained-device measurements improve and the visual checklist passes. Do not add shadow-caster classification, full demand rendering, GLB merging, or UI blur changes to this pass based on speculation.

**Validation:** A short comparison table and screenshot directory exist before the plan is marked complete. The result must identify which settings were retained, which were rejected, and why.

---

## Task 6: Run full validation and update documentation

**Files:**
- Modify: `post-processing.md`
- Modify: `PERFORMANCE_AUDIT_2026-08-13.md` with final measured results and remaining risks.
- Modify: `knowledge.md` with the final renderer-profile contract and commands.
- Modify: `handoff.md` immediately after the substantial change with a dated Work completed entry.
- Modify: `docs/lessons-learned.md` immediately if a regression, failed measurement, or renderer gotcha is discovered.

**Interfaces:**
- Consumes: accepted source changes and Task 5 comparison artifacts.
- Produces: synchronized source/docs/tests and a clean validation record.

- [ ] **Step 1: Correct renderer documentation from source of truth.**

  Document the actual active GLB camera values, high profile, balanced profile, DPR cap, `preserveDrawingBuffer` behavior, shadow bounds/map sizes, SSAO values, Bloom/ToneMapping, and the reason `frameloop="always"` remains in this pass. Remove stale legacy camera and preserve-buffer claims without rewriting unrelated historical notes.

- [ ] **Step 2: Run the repository gates.**

  ```bash
  npx tsc --noEmit
  npm test
  npm run lint
  npm run build
  CI=1 npm run test:e2e -- --workers=1
  ```

  Also run the focused renderer/profile tests and the performance probe comparison. Install no packages during this pass. Treat the repository’s known lint warnings and routine Three.js deprecation messages according to the existing baseline, but fail on new errors.

- [ ] **Step 3: Perform final manual browser comparison.**

  Open the changed app at 1440×900 and 390×844. Verify welcome/auth/demo entry, board/dock, note input, AI-off/manual capture, graph open/close, nav-grid toggle, robot delivery, archive flow, and error sentinel. Compare the final screenshot set to the base set and confirm that improved smoothness did not come from hiding UI or weakening the visual hierarchy.

- [ ] **Step 4: Record the final result and next measured phase.**

  Record the accepted metrics and visual result in the audit and handoff. The next phase may investigate idle rendering, shadow-caster classification, post-processing resolution, and GLB draw-call reduction only after this pass has a clean baseline. Do not begin those structural changes in the same review cycle.

**Validation:** All required gates pass, docs match source, the comparison artifacts are available locally, and the final handoff states whether FPS, p95 frame time, constrained-device behavior, and visuals improved or regressed.

---

## Acceptance Criteria

- The active office remains the same GLB scene with the same camera framing, color palette, transparent composite, robot scale/faces/note card, and UI composition.
- Device scale factor 2 no longer causes a 2× WebGL backbuffer; normal runtime DPR is capped at 1.
- Capable desktop uses the high profile and retains the existing high-quality shadow/SSAO/Bloom recipe.
- Constrained devices use the balanced profile only when capability resolution or an explicit override selects it.
- The changed app shows a measurable improvement in DPR-2 frame pacing and no more than a 5% p95 regression at DPR 1 on the same machine.
- Balanced settings improve or maintain the constrained-device result without missing shadows, washed colors, broken transparency, clipped assets, or reduced robot/UI readability.
- Existing unit, typecheck, lint, build, and fresh-server E2E gates remain green; no new console/page errors appear.
- The final audit contains before/after metrics and visual-review conclusions, not just source-level claims.
- Idle rendering, GLB merging/instancing, broad UI blur reduction, graph scaling, and unused-asset cleanup remain clearly tracked as later phases rather than unmeasured changes mixed into this one.
