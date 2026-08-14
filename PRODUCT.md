# PRODUCT.md — Notelings

## What this is
Notelings is a gamified, visual "Second Brain" note organizer. Notes typed into a 2D inbox are LLM-categorized (Gemini 2.5 Flash) and physically delivered by capsule "Librarian" robots to category destinations inside a 3D isometric office (the 10 m `3d_note_office.glb`): **Work → Manager's Bookshelf** (glass office), **Admin → Filing Cabinets**, **Uncategorized → Hallway Bookshelf**.

## Audience & real scene
A single personal user at a desktop, capturing quick thoughts while the office animates in the center of the screen. The office is the product's stage; the 2D glass overlay is the control surface. The feel to protect: calm, watchable, delightful — a living room for your notes.

## Core loop
Type → LLM categorize (10s timeout) → Supabase save → Zustand queue dispatches an idle robot → robot A*-walks and files the note → toast confirms. On LLM failure: save as Uncategorized, dispatch anyway, and the Red error sentinel pulses.

## Hard preserve boundary (never regress)
- 3D office scene: robots, pathfinding, Zustand store, camera, lights, shadows, SSAO/Bloom/ToneMapping profile.
- Supabase backend + `POST /api/categorize`.
- Unit tests, E2E scene/render/toast contracts, accessible names (`Initialize Agents`, `Type a new note`, `Submit note`), toast copy, overlay pointer-events contract.
- Commands/constraints recorded in `knowledge.md`; the Master Spec is `MASTER_SPEC_FINAL.md`.

## Visual direction (current 2026-08-14)
Light paper-and-glass world: a calm off-white paper surface behind the office, Poppins (display/body) + Source Serif 4 (italic accents), charcoal/slate text hierarchy, `.liquid-glass` / `.liquid-glass-strong` white glass tiers, and a restrained monochrome glow ring around glass edges. Small robot-color cues (blue/green/red) remain agent identity signals. The colored 3D office remains the centerpiece. The retired dark Skybridge frame is historical context only and must not be restored by new work.
