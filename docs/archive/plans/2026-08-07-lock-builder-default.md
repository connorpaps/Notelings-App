# Lock Current Office Builder Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the user’s current admin-builder office scene the checked-in default while preserving browser-local development editing and persistence for future revisions.

**Architecture:** Capture the validated v3 builder scene as a source-controlled baseline module. The builder will use that baseline when no valid saved scene exists, while valid localStorage remains authoritative for development edits. The production/static scene will continue to use the locked source layout unless a later explicit export is promoted into source.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber, TypeScript, Vitest, Playwright.

## Global Constraints

- Do not reset, clear, or otherwise alter the user’s current builder scene during capture.
- Preserve stable builder asset IDs and v3 localStorage compatibility.
- Keep production free of builder localStorage hydration and writes.
- Do not add packages or change the database schema.
- Validate with typecheck, unit tests, lint, production build, and browser persistence checks.

---

### Task 1: Capture the current persisted scene

**Files:**
- Read-only: user-provided builder export; development persistence key `notelings-office-builder-v4`.
- Create: `components/office/officeBuilderDefault.ts` containing the exact validated item array.

- [ ] Read and parse the current v3 JSON without clicking Reset or Clear.
- [ ] Verify the export snapshot key matches the v3 value and record the item count.
- [ ] Write the exact scene as typed source data with no rounding or ID changes.

### Task 2: Make the captured scene the fallback default

**Files:**
- Modify: `components/office/OfficeBuilderContext.tsx`.
- Test: `components/office/officeBuilderPersistence.test.ts`.

- [ ] Import the checked-in default scene.
- [ ] Use it as the initial builder state and fallback when no valid localStorage exists.
- [ ] Keep valid v3 localStorage authoritative so later edits continue to load.
- [ ] Preserve the malformed-storage safety behavior and production gating.

### Task 3: Verify the default and persistence contract

**Files:**
- Modify: `handoff.md`.
- Modify: `knowledge.md`.
- Test: existing office unit/e2e tests plus focused persistence tests.

- [ ] Assert the default item count and IDs are stable.
- [ ] Verify a reload preserves the same JSON in both storage keys.
- [ ] Run `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- [ ] Record that the current build is locked as the baseline and can be revised later by promoting a future export.
