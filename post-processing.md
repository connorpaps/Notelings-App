> ⚠️ **STATUS — PARTIALLY OUTDATED (2026-08-12).** This documents the *legacy office* render profile. The active GLB office (swapped 2026-08-10) changed the framing:
> - Camera zoom **38 → 86** and target **`[0, 1.5, 0]` → `[0, 1, 0]`** (position `[24,22,24]`, near/far unchanged).
> - Robots render at **`ROBOT_VISUAL_SCALE = 0.72`** (was 0.8); the carried note card has its own `NOTE_SCALE = 0.9`.
> - The SSAO/Bloom/ToneMapping chain, 4096² shadows, DPR 1, and `frameloop="always"` below are unchanged and still correct.

# Office Post-Processing Configuration

**Current baseline:** Locked Milestone 1 high-quality single-scene rendering with final brightness polish, now hosting the Milestone 3 autonomous two-agent runtime

This document records the post-processing effects and related renderer settings currently applied to the Notelings 3D office.

## 1. EffectComposer

`OfficeCanvas` uses the following composer:

```tsx
<EffectComposer enableNormalPass>
  <SSAO {...SSAO_PROPS} />
  <Bloom luminanceThreshold={1.0} intensity={0.2} />
  <ToneMapping />
</EffectComposer>
```

### Configuration

- `enableNormalPass`: **enabled**
- Required by SSAO for scene normal/depth information
- Multisampling: **not explicitly configured**; the installed postprocessing library default is used
- Composer resolution scale: **not explicitly configured**; the installed postprocessing library default/full-resolution behavior is used

The composer does not currently include:

- Vignette
- Chromatic aberration
- Depth of field
- Motion blur
- Film grain

The composer now also includes a subtle Bloom pass:

- `luminanceThreshold: 1.0`
- `intensity: 0.2`

This is intended to add a restrained highlight glow without changing the office palette.

## 2. SSAO

Screen-space ambient occlusion is active with the following settings:

```ts
const SSAO_PROPS = {
  radius: 2.4,
  intensity: 2.0,
  samples: 32,
  rings: 4,
  bias: 0.3,
  luminanceInfluence: 0.65,
}
```

### Effect of each setting

- `radius: 2.4` — world-space reach of the occlusion effect; tuned for the office's voxel scale
- `intensity: 2.0` — strengthened contact darkening for corners and under-desk areas
- `samples: 32` — quality/sample count for the occlusion calculation
- `rings: 4` — sampling rings used by SSAO
- `bias: 0.3` — helps reduce self-occlusion and surface artifacts
- `luminanceInfluence: 0.65` — controls how strongly scene luminance influences the occlusion result

### Current behavior

- Full-resolution SSAO is active.
- No dynamic SSAO quality reduction is active.
- No adaptive SSAO resolution scaling is active.
- SSAO provides contact shading around furniture, walls, floors, and other nearby surfaces.

## 3. Tone Mapping

A postprocessing tone-mapping effect is active as the final composer effect:

```tsx
<ToneMapping />
```

The composer intentionally uses the installed wrapper default. An explicit ACES Filmic override was tested and reverted because it clipped the office's texture/material colors toward white with the current lighting and material pipeline.

Tone mapping compresses the rendered brightness range into a displayable range and affects the final contrast, highlights, and overall color appearance.

## 4. Renderer-Level Tone Mapping

The Canvas also requests ACES Filmic tone mapping at the Three.js renderer level:

```tsx
gl={{
  toneMapping: THREE.ACESFilmicToneMapping,
}}
```

When `EffectComposer` is active, it temporarily disables direct renderer tone mapping while rendering its offscreen target. Consequently, the final visible output is primarily controlled by the postprocessing `<ToneMapping />` effect and its installed default mode.

The renderer-level ACES setting remains explicitly configured as part of the Canvas baseline.

## 5. Related Rendering Settings

These are not post-processing effects, but they substantially influence the final office appearance.

### Shadows

- Canvas shadows: `"soft"`
- Directional shadow map: `4096 × 4096`
- Shadow radius: `4`
- Shadow bias: `-0.0002`
- Shadow normal bias: `0.02`
- Shadow camera bounds: `[-30, 30]` on left/right/top/bottom
- Shadow camera near plane: `1`
- Shadow camera far plane: `70`

### Lighting

- Ambient light:
  - Name: `office-ambient`
  - Intensity: `0.5`
  - Color: `#e3eeee`
- Directional key light:
  - Name: `office-key`
  - Position: `[10, 20, 10]`
  - Intensity: `3.0`
  - Color: `#fff8ed`
- Hemisphere fill:
  - Sky color: `#d8eeee`
  - Ground color: `#34504f`
  - Intensity: `0.32`

### Canvas and renderer

- Orthographic camera
- Camera position: `[24, 22, 24]`
- Camera zoom: `38`
- Camera near/far: `-100 / 300`
- Device pixel ratio: `dpr={1}` — caps the WebGL backbuffer at CSS resolution to avoid doubling all transparent canvas/composer pixel work on Retina displays while preserving scene geometry and lighting.
- Frameloop: `"always"` — autonomous Blue and Green agents wander and execute tasks continuously
- WebGL antialiasing: enabled
- Alpha channel: enabled (`gl.alpha: true`) so the static Skybridge frame shows through around the office.
- `preserveDrawingBuffer`: enabled
- WebGL power preference: `"high-performance"`
- Scene background: none; the WebGL canvas is transparent and the static Skybridge frame layer provides the page background.
- Renderer tone-mapping exposure: `1.2`
- Camera controls: **removed**; the office is a fixed static diorama
- Fixed camera position: `[24, 22, 24]`
- Fixed camera target: `[0, 1.5, 0]`
- Fixed camera zoom: `38`
- Fixed camera near/far: `-100 / 300`
- Always rendering: Milestone 3 intentionally keeps the R3F loop running because two autonomous agents can wander, preempt wandering for queued work, and complete tasks independently. The renderer now caps DPR at `1` to reduce Retina pixel cost; camera, lighting, shadows, and post-processing remain unchanged.
- Agent animation: `AgentRobot` owns per-frame Three.js position/path refs, while Zustand owns task intent and lifecycle. The shared Canvas is never toggled back to demand by an individual robot, so one agent cannot freeze another mid-route.
- Headless SwiftShader can deliver sparse frames. The robot's movement delta is capped at `0.5s` (normal 60fps frames are unchanged) so QA hitches still make bounded progress without changing the collision-safe A* / spline validation.

## 6. Current Effect Chain

```text
Office scene
  ↓
EffectComposer
  ↓
Normal pass
  ↓
SSAO
  - radius: 2.4
  - intensity: 2.0
  - samples: 32
  - rings: 4
  - bias: 0.3
  - luminanceInfluence: 0.65
  ↓
Bloom
  - luminanceThreshold: 1.0
  - intensity: 0.2
  ↓
ToneMapping
  - mode: installed `ToneMapping` default (no explicit mode override)
  ↓
Screen
```

## 7. Static Diorama and Performance Status

The office is now intended to be viewed as one fixed static diorama. Users cannot rotate, pan, or zoom the camera.

The current app does **not** include:

- A graphics-acceleration toggle
- Renderer-tier detection
- A separate software-rendering scene
- `PerformanceMonitor`
- Adaptive DPR logic
- Dynamic SSAO quality tiers
- Canvas remounting based on renderer capability
- The development builder in the default app path
- Builder localStorage hydration or writes in the default app path

The development builder remains in the codebase behind the source-controlled `ENABLE_OFFICE_BUILDER` flag, currently `false`, so it can be reactivated later without being mounted during normal static-diorama use.

This configuration is the restored pre-FPS visual baseline. Future performance experiments should preserve the scene composition and document any changes separately.
