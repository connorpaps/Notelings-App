# Notelings Performance Audit

**Audit date:** 2026-08-13  
**Scope:** Active GLB office, R3F render loop, Three.js renderer, shadows, post-processing, robots, Knowledge Graph, glass UI, and production assets.  
**Audit type:** Source inspection plus browser measurements. No application code was changed during this audit.

## Executive verdict

Notelings can hold approximately **60 FPS at DPR 1 on a capable desktop**, but the default render profile is too expensive for Retina laptops, integrated GPUs, phones, and battery-powered use.

The primary issue is not polygon count. It is the combination of:

1. A DPR range that allows 2× device pixel ratio.
2. Full-resolution SSAO/Bloom/ToneMapping passes.
3. Broad 4096² soft shadows with hundreds of shadow casters.
4. An always-running render loop even when the scene is visually idle.
5. Hundreds of separate GLB mesh/geometry submissions.

The Knowledge Graph is **not currently the highest-impact bottleneck** at the tested note count.

## First-pass implementation result — 2026-08-13

The first renderer pass was implemented and evaluated against the unchanged source baseline.

- The high desktop profile now caps WebGL at `dpr={1}`. At 1440×900 with device scale factor 2, the backbuffer changed from `2880×1800` to `1440×900` and headed FPS improved from approximately **35.6 to 80.9** in matched local samples. The DPR-1 sample stayed effectively flat (**78.6 → 78.8 FPS**, p95 **18.2 ms → 18.2 ms**), confirming that the improvement came from avoiding Retina pixel multiplication rather than changing scene work.
- The constrained-device balanced profile uses DPR 1, 2048² shadows over a ±14 cascade, and SSAO `16 / 2`, while preserving Bloom, exposure `1.2`, alpha compositing, camera, GLB, and robot/UI composition. A 390×844 / device scale 3 headed sample used a `390×844` backbuffer instead of the baseline `780×1688` and measured **115.8 FPS** versus **108.5 FPS** in the base high profile.
- High-profile renderer work remained approximately **2,127 calls and 371k triangles per frame**, with the same 717 meshes, 675 shadow casters, 703 geometries, and 52 runtime textures. This pass did not optimize GLB draw-call count.
- Fixed-state screenshot comparisons between high and balanced profiles showed low image deltas: approximately **0.63–0.88 mean absolute channel error** and **1.05–1.29% changed canvas pixels** for desktop delivery/idle and mobile idle captures; full-page mobile changed-pixel ratio was **2.17%**. Canvas transparency remained unchanged in all captures. No material visual regression was detected by the image comparison.
- Persistent comparison artifacts are stored locally under ignored `docs/.performance-artifacts/`; Playwright’s disposable `test-results/` directory is not used for cross-run baselines.

The first pass therefore retains the DPR cap and balanced profile. Idle rendering, shadow-caster classification, post-processing resolution experiments, GLB merging/instancing, and broad UI compositor tuning remain later measured phases.

---

## Measurement setup

Measurements were taken against the running local app at `http://localhost:3000` using headed Playwright Chromium on this Windows machine. The browser probe sampled:

- `requestAnimationFrame` frame pacing.
- Canvas CSS size and actual WebGL backbuffer size.
- Three.js renderer pixel ratio and memory counters.
- Scene mesh, geometry, material, texture, triangle, and shadow counts.
- Renderer-reported draw calls and submitted triangles.
- Office-only versus office-plus-Knowledge-Graph behavior.
- A temporary browser-only shadow-disabled comparison.

A separate forced-SwiftShader/headless pass was also run, but those numbers are treated as a software-rendering warning rather than a normal desktop FPS claim.

---

## Measured results

### DPR impact — confirmed highest-impact issue

The same 1440×900 viewport was measured at two device scale factors:

| Device scale factor | WebGL backbuffer | Measured FPS | p95 frame interval | Frames over 16.7 ms |
|---:|---:|---:|---:|---:|
| 1 | 1440×900 | ~60.3 FPS | ~16.8 ms | 29/181 |
| 2 | 2880×1800 | ~28.3 FPS | ~50 ms | 84/85 |

The pre-pass Canvas configuration was:

```tsx
dpr={[1, 2]}
```

The implemented high and balanced profiles now both use `dpr={1}`.

At DPR 2, the renderer processes approximately **four times as many pixels**. Those pixels are consumed not only by the base scene but also by transparent compositing, SSAO, Bloom, tone mapping, and UI overlap.

**Finding before the pass:** The comment in `components/office/OfficeCanvas.tsx` described a CSS-resolution cap, but the source permitted DPR 2. The renderer now enforces the cap through `components/office/renderProfile.ts`; the remaining profile/documentation contract is covered by unit and Playwright tests.

**Confidence:** Very high.

---

### Active scene complexity

The active GLB is approximately **18 MB** and produced these runtime counts:

| Metric | Measured value |
|---|---:|
| Scene objects | 1,238 |
| Meshes | 717 |
| Visible meshes | 714 |
| Unique geometries | 717 |
| Unique materials | 69 |
| Unique textures | 25 |
| Scene triangles | ~125,022 |
| Shadow casters | 675 |
| Shadow receivers | 152 |
| Renderer memory geometries | 703 |
| Renderer memory textures | 52 |

The triangle count is modest for a desktop 3D scene. The more concerning figures are the **717 mesh objects, 703 geometries, and 675 shadow casters**, because they create substantial draw-call and shadow-pass overhead.

**Finding:** Static office geometry is not merged or instanced aggressively. The office is mostly static but is submitted as hundreds of independent objects every frame.

**Confidence:** High.

---

### Shadow cost — large submitted-work reduction when disabled

Current shadow settings include:

```tsx
shadow-mapSize-width={4096}
shadow-mapSize-height={4096}
shadow-radius={4}
shadow-camera-left={-30}
shadow-camera-right={30}
shadow-camera-top={30}
shadow-camera-bottom={-30}
```

The office itself is approximately 10×10 world units, while the shadow camera covers a 60×60 world-unit area.

Over comparable three-second browser samples:

| Configuration | Renderer calls | Calls/frame | Submitted triangles | Triangles/frame |
|---|---:|---:|---:|---:|
| Shadows enabled | 384,082 | ~2,122 | 67.0M | ~370K |
| Shadows disabled | 236,350 | ~1,450 | 40.3M | ~247K |

Disabling shadows reduced renderer-reported submitted work by approximately **38–40%**. The short headed run was already close to the 60 FPS ceiling, so the frame-rate difference was noisy on this particular machine; this should not be interpreted as proof that shadows are the largest desktop FPS limiter. It does show that shadows are a major absolute workload and will be much more important on lower-tier hardware.

**Likely waste:** Almost every opaque GLB mesh casts shadows, including small/static details that do not materially improve the image. The shadow camera also allocates high resolution across a much larger area than the office needs.

**Confidence:** High for workload; medium for direct FPS impact on this desktop.

---

### Post-processing cost — high-risk full-screen pixel workload

The active chain is:

```tsx
<EffectComposer enableNormalPass>
  <SSAO samples={32} rings={4} />
  <Bloom />
  <ToneMapping />
</EffectComposer>
```

This performs multiple full-screen passes per frame:

1. Normal pass.
2. SSAO at full resolution with 32 samples and 4 rings.
3. Bloom processing.
4. Tone mapping.

At DPR 2, these passes operate over approximately 5.2 million pixels per frame rather than 1.3 million at DPR 1.

No isolated post-processing-off browser experiment was performed, so the exact contribution of SSAO versus Bloom versus tone mapping is not measured independently. However, the settings are clearly expensive and the DPR test confirms that the pixel pipeline is a dominant limiter.

**Confidence:** High that this is a major risk; medium for exact ranking among the individual effects.

---

### Always-on rendering — confirmed idle GPU/battery cost

The Canvas is configured with:

```tsx
frameloop="always"
```

The office continues rendering when:

- The camera is fixed.
- The graph is closed.
- No note is being delivered.
- No user interaction is occurring.
- The scene is visually unchanged.

Each robot also owns a `useFrame` subscription. The per-frame robot code is reasonably disciplined—it mutates Three.js refs and does not call React state setters—but the expensive office still renders continuously.

Idle agents additionally schedule autonomous wandering, so the app is not truly idle for long periods.

**Impact:** This is primarily a battery, thermal, and background-tab problem. It may not show as an FPS drop on a powerful desktop, but it causes unnecessary continuous GPU work.

**Confidence:** High.

---

### Knowledge Graph — currently not a top bottleneck

At 21 mocked active notes:

| State | Measured FPS |
|---|---:|
| Office only | ~60.3 FPS |
| Office + Knowledge Graph | ~60.3 FPS |

The graph uses a good architecture for its current scale:

- `warmupTicks={250}` for one-time layout preparation.
- `cooldownTicks={0}` to freeze the force simulation.
- Custom 2D canvas drawing.
- No continuous d3-force tick loop after warmup.

Opening the graph adds a 2D canvas and one bounded blur surface, but it did not measurably reduce FPS in the tested case.

**Future risk:** Graph data is still rebuilt from the full in-memory note map, and there is no explicit large-vault cap or aggregation strategy. Test again at 100, 500, and 1,000 notes before treating it as scale-safe.

**Confidence:** High for the current 21-note case; low for large vaults.

---

## Other performance observations

### Glass UI and browser compositor effects

The UI uses several expensive visual effects:

- `backdrop-filter: blur(50px)` on strong glass panels.
- `filter: blur(28px)` on glass halos.
- Animated conic-gradient glow rings.
- A large `.ambient-glow` layer with `mix-blend-mode: screen` and `will-change: transform`.
- Additional modal and graph blur surfaces.

These are not the measured WebGL bottleneck on the capable desktop, but they become more expensive at DPR 2 and on mobile GPUs. The persistent dock, board, and multiple agent cards mean this is not a single isolated blur.

**Confidence:** Medium; needs browser paint/compositor profiling for exact cost.

### Startup and deployment weight

| Asset | Approximate size | Runtime relevance |
|---|---:|---|
| Active GLB | 18 MB | High startup/decode cost; also affects scene object count |
| Static background JPG | 696 KB | Active first-visual asset |
| Historical background MP4 | 12 MB | Not loaded by current runtime; deployment weight only |

The 18 MB GLB is a load-time concern even though its 125k triangle count is not excessive. The unused 12 MB video should not affect current FPS, but it unnecessarily inflates the production asset surface.

The background is rendered through a raw `<img>` rather than an optimized Next image path, and ESLint already reports this. That is primarily an LCP/bandwidth issue, not a steady-state frame-rate issue.

---

## What is working well

- No React state setters occur inside `useFrame`.
- A* pathfinding runs at command boundaries rather than every frame.
- Robot movement mutates refs directly.
- The graph layout is frozen after warmup.
- No physics or collider engine is active.
- `preserveDrawingBuffer` is disabled during normal runs and enabled only for Playwright pixel tests.
- The 3D scene remains around 125k triangles, which is not excessive by itself.
- The active runtime uses a static background image instead of continuously decoding the historical video.

---

## Priority ranking

### P0 — Fix immediately

1. **Cap normal DPR at 1.** The current `[1,2]` range is the only issue directly measured to cut this machine from ~60 FPS to ~28 FPS.
2. **Establish explicit renderer quality tiers.** Do not use the same 4096-shadow/full-resolution SSAO profile on desktop, mobile, integrated, and software renderers.

### P1 — Highest-value render work

3. **Reduce shadow scope and casters.**
   - Test 1024/2048 shadow maps.
   - Shrink the shadow camera from ±30 to the actual office bounds.
   - Disable shadow casting for small/static props.
   - Keep shadows on the floor, major furniture, and robots where they affect readability.

4. **Reduce post-processing on lower tiers.**
   - Test SSAO around 8 samples / 2 rings.
   - Run SSAO/Bloom at half resolution where supported.
   - Disable Bloom or SSAO on software/mobile profiles.
   - Preserve the high-quality profile only for capable desktop GPUs.

5. **Stop rendering continuously when no visual animation is needed.**
   - Consider invalidation during robot movement only.
   - Avoid autonomous wandering when the app is backgrounded or when no visual demonstration is requested.
   - Ensure task transitions explicitly resume and pause rendering.

### P2 — Structural/scalability improvements

6. **Optimize the GLB.** Merge static geometry by material or optimize the export so the office does not require 717 mesh submissions.
7. **Define graph scale limits.** Add aggregation, pagination, or a large-vault mode before thousands of tags/notes are rendered.
8. **Remove unused production assets.** Archive or delete the historical 12 MB video if it is no longer part of any runtime path.
9. **Optimize the background image path.** Improve first-load image delivery and LCP independently from steady-state FPS.

---

## Recommended measurement budget before changing quality

Capture real measurements on at least:

- Capable desktop GPU.
- Integrated laptop GPU.
- Retina/DPR 2 laptop.
- iPhone-class mobile device.
- Android mid-tier device.
- Software/SwiftShader renderer.

Track:

- 95th-percentile frame time.
- Idle GPU/CPU usage.
- GPU memory.
- First usable capture time.
- GLB download/decode time.
- Battery/thermal behavior on mobile.
- Graph behavior at 100, 500, and 1,000 notes.

Suggested budgets:

- 60 FPS target on capable desktop at DPR 1.
- 30 FPS minimum on supported mobile tiers.
- No continuous GPU work while the app is hidden or fully idle.
- First usable capture control before the GLB finishes if the product permits it.

---

## Bottom line

The current app is impressive on a capable desktop, but the default renderer is not performance-safe across devices.

The highest-leverage order is:

> **Cap DPR → tier shadows/post-processing → stop idle rendering → reduce static draw calls → optimize startup assets.**

The Knowledge Graph should not be optimized before those areas. Its frozen-layout design is currently one of the better-performing parts of the app.
