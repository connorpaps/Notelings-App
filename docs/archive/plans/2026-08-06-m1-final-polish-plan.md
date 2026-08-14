# Milestone 1 Final Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve the remaining Milestone 1 presentation issues—camera-facing dollhouse cutaway, reliable OBJ/MTL color rendering, brighter office lighting, and final lounge/TV orientation—before starting Milestone 2.

**Architecture:** Keep the current data-driven `officeLayout.ts` as the source of truth. Keep model loading isolated in `OfficeModel`, scene lighting in `OfficeCanvas`, floor appearance in `Floor`, and wall geometry generation in `Walls`. Make the camera cutaway explicit in the wall configuration rather than hiding arbitrary meshes at render time, and make runtime material/texture state observable through the existing scene handle and e2e audit.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber 9, Three.js 0.185, Drei, `three-stdlib` MTL/OBJ loaders, Vitest, Playwright.

## Global Constraints

- Do not begin Milestone 2 agents, navigation, Zustand, A*, or task queue work.
- Do not replace the OBJ/MTL asset pipeline with JSX geometry or GLTF conversion.
- Preserve per-placement cloning; never reparent a cached `useLoader` result.
- Keep the project on npm and do not add physics, animation, or unrelated UI.
- Do not commit secrets or modify database/schema files.
- Use `docs/references/preview.png` as the visual authority for the camera-facing cutaway and TV wall.

## Audit Findings

- `components/office/officeLayout.ts` currently defines five wall segments, including both camera-facing boundary runs. The camera is at positive X/positive Z, so the cutaway must remove the positive-X and positive-Z exterior segments after confirming the projected side in the browser; the two remaining boundary walls and doorway must stay intact.
- `components/office/OfficeModel.tsx` already calls `MTLLoader`, `materials.preload()`, `OBJLoader`, and `loader.setMaterials(materials)`, and clones the loaded object. However, the requested visual symptom means source inspection alone is insufficient. The implementation must use an explicit `three-stdlib` import, verify every loaded mesh has a texture-backed material at runtime, and make the e2e test fail if the material pipeline silently falls back to an untextured default.
- All 162 asset-pack `map_Kd` paths currently resolve on disk. The `.mtl` files use `Kd 1 1 1` plus PNG palette textures, so the requested plant/door/furniture colors come from the loaded maps rather than the MTL diffuse scalar.
- Current lighting is below the requested values (`ambientLight 0.72`, directional `1.65`, position `[18, 28, 14]`), and the floor is `#c9cace` rather than `#FFFFFF`.
- Current lounge placement uses `couch-black.rotationY = -Math.PI / 2`; the final requested adjustment is an additional 180° turn relative to the current bottom couch orientation, so the implementation should use `Math.PI / 2` and verify the projected facing direction.
- Current TV placement is on the left-side boundary area at `cell: [1, 4]` with `rotationY: Math.PI / 2`. The final plan will move the anchor onto the intended back-left wall face and use the wall-normal rotation that makes the TV’s thin local Z dimension flush with that wall, rather than relying on visual guesswork.
- `three-stdlib@2.36.1` is available transitively through `@react-three/drei`, but it is not a direct dependency. If the loader imports are changed to `three-stdlib`, declare it directly in `package.json` and update the lockfile with npm; do not rely on Drei’s transitive dependency for application code.

---

### Task 1: Encode and test the dollhouse wall cutaway ✅

**Files:**
- Modify: `components/office/officeLayout.ts`
- Modify: `components/office/Walls.tsx` only if the wall renderer needs a named open-face filter
- Modify: `components/office/officeLayout.test.ts`
- Modify: `e2e/office-smoke.spec.ts`

**Design:**

1. Remove the two camera-facing exterior `WALLS` entries from the configuration. Based on the current camera direction, these are the positive-Z horizontal run and positive-X vertical run; confirm the exact entries against the rendered projection before implementation. Keep the negative-Z/negative-X runs and the left-wall doorway gap.
2. Add comments that explicitly label the omitted segments as the camera-facing dollhouse opening. Do not add a generic `visible={false}` workaround in `Walls.tsx`.
3. Add a unit assertion that the camera-facing wall positions are absent while the remaining wall count and doorway gap remain present.
4. Extend the Playwright scene audit to count named wall meshes and verify the camera-facing wall IDs/segment names are not mounted. Name wall meshes deterministically, for example `wall-negative-z` and `wall-negative-x`, so the test does not depend on Three.js child ordering.

**Expected configuration shape:**

```ts
export const WALLS: WallSegment[] = [
  { id: 'wall-negative-z', cell: [0, 0], lenCells: OFFICE_COLS, axis: 'x', height: WALL_HEIGHT },
  { id: 'wall-left-upper', cell: [0, 1], lenCells: 9, axis: 'z', height: WALL_HEIGHT },
  { id: 'wall-left-lower', cell: [0, 12], lenCells: 2, axis: 'z', height: WALL_HEIGHT },
]
```

The final cell/axis labels must follow the actual current coordinate convention; the example shows the intended explicit naming, not permission to change the grid origin casually.

---

### Task 2: Make the OBJ/MTL pipeline explicit and observable ✅

**Files:**
- Modify: `package.json` and lockfile to declare the existing `three-stdlib` version directly
- Modify: `components/office/OfficeModel.tsx`
- Modify: `e2e/office-smoke.spec.ts`
- Test: `components/office/officeLayout.test.ts` may validate asset sidecars, but material behavior belongs in browser/e2e

**Implementation:**

1. Import `MTLLoader` and `OBJLoader` from the direct `three-stdlib` package, using the package’s current exports. Do not install a second Three.js version.
2. Keep the loader sequence unambiguous:

```ts
const materials = useLoader(MTLLoader, mtl)
materials.preload()
const object = useLoader(OBJLoader, obj, (loader) => {
  loader.setMaterials(materials)
})
```

3. After cloning, traverse each mesh and retain `castShadow`/`receiveShadow`. Also inspect each mesh material and ensure it is the material produced by the MTL pipeline, with a non-null `map` when the source MTL contains `map_Kd`. Do not overwrite the texture with a flat fallback color.
4. If Three.js color management requires it, set the loaded map texture’s `colorSpace` to `THREE.SRGBColorSpace` and set `needsUpdate = true`; only add this after confirming the runtime material map exists. Do not use `MeshBasicMaterial` as a brightness workaround.
5. Keep the existing clone-per-placement rule and avoid adding the same cloned object to more than one parent.
6. Extend the browser scene handle audit so the test checks representative assets by placement ID:
   - a plant has a material map and a green sampled/declared texture asset,
   - the door has a material map and its blue texture asset,
   - a wall/floor mesh has the intended white material,
   - a couch/TV has a material map.

Because PNG palette colors are encoded in the maps while MTL `Kd` is white, the test should verify map presence/source asset identity and rendered screenshot content rather than incorrectly asserting the MTL scalar `Kd` itself is green or blue.

---

### Task 3: Apply the requested brightness and floor palette ✅

**Files:**
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `components/office/Floor.tsx`
- Modify: `components/office/officeLayout.test.ts` only if footprint/color constants are exported for testing

**Implementation:**

1. Change the floor material to pure white:

```tsx
<meshStandardMaterial color="#FFFFFF" roughness={0.92} />
```

2. Set ambient lighting to at least `0.8`; use `0.85` as the initial target.
3. Set the directional light to intensity `2.0` or higher; use `2.0` as the minimum exact requirement.
4. Set directional position exactly to `[10, 20, 10]`.
5. Preserve soft shadow configuration and keep the shadow camera large enough to cover the finite office footprint.
6. Keep the teal-gray background unless the reference comparison demonstrates that the new requested brightness needs a small tonal adjustment; do not change unrelated camera/interaction behavior.

Add stable scene-light names such as `office-ambient` and `office-key` so the browser test can inspect exact intensity and position values rather than relying on screenshot brightness alone.

---

### Task 4: Correct final couch and TV placement/orientation ✅

**Files:**
- Modify: `components/office/officeLayout.ts`
- Modify: `components/office/officeLayout.test.ts`
- Modify: `e2e/office-smoke.spec.ts`

**Implementation:**

1. Rotate the bottom/black lounge couch by 180° from its current `-Math.PI / 2` orientation to `Math.PI / 2`.
2. Preserve its anchor cell unless the reference comparison shows the 180° rotation causes collision with the coffee table; if it does, adjust only the couch cell by one grid unit and add a test for the final relationship.
3. Move the TV anchor onto the actual back-left wall boundary and set its rotation so the model’s thin local Z dimension is flush with the wall plane. Keep the TV’s elevation above the stand and keep the stand directly below it.
4. Use a placement field such as `wallSide: 'left' | 'back'` only if the existing `mount: 'wall'` plus rotation/cell values cannot express the intent clearly. Avoid introducing a general wall-placement abstraction for one asset.
5. Add layout tests for the black-couch rotation, TV wall mount, TV/stand shared wall anchor, and TV/stand vertical ordering.
6. Add a browser assertion that the TV model’s world-facing thin axis is parallel to the target wall plane. This catches the “floating perpendicular to the wall” regression more reliably than a screenshot-only test.

---

### Task 5: Run focused validation, then the complete M1 gates ✅

The final runtime contract passes: all placement meshes, wall cutaway IDs, texture sources, white floor/walls, light thresholds, couch/TV metadata, TV wall-plane tolerance, screenshot output, and zero console/page errors are covered by the automated gates.

**Files:**
- Modify: `docs/lessons-learned.md` after any newly discovered loader/geometry gotcha
- Modify: `handoff.md` after the fixes are actually implemented and validated

**Validation sequence:**

1. Run the focused unit test first:

```bash
npm test -- components/office/officeLayout.test.ts
```

2. Run the typecheck:

```bash
npx tsc --noEmit
```

3. Run lint and production build:

```bash
npm run lint
npm run build
```

4. Run the Playwright smoke test:

```bash
npm run test:e2e
```

The e2e gate must verify all of the following:
- every declared OBJ placement mounts with at least one mesh,
- the two camera-facing exterior wall meshes are absent,
- representative texture-backed materials/maps exist,
- ambient intensity is at least `0.8`,
- directional intensity is at least `2.0`,
- directional position is exactly `[10, 20, 10]`,
- the floor material color is `#FFFFFF`/white,
- the black couch and TV world orientations match the layout contract,
- no console/page errors occur,
- the screenshot contains rendered scene content.

5. Run one browser visual comparison against `preview.png` at desktop viewport size. Confirm the room reads as an open-front dollhouse, the plants/door retain palette colors, the scene is brighter, the black couch faces inward, and the TV is flush with the intended wall.
6. Only after all gates pass, update `handoff.md` to mark this stabilization pass complete and leave Milestone 2 explicitly paused until the user approves the next step.

---

## Plan self-review

- **Spec coverage:** front camera-facing walls, MTL/OBJ loading and color evidence, floor white, ambient/directional brightness and position, black couch 180° rotation, TV wall flush orientation, tests, docs, and M1-only scope are all covered.
- **Implementation status:** executed in this pass. Source changes remain intentionally uncommitted pending final review.
- **Dependency caution:** `three-stdlib` is currently transitive through Drei. Directly declaring it is the reliable implementation choice, but package installation/lockfile updates should happen only when execution is authorized.
- **Open coordinate check:** because the repository’s row/axis naming and the camera’s positive-X/positive-Z view use different human labels (“front,” “back,” “left”), the executor must verify the two omitted `WALLS` entries in the browser before editing. This is a bounded verification step, not a reason to guess.
