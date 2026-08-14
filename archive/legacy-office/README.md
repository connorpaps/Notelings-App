# Archived OBJ Office

This directory contains the original Notelings voxel/OBJ office implementation and its source assets.

## Status

- **Not mounted by the released app.** The active scene is `components/office/OfficeCanvas.tsx` → `NewOfficeScene` → `NewOfficeModel`.
- **Replaced:** 2026-08-10 by `public/models/3D_Note_Office_2/3d_note_office.glb`.
- **Purpose:** historical engineering reference for the original Milestones 1–4 office, builder, asset manifest, and navigation work.
- **Runtime:** the archive is excluded from TypeScript compilation and ESLint. It is not served from Next.js `public/`.

## Contents

- `source/components/office/` — the inactive builder, OBJ office scene, legacy asset manifest, and legacy grid implementation.
- `assets/3D_Office_Obj_Assets/` — the original 162 OBJ/MTL asset pairs and associated palette/reference images.
- `media/` — the retired Skybridge frame and Bloom background video used by earlier visual directions.

The active navigation implementation intentionally remains in `components/office/pathfinding.ts`, `components/office/navigationGrid.ts`, and the `newOffice*` modules. The active development-only Nav Grid Editor also remains in `components/office/GridDebugOverlay.tsx` and related files because it is still supported by the current app.
