# Milestone 1 Visual Stabilization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the static 3D office closer to the supplied voxel-office reference before beginning Milestone 2.

**Architecture:** Preserve the existing data-driven `officeLayout.ts` and OBJ+MTL loader. Tune the finite scene shell and lighting in dedicated scene components, keep layout changes declarative, and add only a small primitive divider where the asset pack does not provide a complete T partition.

**Tech Stack:** Next.js App Router, React Three Fiber, Drei, Three.js OBJ/MTL loaders, Vitest, Playwright.

## Global Constraints

- Do not begin Milestone 2 agents, navigation, or Zustand work.
- Keep `officeLayout.ts` as the single source of truth for placement coordinates.
- Preserve the cloned-loader-object rule for repeated OBJ URLs.
- Do not install packages or introduce physics/animation systems.
- Validate with typecheck, unit tests, lint, build, and Playwright/browser inspection.

---

### Task 1: Audit the existing M1 scene

- [x] Read `handoff.md`, `knowledge.md`, lessons, spec, and reference image.
- [x] Confirm all MTL `map_Kd` files resolve.
- [x] Inspect the running scene and identify the oversized floor, missing second couch, and weak material/shadow presentation.

### Task 2: Correct scene shell and lighting

- [x] Bound the floor and finite grid to the exterior wall footprint.
- [x] Set the scene background to `#5B7B7A`.
- [x] Tune ambient, hemisphere, and top-right directional light with soft shadows.
- [x] Apply `castShadow` and `receiveShadow` to loaded model meshes.

### Task 3: Correct reference layout

- [x] Add a second lounge couch and arrange the couches around the TV/stand.
- [x] Move the TV/stand to the lounge wall and retain valid OBJ+MTL assets.
- [x] Place two tall cabinets against the right wall.
- [x] Add a central T-shaped divider without changing M2 behavior.

### Task 4: Validate and document

- [ ] Run typecheck, tests, lint, build, and browser/e2e checks.
- [ ] Record any newly discovered gotcha in `docs/lessons-learned.md` and update `handoff.md`.
