# Conservative Performance Pass Implementation Plan

> **For agentic workers:** Preserve the existing office composition and create a named local revert point before changing renderer settings.

**Goal:** Improve perceived video and office smoothness with the smallest renderer change that materially reduces pixel work.

**Architecture:** Keep the fixed camera, imported assets, lighting, shadows, post-processing effects, transparent canvas, and autonomous agent loop unchanged. First cap the WebGL device-pixel ratio at 1×; benchmark before considering any further change. Revert the experimental change if the measured result does not improve or visual regressions appear.

**Tech Stack:** Next.js, React Three Fiber, Three.js, React Three Postprocessing, Playwright.

## Global Constraints

- Preserve the current visual office baseline and Bloom liquid-glass composition.
- Preserve autonomous agents and `frameloop="always"`.
- Do not change database, API, environment variables, or package versions.
- Keep Windows and macOS behavior compatible.
- Do not include the user’s untracked `image.png` in the checkpoint.

### Task 1: Checkpoint

- Commit all existing tracked work without adding `image.png`.
- Create local tag `pre-performance-pass-2026-08-09` at that checkpoint.

### Task 2: Minimal renderer change

- Modify `components/office/OfficeCanvas.tsx` from `dpr={[1, 2]}` to a 1× cap.
- Preserve all other renderer, lighting, shadow, post-processing, camera, and scene settings.

### Task 3: Validation

- Benchmark combined page and video-only FPS in Chrome.
- Run typecheck, unit tests, lint, production build, and Playwright E2E.
- Keep the change only if the browser is smoother and all visual/behavior contracts pass.
