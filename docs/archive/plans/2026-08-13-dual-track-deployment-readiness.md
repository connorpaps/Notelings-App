# Dual-Track Deployment Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Notelings for a safe polished portfolio/demo deployment while hardening the same codebase toward a future authenticated private product, without weakening the current owner-scoped data boundary or changing the visual identity without explicit approval.

**Architecture:** Keep one repository and two explicitly isolated release topologies: a sanitized public demo Vercel project backed by a separate demo Supabase project, and a private workspace Vercel project backed by the authenticated private Supabase project. Complete the remaining production work in reversible checkpoints: release boundary and environment isolation, deployment/migration rehearsal, cost/reliability controls, operations/CI, then measured accessibility/performance/product polish. Existing auth/RLS, live migration, observability/security headers, Knowledge Graph, and first renderer pass are treated as the current baseline—not reimplemented.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vercel, Supabase Auth/Postgres/Realtime, Google Gemini through the existing AI SDK, Zustand, R3F/Three.js, Playwright, Vitest, GitHub Actions.

## Global Constraints

- Preserve the active GLB office, fixed camera, Bloom/liquid-glass identity, robots, Knowledge Graph, and current high/balanced renderer profiles unless a later visual-change gate is explicitly approved.
- Do not deploy the current private Supabase project as a public demo project; it contains the owner workspace and a shared demo account.
- Never commit `.env`, `.env.local`, Supabase service-role keys, Management API PATs, passwords, provider keys, cookies, or test credentials.
- Never set `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` in preview or production environments.
- `SUPABASE_ACCESS_TOKEN` is a temporary local migration credential only; it must be absent from deployment environments and removed after every migration operation.
- Use `npm`, do not install packages or add hosted services without explicit approval, and do not change the database schema or apply migrations without a separate user approval checkpoint.
- Do not use a client-side `demo=true` switch as an authorization boundary.
- Keep service-role imports server-only and narrowly scoped; ordinary user operations must exercise the authenticated Supabase/RLS path.
- Keep the current `frameloop="always"` behavior unless a later measured performance task models robot animation/invalidation correctly.
- Major visual or behavior changes require a before/after screenshot/interaction comparison and explicit user approval before implementation.
- Every task ends with focused tests and a review checkpoint; do not bundle unrelated security, UI, database, and performance changes into one opaque change.

---

## Current Baseline and What Is Already Complete

The execution must begin from the current working tree, not from the stale pre-hardening audit alone:

- Username/email + password auth routes exist and are CSRF/origin/rate guarded.
- Authenticated server sessions, owner-scoped RLS, authenticated Realtime, ownership backfill, username table, and the Manual category constraint are live-verified in the current private Supabase project.
- The current owner has 21 notes; the isolated shared demo account currently has 3 notes; a real demo session was verified to see only its own rows.
- The temporary Management API token used for migration was removed from `.env.local`.
- Current renderer first pass is complete: high quality caps DPR at 1; constrained balanced quality uses 2048²/±14 shadows and SSAO 16/2; matched measurements improved DPR-2 headed FPS from ~35.6 to ~80.9 with no material visual regression detected.
- Security headers/CSP, request IDs/redacted observability, health liveness endpoint, privacy-safe error boundary, and focus trapping were already added in prior hardening work.
- Current automated baseline is green: 243 unit tests, TypeScript, lint with 0 errors/5 baseline warnings, production build, and 12/12 fresh-server E2E after a known graph timing rerun.
- The existing demo route signs into a shared writable account. This is acceptable for local development but is **not** the final public demo topology.
- The working tree contains uncommitted performance/app/memory changes, generated `next-env.d.ts`, and unrelated untracked `2026-08-08 00-14-26.mp4`. A Git tag alone will not preserve those uncommitted files.

### Decision snapshot — 2026-08-13

The user approved the recommended secure defaults for planning/execution:

- Use separate Vercel and Supabase projects for the public portfolio demo and private product workspace.
- Allow ephemeral demo writes in the isolated demo project; disclose that visitor data can reset.
- Use real Gemini in the demo only behind hard application quotas and provider-failure fallback; do not depend on an assumed permanent vendor free tier.
- Keep a fictional seed/reset source as the demo recovery mechanism and maintain private-project backups/exports separately.

The separate-project topology still requires the user’s deployment credentials/project access before provisioning or applying external configuration.

---

## Approval Gates Before Major Implementation

These decisions must be confirmed at execution time before touching the relevant subsystem:

### Gate A — Deployment topology

**Recommended:** separate Vercel + Supabase projects for the public demo and private workspace.

- Demo: sanitized seed data, separate keys/database, read-only or tightly bounded writes, separate demo environment variables.
- Private: authenticated owner-scoped workspace, real private notes, no public demo credentials or seed rows.
- Optional later: a neutral landing page linking to both deployments; this is not required for the first safe release.

This is a deployment/security boundary, not a UI-only feature. Ask before provisioning or changing external projects.

### Gate B — AI privacy contract

**Recommended first release:** disclosed Gemini processing for AI-on notes/chat plus the existing manual/no-AI capture path.

Before real sensitive notes are accepted:

- Verify Google/Gemini retention, training, region, and account settings for the selected production project.
- Add clear privacy copy explaining what is sent to Gemini and what remains in Supabase.
- Do not promise end-to-end/zero-knowledge encryption.
- Treat note text as untrusted prompt data.

Changing AI-on/off semantics, adding per-note AI exclusion, or disabling AI for private production is a user-visible behavior decision and requires approval.

### Gate C — Reliability promise

**Recommended first release:** remote persistence is authoritative, robot movement is recoverable visual playback, and failed network writes are never shown as saved.

If the product must guarantee a note survives browser close while a robot is moving, approve a durable job/worker design before implementing it. That would change schema, deployment, and product behavior.

### Gate D — Usage/cost budget

Before quotas are implemented, confirm:

- Maximum private note count for the initial release.
- Expected concurrent users.
- Monthly Gemini budget.
- Daily/monthly chat and categorization limits.
- Whether the portfolio demo may call Gemini at all.

The plan uses authenticated atomic quotas first and does not select an external rate-limit vendor without measured traffic and explicit approval.

### Gate E — UI scope

The following are hardening candidates, but each changes visible/function behavior and must be previewed before implementation:

- Privacy/data-flow disclosure copy.
- Sync/retry/offline-state labels.
- Account password reset/change UI.
- Demo-mode landing or mode label.
- Semantic Knowledge Graph list/keyboard fallback.
- Export/import or bulk recovery controls.

No visual redesign is implied by this plan.

---

## Task 0: Preserve the current working state with a complete revert point

**Files:**
- No application files.
- Checkpoint commit/tag must include the current performance pass and related tests/docs, but exclude generated `next-env.d.ts` and unrelated `2026-08-08 00-14-26.mp4`.

**Interfaces:**
- Produces a complete local rollback reference for the current app state before deployment-readiness work.
- Does not claim that a tag pointing at old `HEAD` contains current uncommitted work.

- [ ] **Step 1: Review the current diff and classify files.**

  Run `git diff` and `git status --short`. Include the current performance implementation, render tests/probes, audit/docs/memory updates, and deployment-readiness plan in the checkpoint candidate. Exclude `next-env.d.ts` because it is generated and exclude `2026-08-08 00-14-26.mp4` because it is unrelated user data.

- [ ] **Step 2: Create a user-approved checkpoint commit.**

  Stage only the relevant app, test, plan, audit, and memory files. Do not stage `.env.local`, ignored performance artifacts, `next-env.d.ts`, or the MP4. Review the staged diff and recent commit style before committing. Use an annotated commit/tag pair named:

  ```text
  Commit: chore: checkpoint dual-track deployment readiness baseline
  Tag: notelings-pre-dual-track-deployment-readiness-20260813
  ```

  The tag must point to the checkpoint commit containing the current renderer/auth baseline, not merely the older `e73d234` parent.

- [ ] **Step 3: Verify the rollback reference without changing the working tree.**

  Confirm the tag resolves to the checkpoint commit, confirm the MP4 and generated file remain untracked/ignored as intended, and document that database rollback is separate: schema changes require forward migrations or a tested backup restore, never `git reset`.

**Validation:** `git diff --check`, the staged diff contains no secrets, the checkpoint tag points to the reviewed commit, and the app still passes the current focused renderer/auth tests.

---

## Task 1: Define the two release environments and deployment contract

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Modify: `.env.example` only for safe variable names/descriptions; never add values.
- Modify: `README.md` with local/preview/production deployment boundaries.
- Create only if required by the chosen host contract: `vercel.json` (do not add one merely to set defaults Vercel already supplies).

**Interfaces:**
- Produces a written environment matrix and deployment runbook for private and demo projects.
- No application behavior changes in this task.

- [ ] **Step 1: Write the environment matrix.**

  Document these deployment-scoped variables:

  ```text
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
  NOTELINGS_DEMO_EMAIL       # demo deployment only
  NOTELINGS_DEMO_PASSWORD    # demo deployment only; server-only
  NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY  # optional high|balanced|auto override
  ```

  Explicitly document that `SUPABASE_ACCESS_TOKEN` is local migration-only and that `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` must never exist in Vercel Preview/Production.

- [ ] **Step 2: Document the topology.**

  Define separate named environments:

  ```text
  Private production:  private Vercel project + private Supabase project
  Portfolio demo:     demo Vercel project + demo Supabase project
  Preview:             isolated/non-production Supabase project or sanitized fixture; never private production data
  Local:               .env.local only
  ```

  Include the rule that a Vercel domain alias without separate environment variables/database is not sufficient isolation.

- [ ] **Step 3: Document Supabase Auth URL configuration.**

  Record the production site URL, allowed redirect URLs for `/auth/callback`, preview policy, password-auth behavior, and logout behavior. Use exact allow-listed URLs in `app/auth/callback/route.ts`; do not allow arbitrary `next` redirects.

- [ ] **Step 4: Document rollback/runbook ownership.**

  Include Vercel previous-deployment rollback, Supabase backup/restore responsibility, forward-only migration policy, secret rotation steps, demo seed reset, health check URL, and the exact validation commands:

  ```bash
  npx tsc --noEmit
  npm test
  npm run lint
  npm run build
  CI=1 npm run test:e2e -- --workers=1
  npm audit --omit=dev --audit-level=high
  ```

**Approval checkpoint:** Before provisioning the demo project or adding deployment-specific UI, show the topology/env matrix to the user and confirm the two-project choice.

---

## Task 2: Rehearse production migrations and seed an isolated demo project

**Files:**
- Create: `supabase/seed/demo.sql` or an equivalent reviewed seed script.
- Create: `scripts/verify-demo-isolation.mjs` for read-only environment checks.
- Modify: `scripts/setup-auth-db.mjs` only if it needs an explicit `--demo`/`--seed` mode; preserve idempotency.
- Modify: `supabase/schema.sql`/migrations only after Gate D and explicit schema approval.

**Interfaces:**
- Consumes the existing migrations and the environment matrix from Task 1.
- Produces a sanitized demo database with no private owner rows and a repeatable seed/reset path.

- [ ] **Step 1: Create a sanitized seed dataset.**

  Use fictional content only, with categories/tags that demonstrate Work/Admin/Manual/Uncategorized, graph relationships, archive state, and enough notes to show the board. Do not copy any current private note content, owner IDs, timestamps that identify the owner, API responses, or passwords.

- [ ] **Step 2: Rehearse all migrations on a disposable Supabase project.**

  Apply the complete migration sequence from an empty schema and from a copy of the current schema. Verify ownership columns, owner RLS, usernames, Manual constraint, Realtime publication/replica identity, indexes, and seed insertion. Record row counts and policy checks without printing secrets.

- [ ] **Step 3: Verify demo isolation.**

  The verification script must assert:

  - Demo project URL/ref differs from private project URL/ref.
  - Demo rows contain only fictional seed content.
  - Demo authenticated reads return only demo-project rows.
  - No private service-role key or private URL is configured in the demo environment.
  - Demo reset is repeatable and idempotent.

- [ ] **Step 4: Prepare, but do not silently execute, the production migration runbook.**

  The current private project’s Manual migration is already applied. For any future schema change, require a backup/export, disposable rehearsal, reviewed SQL, maintenance pause, post-migration verification, and a forward recovery path. Do not add embedding/quota tables in this task; those are later approval-gated schema tasks.

**Validation:** Empty-schema and upgrade-path rehearsals pass in the disposable project; demo seed/reset/isolation checks pass; no production private rows are copied.

**Approval checkpoint:** User approves the demo dataset/topology before external project provisioning or demo deployment.

---

## Task 3: Complete production environment and Vercel preview smoke

**Files:**
- Create: `scripts/production-smoke.mjs`
- Modify: `playwright.config.ts` only if preview `baseURL`/environment handling can be made explicit without leaking credentials.
- Modify: `next.config.ts` only for a verified deployment-header/CSP issue; current security headers are not to be broadly rewritten.

**Interfaces:**
- Produces a read-only smoke that accepts a deployment URL and checks health, security headers, WebGL/CSP loading, auth gate, demo entry, and private boundary behavior.
- Must never log tokens, cookies, note content, passwords, or service-role responses.

- [ ] **Step 1: Implement health/header smoke.**

  Request `GET /api/health` and assert the liveness JSON, no-store behavior, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and production HSTS when HTTPS is active. Report only header names/presence and status codes.

- [ ] **Step 2: Implement public browser smoke.**

  With no credentials, assert the office loads, the WebGL canvas becomes visible, the demo/private entry surfaces render, no E2E bypass is active, and no application console/page errors occur beyond the known Three.js deprecations.

- [ ] **Step 3: Implement authenticated smoke without committing credentials.**

  Run authenticated checks only when local environment variables are explicitly supplied at execution time. Use a disposable test user or demo project, assert login/logout, owner note visibility, manual capture, AI-off no-categorize behavior, and demo mode. Do not put credentials in Playwright config, snapshots, CI logs, or source.

- [ ] **Step 4: Deploy to Vercel Preview before Production.**

  Configure environment variables per deployment target, verify the build uses Node 22/npm lockfile behavior, configure Supabase site/redirect URLs, and run the smoke against the actual preview URL. Do not point Preview at the private production database until the auth/RLS verification explicitly permits it.

**Approval checkpoint:** User reviews the preview URL and confirms no major visual or behavioral change before production deployment.

---

## Task 4: Add privacy disclosure and preserve the truthful manual path

**Files:**
- Create or modify the existing product/privacy surface after approval: `app/privacy/page.tsx` or the approved existing UI location.
- Modify: `components/notelings/WelcomeScreen.tsx` / `AuthControls.tsx` only if the disclosure needs a compact entry point.
- Modify: `components/notelings/CommandDock.tsx` / manual capture UI only if copy or state clarity needs adjustment.
- Tests: relevant auth/manual E2E and a focused disclosure test.

**Interfaces:**
- Documents Gemini processing, manual/no-AI capture, demo data, deletion, and storage boundaries.
- Does not silently change whether AI is called or how note data is persisted.

- [ ] **Step 1: Document the data flow.**

  State plainly: AI-on categorization/chat sends selected note context to Google Gemini; AI-off manual capture does not call Gemini; notes are persisted in the selected Supabase project; Supabase/TLS is not end-to-end encryption; demo notes are fictional/sanitized; users should not paste secrets unless the product’s privacy contract supports them.

- [ ] **Step 2: Verify provider settings before publishing the claim.**

  Record the chosen Google/Gemini account/project retention, training, regional-processing, and data-use settings in a private deployment record. Do not claim stronger privacy than those settings support.

- [ ] **Step 3: Add only the smallest visible disclosure.**

  Prefer a compact “How your notes are handled” link or panel near auth/capture, with the full policy available separately. Preserve the Bloom layout and avoid adding a large dashboard or blocking modal without user approval.

- [ ] **Step 4: Test the contract.**

  Keep the existing manual E2E assertions: no category selector, optional tags, no categorize call, Manual response, and Needs sorting dispatch. Add disclosure visibility and AI-on/AI-off copy checks.

**Approval checkpoint:** User approves the final privacy wording and any changed first-viewport/auth/capture UI before implementation.

---

## Task 5: Bound AI, request work, and abuse before private beta

**Files:**
- Modify: `lib/apiGuard.ts` and tests.
- Modify: `lib/auth/authSchemas.ts`, `lib/notes/chatApi.ts`, note input schemas, and tests.
- Modify: `app/api/chat/route.ts`, `app/api/categorize/route.ts`, `app/api/notes/route.ts`, `app/api/notes/[id]/route.ts`, `app/api/tags/route.ts`.
- Create only after schema approval: quota/usage migration and owner-scoped database RPC/module.
- Create: focused request-limit/quota tests and route tests.

**Interfaces:**
- Produces bounded request parsing, paginated list behavior, authenticated user-aware usage accounting, and honest 429 responses.
- Must preserve current note/chat behavior for requests inside the limits.

- [ ] **Step 1: Set explicit limits from the approved budget.**

  Define and test constants for maximum request bytes, note characters, tag count/length, chat message count/characters, parts count/size, notes page size, chat context size, and provider timeout. Return 400/413/415/422 consistently and never log rejected content.

- [ ] **Step 2: Bound every list/retrieval path.**

  Keep `/api/notes` and `/api/tags` owner-scoped and explicitly limited; add stable pagination where the UI needs more than one page. Keep chat retrieval capped and prevent request history from bypassing the cap. Add/verify owner/status/created-at indexes through a separately approved migration if query evidence requires them.

- [ ] **Step 3: Design atomic quotas before writing the migration.**

  Present the user with the proposed usage schema/RPC and limits first. The preferred design is an owner-scoped usage period with atomic reservation keyed by `(user_id, action, request_id)`, a daily/monthly reset window, a concurrency ceiling, and safe release/settlement behavior on provider failure. Do not silently add a quota table.

- [ ] **Step 4: Implement quota enforcement after approval.**

  Reserve quota before Gemini, reject exhausted requests with 429 plus `Retry-After`, make retries idempotent, and retain the current in-memory limiter only as defense in depth. Use a separate hard budget for any demo AI behavior.

- [ ] **Step 5: Add cached embedding design as a separate subphase.**

  Do not reintroduce whole-vault `embedMany` without measurement. First document note-revision hash, model/version, vector ownership/RLS, missing-cache fallback, and batch/backfill policy. Ask before applying pgvector/schema changes; initial capture must not block on embedding generation.

**Approval checkpoint:** User approves the usage limits and any migration/vector design before schema edits or provider-cost behavior changes.

**Acceptance:** repeated oversized/malicious requests are rejected, exhausted quota prevents provider calls, 429s are actionable, and bounded retrieval preserves normal answers/citations.

---

## Task 6: Make persistence and delivery recovery honest

**Files:**
- Inspect/modify: `components/notelings/useSubmitNote.ts`.
- Inspect/modify: `components/notelings/useNoteSync.ts`.
- Inspect/modify: `components/notelings/useNotesRealtime.ts`.
- Modify: `lib/notes/notesApi.ts`, related route schemas, agent queue modules, and tests.
- Schema changes only after explicit approval; the existing `client_submission_id`/ownership work must be reused rather than duplicated.

**Interfaces:**
- Produces truthful saved/syncing/failed states, idempotent retry behavior, cleanup of stale timers, and startup reconciliation.
- Does not silently turn the visual robot animation into a durable worker.

- [ ] **Step 1: Audit the existing submission/idempotency contract.**

  Confirm the live `client_submission_id` column/unique behavior and trace one capture through API response, Zustand enqueue, Realtime, and status PATCHes. Add a failing regression for duplicate submission and failed network response before changing behavior.

- [ ] **Step 2: Fix the false-save path.**

  A failed network request must render as failed/not synced, not “saved.” The local visual queue may continue only with explicit copy that it is not persisted. Add retry/backoff and prevent duplicate rows with the existing submission ID.

- [ ] **Step 3: Clean up stale lifecycle work.**

  Clear every `setTimeout`/abort controller in `useNoteSync` cleanup, ignore stale callbacks by submission ID/revision, and add a test that unmount/reload cannot PATCH an old note.

- [ ] **Step 4: Reconcile on startup/reconnect.**

  Define which database states are recoverable (`pending`, `in_transit`, `filed`, `archived`) and show a sync/recovery state. On startup, reconcile rows and avoid claiming that a robot completed work when the remote state disagrees.

- [ ] **Step 5: Ask before changing the product promise.**

  If durable browser-close survival or offline-first queueing is desired, stop and present a separate schema/worker design. Do not silently add IndexedDB, a service worker, or a queue vendor in this plan.

**Approval checkpoint:** User approves any changed capture/status copy or durable-delivery behavior after reviewing the preview.

---

## Task 7: Add CI, deployment checks, and operational visibility

**Files:**
- Create: `.github/workflows/ci.yml` after repository-CI approval.
- Create: `scripts/production-smoke.mjs` if not completed in Task 3.
- Modify: `lib/observability.ts` and tests only for measured redacted fields/health needs.
- Modify: `app/error.tsx`/health route only if smoke reveals a gap.
- Documentation: `docs/DEPLOYMENT.md`.

**Interfaces:**
- Produces repeatable pull-request and preview gates without private production data.
- Uses existing observability/security-header implementation rather than adding a vendor immediately.

- [ ] **Step 1: Define CI environment policy.**

  Unit/type/lint/build jobs use no Supabase/Gemini secrets. E2E uses mocks and `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS=1` only inside the test job. Live migration/RLS tests use a separate disposable project and repository environment secrets only after the user approves CI secret setup.

- [ ] **Step 2: Add the required workflow gates.**

  Run `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev --audit-level=high`, and `CI=1 npm run test:e2e -- --workers=1`. Warm the dev server or use the known one-worker strategy so cold Turbopack timing does not create false failures.

- [ ] **Step 3: Add redacted production diagnostics.**

  Verify request IDs, route duration/status/error category, health liveness, and provider timing are available without note content, prompts, tokens, cookies, raw provider errors, or embeddings. Document how to correlate a user-visible failure without exposing private data.

- [ ] **Step 4: Add preview deployment smoke.**

  Run the public WebGL/header/auth/demo smoke against the actual Vercel Preview URL. Keep private production data out of Preview unless the owner/RLS matrix explicitly approves it.

**Approval checkpoint:** User approves GitHub Actions/CI and any repository secret configuration before workflow changes are added.

**Acceptance:** PR gates are reproducible, preview headers/auth/WebGL smoke passes, and a failed production request can be diagnosed from redacted telemetry.

---

## Task 8: Complete the next measured performance/accessibility pass

**Files:**
- Existing performance files: `components/office/OfficeCanvas.tsx`, `components/office/renderProfile.ts`, `scripts/performance-probe.mjs`, `scripts/compare-png.mjs`.
- Inspect/modify: `components/office/AgentRobot.tsx`, `components/office/AgentLayer.tsx`, graph canvas/overlay, `app/globals.css` only after measurements.
- Create only if required: `scripts/asset-reachability.mjs` or `e2e/accessibility-smoke.spec.ts`.

**Interfaces:**
- Consumes the completed first-pass performance baseline and current visual capture artifacts.
- Produces measured idle/background/device-tier improvements without changing the desktop visual baseline.

- [ ] **Step 1: Measure before changing the loop.**

  Capture idle, active delivery, graph-open, hidden-tab, reduced-motion, desktop, integrated/laptop, and real/mobile-device measurements. Track p95 frame time, idle GPU/CPU use, backbuffer, memory, GLB readiness, and screenshot deltas.

- [ ] **Step 2: Implement hidden-tab suspension first.**

  Pause expensive visual work when `document.visibilityState === 'hidden'` and resume/invalidate safely on visibility restoration. Add a browser test that the app resumes robot delivery/rendering after returning to the tab. This is lower risk than changing the shared loop.

- [ ] **Step 3: Model idle robot behavior before demand rendering.**

  Decide whether autonomous wandering is part of the showcase or only active during demo mode. Any change that removes wandering, pauses agents, or changes the robot playback contract requires user approval and a before/after visual review.

- [ ] **Step 4: Audit asset reachability before deletion/compression.**

  Identify the unused historical MP4 and legacy assets, measure deployment/download impact, and request approval before deleting or recompressing anything that could affect rollback or the portfolio narrative.

- [ ] **Step 5: Finish remaining accessibility gaps.**

  Add a semantic Knowledge Graph list/keyboard navigator, verify current focus traps/restoration, apply reduced motion consistently, and run axe/contrast checks. These are visible UX changes and require preview approval; preserve the bounded graph blur and current visual hierarchy.

**Approval checkpoint:** Any change to robot wandering, render-loop semantics, graph UI, modal behavior, or visual quality requires explicit user approval after preview screenshots.

---

## Task 9: Final release gates and dual-track launch

**Files:**
- Modify: `docs/DEPLOYMENT.md`, `README.md`, privacy/data-flow documentation, audit/handoff memory files.
- No new application source unless a prior gate identified a verified defect.

**Interfaces:**
- Produces a release decision for each deployment track, not a claim that one environment can safely serve both roles.

- [ ] **Step 1: Portfolio/demo release gate.**

  Require all of the following:

  - Separate demo Vercel/Supabase projects and environment variables.
  - Sanitized seed/reset verification passes.
  - No private project URL/key/rows reachable from demo.
  - Demo auth/read/write behavior is explicitly labeled and bounded.
  - Privacy/AI disclosure is live.
  - Production headers/health/WebGL smoke pass.
  - Desktop/mobile screenshots and performance artifacts are reviewed.
  - Full automated validation passes.
  - Rollback to the checkpoint/previous Vercel deployment is documented.

- [ ] **Step 2: Private beta release gate.**

  Require all demo gates plus:

  - Two-user auth/RLS/Realtime isolation verified in the deployed environment.
  - No anonymous private-row reads.
  - Request limits and authenticated quotas approved/implemented.
  - False-save/idempotency/reconciliation behavior tested.
  - Provider privacy settings documented.
  - Backups/restore path and incident contacts documented.
  - CI/preview gates are active.

- [ ] **Step 3: Paid-product gate.**

  Add account recovery/change flows, export/delete policy, durable monitoring/alerts, usage/billing policy, support/terms, load/cost testing, and a documented response plan for provider/database outages. Do not call the app a paid SaaS until these are explicitly accepted.

- [ ] **Step 4: Write the case study.**

  Explain the spatial interaction, GLB/navigation choices, auth/RLS boundary, demo isolation, AI privacy decision, performance measurements, visual tradeoffs, and known limitations. This turns the dual-track work into a stronger portfolio artifact without pretending the prototype has SaaS guarantees it does not yet have.

**Validation:** Each track has a pass/fail checklist, separate environment owner, rollback path, and honest public messaging.

---

## Revert and rollback policy

- **Code:** revert to `notelings-pre-dual-track-deployment-readiness-20260813` or the last approved checkpoint commit; use a Vercel previous deployment for deployed code rollback.
- **Database:** never use Git reset as a database rollback. Use a tested backup restore or a forward corrective migration after reviewing data impact.
- **Secrets:** revoke exposed/expired PATs immediately; rotate service-role, provider, demo, and owner credentials independently; never store them in memory docs.
- **Demo:** reset the demo database from sanitized seed; never repair a contaminated demo by copying private rows.
- **Visual changes:** retain before/after screenshots and reject changes that improve metrics while degrading office framing, Bloom/glass identity, robot readability, graph bounded blur, or mobile usability.
- **User approval:** pause before any schema migration, external project provisioning, quota/cost behavior, demo topology change, privacy wording, auth/capture behavior, render-loop/robot behavior, or major UI change.

## Overall acceptance criteria

- Public demo and private workspace are separate security/data environments.
- Current owner-scoped auth/RLS/manual migration remains intact and is tested after every deployment change.
- No deployment environment contains a Management API PAT or E2E bypass.
- AI provider behavior is disclosed and bounded; failed requests are not presented as saved.
- Requests, lists, retrieval, provider usage, and concurrency have explicit budgets before private beta.
- Code, database, secrets, CI, preview, health, headers, and rollback have documented owners and procedures.
- Performance/accessibility changes are measured and visually reviewed before acceptance.
- The app remains recognizable as Notelings: a visual spatial second brain, not a generic notes dashboard.
