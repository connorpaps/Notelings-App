# Milestone 1 Lounge, Divider & Shadow Polish Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. This is a plan-only document; Milestone 2 remains paused.

**Goal:** Make the final M1 scene match `preview.png` more closely by correcting the lounge orientation and wall mount, making the central partition an unmistakable T, and lightening/softening the existing diagonal shadows.

**Architecture:** Keep `components/office/officeLayout.ts` as the single source of truth for model placement and wall-mount intent. Keep procedural divider geometry in `CubicleDivider.tsx`, scene lighting in `OfficeCanvas.tsx`, and runtime assertions in the existing unit/Playwright contracts. Prefer small declarative coordinate changes over new abstractions.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber 9, Three.js, Drei, `three-stdlib`, Vitest, Playwright.

## Global Constraints

- Do not begin Milestone 2: no robots, A*, navigation, Zustand, task queue, or UI work.
- Preserve the existing OBJ+MTL pipeline and clone-per-placement behavior.
- Do not add physics, animation, post-processing unrelated to shadows, or new dependencies.
- Use `docs/references/preview.png` / the running browser scene as the visual authority.
- Keep the dollhouse wall cutaway, textured materials, white floor/walls, and current camera unchanged.
- Do not commit secrets or modify database/schema files.

## Audit Findings

- `components/office/officeLayout.ts` currently has exactly one TV placement (`tv-wall`) plus one TV stand (`tv-console`). The runtime audit found one TV at the left/back corner, so the implementation must enforce a singleton rather than remove the valid remaining TV.
- The black couch currently uses `rotationY: Math.PI / 2`; browser inspection shows it faces away from the TV/lounge. A 180-degree turn from the current value is `-Math.PI / 2`.
- The TV is currently anchored at `[0, 4]`, rotated `Math.PI / 2`, and centered on the left wall plane. Its OBJ bounds place part of its depth inside the procedural wall thickness, which explains the clipping. The fix must preserve the left/back reference side while offsetting the TV to the room-facing wall plane.
- `CubicleDivider.tsx` currently renders a long horizontal box and a deep perpendicular box. The perpendicular geometry visually reads as a four-way/cross partition in the current scene; the lounge-facing portion must be removed while retaining one stem extending only into the desk area.
- `OfficeCanvas.tsx` already uses directional light position `[10, 20, 10]`, so the directional direction should remain unchanged. Ambient intensity is `0.85`; the shadows are still visually too hard/dark and need a modest fill/softness adjustment.

---

### Task 1: Correct the lounge placement contract ✅

**Files:**
- Modify: `components/office/officeLayout.ts`
- Test: `components/office/officeLayout.test.ts`
- Modify: `e2e/office-smoke.spec.ts`

**Implementation:**

1. Change only `couch-black.rotationY` from `Math.PI / 2` to `-Math.PI / 2`. Keep its cell `[7, 4]` unless the visual pass proves the rotated model collides with the coffee table.
2. Keep exactly one `tv-wall` placement and exactly one `tv-console` placement. Do not add a second TV asset. Add a layout invariant that counts `id === 'tv-wall'` and expects `1`.
3. Preserve the TV’s left/back wall semantic (`wallSide: 'left'`) and cell `[0, 4]`, but add the smallest explicit wall-facing offset supported by the existing placement type (for example, a local wall offset field) so the model’s rear depth sits on the room-facing side of the wall instead of intersecting its center.
4. Recompute the TV elevation from the actual model/stand bounds so the TV is directly above the stand: the bottom of the TV should meet or nearly meet the stand’s top, with a small intentional visual gap at most `0.1` world units. Keep the stand at `[0, 4]` and rotate it consistently with the TV.
5. Keep the TV’s thin local Z axis parallel to the left wall’s X plane. Do not move the TV to a different wall merely because “back-left” is ambiguous in human labels; the existing runtime/reference audit identifies the left/back corner as the correct visual side.

**Unit assertions to add/update:**

```ts
expect(PLACEMENTS.filter((p) => p.id === 'tv-wall')).toHaveLength(1)
expect(byId.get('couch-black')?.rotationY).toBeCloseTo(-Math.PI / 2)
expect(byId.get('tv-wall')?.mount).toBe('wall')
expect(byId.get('tv-wall')?.wallSide).toBe('left')
expect(byId.get('tv-wall')?.cell).toEqual([0, 4])
expect(byId.get('tv-console')?.cell).toEqual([0, 4])
```

The browser contract must replace the current `Math.PI / 2` couch expectation, assert exactly one TV group/source, and verify the TV’s wall-facing bounding-box edge is within `0.1` world units of the left wall’s interior plane. Also verify the TV bounding box is vertically above the stand rather than merely sharing a cell.

---

### Task 2: Make the central divider an explicit T ✅

**Files:**
- Modify: `components/office/CubicleDivider.tsx`
- Modify: `components/office/officeLayout.test.ts` if divider constants/metadata are exported
- Modify: `e2e/office-smoke.spec.ts`

**Implementation:**

1. Keep the long horizontal divider as the lounge/desk separator.
2. Reshape the perpendicular divider so it begins at the desk-facing edge of the horizontal bar and extends only into the desk area. It must not have any volume on the lounge-facing side of the horizontal bar.
3. Use named child meshes, for example `divider-horizontal` and `divider-desk-stem`, so the scene audit can distinguish the two logical pieces.
4. Derive the stem position from its dimensions instead of letting its center accidentally create a cross. With a horizontal bar centered at `z = -0.9` and thickness `0.14`, define the stem’s lounge-facing edge at `-0.9 + 0.14 / 2`, then set `stemCenterZ = stemFront + stemDepth / 2`. This guarantees the stem is one-sided even if its depth is tuned against the screenshot.
5. Keep the stem wide enough to divide the two desk positions, but remove the existing lounge-facing protrusion rather than shrinking the entire partition into an ineffective line.
6. Preserve `castShadow` and `receiveShadow` on both pieces and keep their white/near-white material palette.

**Geometry contract:**

- Exactly two divider mesh children: one horizontal bar and one desk-side stem.
- The horizontal bar spans the lounge/desk boundary.
- The stem’s minimum world/local Z is greater than or equal to the horizontal bar’s desk-side edge, within a small `0.01` geometry tolerance.
- No fourth branch or separate lounge-side divider mesh exists.

Add a browser assertion over `central-t-divider` that checks these named children and their bounding boxes. The assertion should fail if a future edit restores a four-way cross while the unit test still passes.

---

### Task 3: Soften the existing diagonal shadows ✅

**Files:**
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `e2e/office-smoke.spec.ts` if light metadata is extended

**Implementation:**

1. Keep the directional light at exactly `[10, 20, 10]`; this is already the requested top-right/down-left direction in the current camera contract.
2. Raise the ambient fill modestly from `0.85` to approximately `0.95` or `1.0` so occluded geometry is no longer nearly black. Do not wash out the textured materials.
3. Add the smallest supported soft-shadow treatment already available through Drei/Three. Prefer the existing `shadows="soft"` path plus a controlled `SoftShadows` configuration if the browser comparison shows PCF softness is insufficient; otherwise use the native shadow softness setting without introducing a new renderer architecture.
4. Keep the directional intensity at `2` and preserve the existing shadow camera coverage and bias unless visual QA identifies a shadow acne regression.
5. Name/retain the light as `office-ambient` and `office-key` so the e2e audit can continue to verify exact position/intensity independently of screenshot interpretation.

Add or update a runtime assertion that ambient intensity is at least `0.95`, key intensity remains at least `2`, and key position remains `[10, 20, 10]`. Use a screenshot comparison/manual browser pass to confirm the shadow gradient is visibly softer and the cast direction has not flipped.

---

### Task 4: Update documentation and validation contracts ✅

**Files:**
- Modify: `components/office/officeLayout.test.ts`
- Modify: `e2e/office-smoke.spec.ts`
- Modify: `docs/lessons-learned.md` only if a new geometry/lighting gotcha is discovered
- Modify: `handoff.md` only after implementation and all validation gates pass

**Validation sequence:**

1. Run the focused layout test:

```bash
npm test -- components/office/officeLayout.test.ts
```

2. Run typecheck:

```bash
npx tsc --noEmit
```

3. Run lint and build:

```bash
npm run lint
npm run build
```

4. Run the Playwright contract:

```bash
npm run test:e2e
```

5. Run desktop browser QA against the reference and verify all of the following:
   - exactly one large TV is visible,
   - the TV is flush with the room-facing left/back wall rather than clipping into its center,
   - the black couch faces the other couch/TV,
   - the black stand is directly beneath the TV,
   - the central partition reads as a T with no lounge-side branch,
   - shadows still cast diagonally down/left from `[10, 20, 10]` but are lighter and softer,
   - materials remain textured and the open-front dollhouse view is unchanged,
   - no console/page errors occur.

6. Only after all gates pass, append a new dated work-completed section to `handoff.md` describing this final M1 polish and leave Milestone 2 explicitly paused. If any new issue is fixed during execution, add a structured Symptom / Root cause / Fix / Avoid in future / Status entry to `docs/lessons-learned.md` immediately.

## Execution result

- Black couch now uses `-Math.PI / 2` and faces the lounge/TV.
- Exactly one TV source and one `tv-wall` group are enforced at runtime.
- TV/stand placement uses explicit left-wall offsets and transformed bounds verify flush mounting, vertical ordering, and horizontal overlap.
- Divider children are named and the desk stem begins at the desk-facing edge of the horizontal bar, eliminating the lounge-side branch.
- Ambient fill is `0.95`; the key remains `[10, 20, 10]` at intensity `2`; native `shadow-radius={4}` softens shadows.
- Drei `SoftShadows` was tested and removed because it generated Three.js shader validation errors (`unpackRGBAToDepth`) with this project’s Three.js/R3F combination.
- Validation passed: typecheck, 7 unit tests, lint with 0 errors, production build, Playwright, and runtime/browser scene contract.

## Plan self-review

- **Coverage:** lounge couch rotation, TV singleton, wall-plane offset, TV/stand vertical relationship, T-divider geometry, diagonal shadow direction, ambient fill, tests, browser QA, and handoff updates are all covered.
- **Minimality:** no new app architecture, dependencies, or M2 work is required; the key light position is intentionally unchanged because it already matches the requested value.
- **Regression protection:** unit tests cover declarative placement invariants, while Playwright covers runtime singleton counts, transformed bounds, divider shape, light values, screenshot content, and console errors.
- **Known execution checkpoint:** resolved during execution with transformed OBJ bounds and browser runtime assertions; no unresolved implementation checkpoint remains.
