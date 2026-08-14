# Light Paper-and-Glass UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark Bloom overlay background with a readable light paper-and-glass shell while preserving the colorful 3D office, agent identity colors, behavior, and accessibility contracts.

**Architecture:** Keep the transparent WebGL office and application composition unchanged. Replace the static dark background with a restrained off-white paper surface, update the shared glass tiers and control contrast in `app/globals.css`, and adjust only the background layer/root classes and durable design documentation. Use semantic light-theme selectors for existing utility classes so the component behavior and test-facing accessible names remain stable.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4 utility classes, CSS backdrop filters, React Three Fiber (preserved).

## Global Constraints

- Preserve the 3D office scene, robots, pathfinding, Zustand state, Supabase routes, and AI behavior.
- Preserve accessible names: `Initialize Agents`, `Type a new note`, `Submit note`, graph controls, and auth controls.
- Keep robot identity colors blue `#2fa8e0`, green `#43c98b`, and red `#ef4444`.
- Use an off-white paper surface rather than pure white: target `#f6f7f5` / `#ffffff` layered surfaces.
- Maintain responsive layout, pointer-events layering, reduced-motion behavior, and modal focus behavior.
- Do not commit `.env`, `.env.local`, secrets, build output, or the unrelated MP4.

---

### Task 1: Establish the light paper background

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/notelings/BackgroundVideo.tsx`

**Interfaces:**
- Preserve the existing `BackgroundVideo` component and `Home` composition.
- Produce a light root surface behind the transparent office without changing the WebGL canvas contract.

- [ ] Add a `light-world` root class to the home surface.
- [ ] Replace the image/scrim treatment in `BackgroundVideo` with a static off-white paper background and a subtle neutral radial vignette that separates the office without competing with it.
- [ ] Preserve the component's decorative ambient glow only if it remains visible and neutral on the light surface.
- [ ] Run TypeScript after the background change.

### Task 2: Rebuild shared glass and contrast tokens

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Preserve `.liquid-glass`, `.liquid-glass-strong`, `.glass-glow-ring`, `.glass-glow-halo`, `.ambient-glow`, and scrollbar class names.
- Produce light-theme surfaces, dark grayscale text, visible borders, focus rings, and readable legacy utility-class mappings under `.light-world`.

- [ ] Set the document base to the light color scheme and off-white background.
- [ ] Change both glass tiers to white translucent surfaces with dark translucent borders, restrained shadows, and readable inset highlights.
- [ ] Add `.light-world` mappings for the existing white text/background utility classes used by the overlay so the broad UI changes theme without changing behavior or accessible labels.
- [ ] Add light-theme mappings for muted controls, inputs, status copy, error copy, and robot-colored demo identity elements.
- [ ] Keep dark modal/error surfaces explicitly readable where they intentionally remain dark.
- [ ] Preserve reduced-motion rules and make the scrollbar track/thumb legible on light surfaces.

### Task 3: Update durable visual documentation

**Files:**
- Modify: `DESIGN.md`
- Modify: `knowledge.md`

**Interfaces:**
- Document the new light paper-and-glass world as the current visual contract.
- Record that the office and robot color cues remain unchanged and the background is now a light neutral surface.

- [ ] Replace stale dark Bloom palette/background language with the approved light palette and contrast rules.
- [ ] Keep the glass tier and layering descriptions accurate.
- [ ] Record the preserved office/canvas boundary and validation expectations.

### Task 4: Validate the redesign

**Files:**
- No new test files unless an existing visual contract requires a small assertion update.

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint` and distinguish baseline warnings from new errors.
- [ ] Run `npm run build`.
- [ ] Start/check the dev server and inspect the root page for HTTP 200 and readable light-shell rendering.
- [ ] Run the relevant E2E smoke suite with the repository's fresh-server guidance if the environment permits.
- [ ] Run the Impeccable detector over changed UI targets once after implementation.

### Revert point

Before implementation, create annotated tag `pre-light-paper-glass-20260814` at the current committed HEAD. To return to the prior committed design, restore the working tree to that tag only after preserving any desired later work; the unrelated untracked MP4 remains untouched.
