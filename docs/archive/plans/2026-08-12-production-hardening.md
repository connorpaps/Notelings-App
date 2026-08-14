# Notelings Production-Hardening Plan

**Date:** 2026-08-12  
**Status:** Approved by user on 2026-08-12 — implementation in staged checkpoints; Phase 1 and the current bounded-controls/observability/accessibility slice are implemented locally, while live migration and deployment gates remain pending  
**Target:** Vercel + Supabase  
**Scope:** Move Notelings from a single-user visual prototype toward a safe private personal product and a separately isolated public portfolio demo, while preserving the 3D office, Librarian robots, glass UI, and Knowledge Graph identity.

> This document records the approved roadmap and its acceptance gates. Implementation has begun in staged local checkpoints after user approval; live Supabase migration, isolated demo deployment, quotas, cached embeddings, and provider/privacy verification remain explicit gates.

---

## 1. Executive recommendation

Use a staged hardening strategy rather than a rewrite:

1. **Protect identity and data first.** Add Supabase Auth/SSR sessions, an owner column, owner-scoped RLS, authenticated Realtime, and server-side authorization.
2. **Separate the portfolio demo from private data.** Prefer a second Vercel deployment backed by a separate Supabase project containing sanitized seed data. The public demo is read-only or tightly budgeted; it never points at the private workspace.
3. **Bound every expensive operation.** Add request/body limits, pagination, per-user AI quotas, idempotency, and cached/bounded retrieval before adding scale-oriented infrastructure.
4. **Make persistence honest and recoverable.** Remote persistence becomes authoritative; local UI state remains an animation/optimistic layer with explicit sync states. Clear stale timers and reconcile unfinished work on startup.
5. **Measure before reducing visual quality.** Establish desktop, integrated-GPU, mobile, and reduced-motion baselines; then use adaptive DPR/shadows/postprocessing and hidden-tab suspension. Keep the high-quality desktop profile where measurements support it.
6. **Finish accessibility and release hygiene.** Add real focus management, a semantic graph fallback, consistent reduced motion, security headers, structured redacted logging, CI gates, migration rehearsal, and a privacy/data-flow explanation.

This is primarily backend/database/security/deployment work with additive UI changes. It should not replace the visual concept with a conventional notes dashboard.

### Intended release modes

| Mode | Recommended topology | Data policy | AI policy |
|---|---|---|---|
| Private personal workspace | Private Vercel deployment + private Supabase project | Authenticated, owner-scoped, arbitrary user notes | Explicitly disclosed; provider settings verified before real sensitive notes |
| Portfolio demo | Separate Vercel deployment/alias + separate Supabase demo project | Sanitized seeded data only; read-only by default | Disabled, mocked, or strictly budgeted deterministic demo responses |

A client-side `demo=true` switch is not an authorization boundary and must not be used to expose a private tenant.

### Approved direction snapshot (2026-08-12)

- **Auth:** use the recommended Supabase Auth magic-link path unless implementation constraints require a deliberate change.
- **Demo:** use separate Vercel and Supabase projects for the public demo; private personal use is the first security boundary.
- **AI/privacy:** use disclosed Gemini processing only after provider terms/settings are verified, while adding a first-class manual/no-AI capture path. Users should be able to assign a category/tags themselves and disable AI features so note capture does not call Gemini; chat should be unavailable or clearly disabled when AI is off.
- **Delivery:** use recoverable visual playback first; database persistence, retry, and reconciliation are authoritative. A durable worker remains deferred.
- **Offline:** a full offline-first queue/sync architecture is deferred, but the product must not claim that a failed network submission was saved.

---

## 2. Current baseline and constraints

The audit found a strong, tested prototype but several public-release blockers:

- No authentication or tenant ownership.
- Anonymous Supabase SELECT access to every note.
- Unauthenticated service-role-backed reads, writes, patches, deletes, and chat retrieval.
- In-memory IP rate limiting that is not shared across Vercel instances and can be spoofed unless the edge overwrites forwarding headers.
- Unbounded list queries and repeated whole-vault embedding work for larger vaults.
- Volatile client-owned robot delivery state and fire-and-forget status PATCHes.
- No security headers/CSP, structured observability, or CI release gates.
- Heavy visual defaults: continuous rendering, DPR up to 2, 4096px shadows, SSAO, Bloom, and an approximately 18 MB active GLB.
- Incomplete dialog focus management and no semantic keyboard equivalent for the canvas graph.
- Five existing lint warnings and stale/contradictory documentation.

The existing quality baseline is green: TypeScript, 191 unit tests, 7 Playwright tests, production build, and production dependency audit. E2E should continue to run with one worker on this Windows/SwiftShader machine because parallel cold compilation is a known flake.

### Scope constraints

- Use `npm`, not yarn/pnpm.
- Do not commit secrets or edit generated output.
- Ask before installing packages or changing the database schema.
- Do not introduce authentication, encryption, a queue vendor, a rate-limit vendor, or an observability vendor silently.
- Preserve the active GLB office; `VoxelOffice_Legacy.tsx` remains out of the active path.
- Do not implement zero-knowledge/end-to-end note encryption in this pass.
- Do not claim a portfolio deployment is private until auth, RLS, route authorization, and Realtime authorization are verified against a deployed environment.

---

## 3. Revert point and working-tree safety

A local annotated checkpoint was created before this plan was written:

- **Tag:** `notelings-pre-production-hardening-plan-20260812`
- **Target:** current committed `HEAD` (`655f83b` at checkpoint creation)
- **Purpose:** provide a committed baseline for a disposable implementation branch/worktree if an implementation needs to be abandoned. Do **not** run `git reset --hard` in the current working tree until every uncommitted graph/audit/memory/untracked file has been separately committed, patched, or copied; the tag does not contain those files.

The working tree already contained uncommitted Knowledge Graph UX work, audit/memory changes, and unrelated untracked files. The checkpoint tag intentionally does **not** claim to contain those uncommitted files. They were left untouched. Before implementation starts:

1. Review and preserve the graph changes separately (prefer a user-approved commit or an explicit patch/branch snapshot).
2. Do not mix Knowledge Graph polish and security migrations in the same rollback unit.
3. Create an implementation branch from the approved baseline.
4. Make one small commit per phase/migration boundary.
5. Test rollback in a disposable Supabase project before applying any production migration.

The pre-plan checkpoint remains the rollback reference; subsequent implementation changes are intentionally kept in the working tree until the user reviews and chooses the next commit/deployment step.

---

## 4. Decisions required before implementation

The recommended defaults are listed, but these are approval gates because they change architecture or privacy behavior.

### Gate A — Authentication UX

**Recommended first release:** Supabase Auth email magic link, with a small sign-in/sign-out/account surface. Add password login or OAuth only if the user specifically needs it.

Why: it avoids storing passwords in this app, fits the existing Supabase stack, and keeps the UI addition small. The tradeoff is email-provider setup and a less immediate local demo flow.

Alternatives:

- Email + password: familiar, but adds password reset and credential UX.
- OAuth: polished, but adds provider configuration and account-linking complexity.
- Clerk/another auth provider: potentially faster UI, but duplicates the existing Supabase identity/data boundary and adds vendor coupling.

### Gate B — Demo isolation

**Recommended:** a separate public Vercel project/deployment backed by a separate Supabase project, with sanitized seed data and no private project credentials. A domain alias alone is not sufficient if it shares private environment variables or the private Supabase project.

This is stronger and easier to explain in a portfolio than a mixed-tenant public route. Treat it as a separate portfolio-release track: private personal use can proceed without the demo deployment, while the public demo must not ship until its isolation checks pass. A single-domain “Try demo / Sign in” landing page can be added later if desired, but should not be the first security boundary.

### Gate C — AI privacy behavior

Before accepting real sensitive notes, choose one of:

1. **Disclosed AI processing (recommended for first hardening pass):** clearly state that categorization/chat send selected note content to Google Gemini, verify the provider's current retention/training/region terms and project settings, and never promise end-to-end encryption. This option is blocked until that verification is documented and the user-facing disclosure is shipped.
2. **AI exclusion control:** add a per-note or workspace “exclude from AI” policy, requiring schema/UI/API changes but giving users a practical privacy escape hatch. Make this a hard gate if the product promises that some notes can remain private from the AI provider.
3. **No AI for private deployment:** keep AI disabled until a provider/privacy policy is approved.

The approved first implementation combines option 1 only after provider verification with a manual/no-AI capture path: a user can choose a category and tags without sending note content to Gemini, and AI chat is disabled or clearly unavailable when AI is turned off. A later AI-exclusion policy for individual notes remains a separate decision. The plan does not assume that Supabase encryption or HTTPS equals end-to-end encryption.

### Gate D — Delivery durability

**Recommended first release:** make database persistence authoritative, add idempotent submissions, reconcile statuses on reload, and label robot delivery as recoverable visual playback. Defer a durable background-worker queue until usage proves it is needed.

If a note must survive browser close while the robot is moving, approve a durable job model sooner; that adds schema, worker, retry, and deployment complexity.

### Gate E — Shared abuse control

**Recommended first release:** authenticated per-user quotas and atomic usage accounting in Supabase, plus a conservative local limiter as defense in depth. Do not install an external rate-limit vendor before traffic and concurrency targets are known.

For a public demo, disable arbitrary AI and writes or use a separate tightly capped demo budget. Re-evaluate an edge/shared limiter (Vercel capabilities or a managed service) if anonymous traffic or multi-instance abuse becomes a real requirement.

### Gate F — Release scale and budget

Confirm target expectations before choosing thresholds:

- Maximum private note count to support initially.
- Expected concurrent users.
- Monthly Gemini/embedding budget.
- Whether the personal deployment can be invite-only/private at first.
- Whether real private notes may be used in the portfolio-linked deployment.

The implementation should not pretend that a zero-cost hobby deployment has the same guarantees as a public SaaS.

---

## 5. Detailed implementation sequence

### Phase 0 — Baseline, inventory, and release separation

**Goal:** make the hardening work reversible and measurable before changing behavior.

Tasks:

1. Preserve/review the current uncommitted graph changes separately from this work.
2. Create an implementation branch and record the checkpoint tag in the branch notes.
3. Capture a clean baseline:
   - `npx tsc --noEmit`
   - `npm test -- --run`
   - `npm run lint`
   - `npm run build`
   - `npx playwright test --workers=1`
   - `npm audit --omit=dev`
   - browser smoke at desktop and 390×844 mobile
4. Add a small release-boundary document describing private and demo deployments, environment variables, secrets, data policy, and rollback owners.
5. Inventory the active public assets and decide which legacy assets are removable only after visual regression checks.
6. Record performance baselines before changing DPR, shadows, postprocessing, or frame loop behavior.

**Exit criteria:** reproducible baseline report, no unreviewed destructive changes, and an explicit choice for Gates A–F.

### Phase 1 — Authenticated private workspace and owner-scoped data

**Goal:** eliminate the current public data exposure and unauthenticated service-role boundary.

#### 1.1 Supabase Auth/SSR

Likely files/modules:

- `package.json` / lockfile: add `@supabase/ssr` only after approval.
- `lib/supabase/client.ts`: browser client using the public anon key.
- New server user client module: cookie-aware `createServerClient` for Server Components/Route Handlers.
- Existing `lib/supabase/server.ts`: split or rename the service-role client as an explicitly privileged admin client; keep `server-only`.
- New `middleware.ts` or repository-equivalent proxy: refresh sessions with `supabase.auth.getUser()` and propagate cookies.
- Auth callback/PKCE route with an allow-listed redirect target; sign-out and expired-session handling.
- `app/layout.tsx`, `app/page.tsx`, and a small auth surface: loading, signed-out, signed-in, and sign-out states.

Configure the email provider/SMTP behavior explicitly for the chosen environment, and test cookie refresh races, callback failure, redirect abuse, sign-out, and expired sessions. Do not use `getSession()` alone as an authorization check. Route authorization must use the verified server user returned by Supabase Auth.

#### 1.2 Ownership migration

Migration order in a disposable/staging Supabase project first. Take a Supabase backup/export and verify a restore path before changing policies. The live cutover should be a short, explicitly coordinated maintenance window with the private deployment paused or access-restricted. The owner backfill must run through a reviewed privileged transaction/script while the app is paused; do not rely on browser input to assign ownership. The final policy switch must be one reviewed atomic migration/transaction, and the global anonymous policy must never be reopened as a rollback shortcut.

1. Add `user_id uuid` to `notes` as nullable while old single-user data is inventoried/exported (`20260812_auth_ownership.sql`).
2. Create the first private owner account and explicitly backfill existing personal rows to that user ID through the approved privileged migration path; verify row counts and ownership before proceeding.
3. Add an index on `notes.user_id` and any owner/status/date indexes needed by list/retrieval queries.
4. Add `client_submission_id` or equivalent idempotency field with an owner-scoped unique constraint.
5. Deploy owner-aware route code while the private deployment remains paused. In the private staging project, test the owner policies with two users before the live switch.
6. Run `20260813_auth_cutover.sql` as one reviewed transaction: its null-owner guard must pass, it enables/validates owner-scoped policies, drops the global `anon using (true)` SELECT policy, and sets `user_id not null`. Anonymous access must not read the private project after this transaction commits.
7. Validate that signed-in reads, writes, deletes, and Realtime work before reopening the private deployment.
8. Verify downgrade/rollback strategy before production application; destructive policy changes must be reversible through a forward migration, not ad-hoc dashboard edits. If the cutover fails, keep the private deployment paused and restore from the verified backup/previous deployment rather than temporarily reopening global anon reads.

The exact SQL must be written and reviewed separately; this plan does not apply schema changes.

#### 1.3 Route authorization

Update every route so identity is established before parsing/performing data work:

- For cookie-authenticated unsafe requests (POST/PATCH/DELETE), require a strict same-origin `Origin` check; if `Origin` is absent, accept a `Referer` only when it is present, HTTPS, and exactly allow-listed, otherwise reject the request. Pair this with secure/httpOnly/SameSite cookie settings and tests for cross-site form/fetch attempts. The existing permissive `isSameOrigin` behavior is not sufficient CSRF protection because requests without `Origin` are currently allowed.
- `app/api/notes/route.ts`: authenticated owner-scoped GET/POST behavior; bounded query and stable ordering.
- `app/api/notes/[id]/route.ts`: verify owner before PATCH/DELETE; whitelist legal lifecycle transitions.
- `app/api/tags/route.ts`: derive tags only from the authenticated owner’s active notes.
- `app/api/categorize/route.ts`: authenticate before AI work and persistence; never accept owner IDs from the body.
- `app/api/chat/route.ts`: authenticate before retrieval/provider calls; retrieve only the owner’s permitted notes.
- `lib/apiGuard.ts`: retain same-origin checks as defense in depth, not as authentication.

Prefer the authenticated Supabase client for ordinary user operations so RLS is exercised. Reserve service-role access for narrowly scoped admin/demo seed or trusted jobs, with an explicit module boundary and tests preventing accidental client imports.

#### 1.4 Privacy-first manual capture path

- Add a small AI toggle/settings surface with an understandable state: AI on means selected note content may be sent to Gemini; AI off means capture must stay on the manual path.
- Let users enter/select a category and tags before submission when AI is off; validate the same category/tag limits server-side.
- Route manual capture through an authenticated owner-scoped note insert path; it must not call categorization or chat providers.
- Disable or clearly gate Librarian chat while AI is off rather than silently sending note content.
- Keep a truthful privacy notice near the setting; this is not full offline mode because the note still requires a network connection to persist remotely.

**Acceptance:** an AI-off note submission produces one owner-scoped row with user-provided category/tags and zero Gemini calls; AI-off chat cannot send note context; AI-on behavior remains covered by the provider disclosure gate.

#### 1.5 Realtime authorization

- Subscribe with the authenticated browser session.
- Remove anonymous full-table Realtime access.
- Verify owner-scoped Postgres Changes/RLS behavior with two test users.
- Keep the existing channel cleanup contract and add auth-refresh/reconnect coverage.

**Phase 1 acceptance:**

- Signed-out users cannot read, mutate, or subscribe to private notes.
- User A cannot read, update, delete, count, retrieve, or receive Realtime events for User B.
- Direct Supabase anon-key queries cannot read private notes.
- Service-role usage is limited to documented trusted paths.
- Auth refresh, sign-out, and expired-session behavior are tested in browser and route tests.
- Private deployment has no demo seed data mixed into the personal tenant.

### Phase 2 — Demo mode as a separate, safe product surface

**Goal:** make the portfolio experience easy to try without weakening private security.

Recommended topology:

- Second Supabase project/database with sanitized notes only.
- Separate Vercel project/deployment built from the same repository; a domain alias may point to it, but must not be the only separation.
- Separate environment variables and service-role secret; never expose private project URLs/keys to demo users.
- Demo routes use read-only data, seeded deterministic responses, or a small isolated AI budget.
- No “switch tenant” parameter accepted from the browser.

UI additions should be lightweight:

- Landing choice: “Try the demo” and “Sign in to your workspace.”
- Persistent mode label in the header/account surface.
- Demo disclosure: data is fictional/sanitized and changes may reset.
- If demo writes are allowed, make them ephemeral and rate-limited in the demo project only.

**Acceptance:** a public demo URL cannot observe, query, mutate, or infer private-project data; a private user cannot be routed into demo credentials; E2E tests assert the deployment/config boundary.

### Phase 3 — Bound requests, retrieval, AI cost, and abuse

**Goal:** prevent a valid authenticated user or public attacker from turning note/chat features into an availability or billing incident.

#### 3.1 Request limits and validation

- Enforce request byte limits before expensive parsing where practical.
- Add maximum note content length, tag count/tag length, history message count, message length, and parts count/size to the existing Zod schemas.
- Reject unsupported content types and malformed JSON consistently.
- Return stable 400/413/415/422 errors without leaking provider/database details.
- Add timeouts/abort signals around provider and database work.

#### 3.2 Pagination and query budgets

- Add cursor or page pagination to `/api/notes` with an explicit maximum page size.
- Bound `/api/tags` and return only fields needed by the UI.
- Never use unbounded `select('*')` for user-facing list/retrieval paths.
- Define an active-note context cap and a graph note/node cap or aggregation behavior for large vaults.
- Add indexes aligned with owner/status/created-at and tag access patterns.

#### 3.3 Cached embeddings and bounded retrieval

Keep the current pure similarity-ranking behavior as a fallback, but stop embedding the entire vault on every chat request:

1. Add a note-revision/content hash.
2. Persist one embedding per eligible note revision in a dedicated owner-scoped table or approved vector column, with `user_id`, content hash, embedding model/version, and dimension recorded as part of the data contract. Apply RLS to the embedding rows; vectors are sensitive derived data and must not become a new cross-user read path.
3. For the first implementation, do **not** generate embeddings synchronously on note submission and do not block capture on a worker that does not yet exist. Persist an embedding status/hash and use already-cached vectors during chat; embed the query once, rank a bounded set of cached vectors, and fall back to a bounded newest/lexical set when vectors are missing. A separately approved script or cron can backfill missing vectors in small batches later.
4. Query top-K candidates with a vector index when scale justifies it; until then, keep the existing deterministic in-process similarity logic over a bounded cached candidate set. Until an initial cache exists, the chat path must use the bounded fallback rather than silently reintroducing whole-vault `embedMany`.
5. Invalidate/recompute only when note content/tags/model changes.
6. Keep deterministic newest-first fallback when embeddings are unavailable or a provider call times out.
7. Measure retrieval at 0, 150, 1,000, and 10,000 notes before choosing embedding dimensions, HNSW/IVFFlat, a backfill worker, or another service.

Do not add a vector vendor merely because it is fashionable. The first requirement is cached, bounded retrieval with a cost ceiling and a non-blocking capture path.

#### 3.4 Quotas and rate limits

- Add an atomic per-user usage/quota record for categorization, chat, and embedding operations.
- Reserve usage in a Postgres transaction/RPC before calling Gemini, with a unique request/action key so retries cannot double-charge; define the UTC reset window, concurrent reservation behavior, and release/settlement behavior for provider failures.
- Enforce daily/monthly action ceilings and a concurrency ceiling before calling Gemini.
- Return 429 with `Retry-After` and a user-safe message.
- Retain the in-memory limiter as defense in depth only.
- For the public demo, use no arbitrary private-data AI and a separate hard cap.
- Re-evaluate shared edge/IP controls after traffic measurements; no rate-limit service is selected or installed by this plan.

#### 3.5 AI privacy and prompt-injection boundaries

- Treat note text as untrusted data, never as instructions.
- Add adversarial prompt-injection fixtures to chat/categorization tests.
- Redact obvious secrets only if the redaction is reliable; do not claim a regex is complete DLP.
- Document provider retention/training/region settings and link the privacy explanation in the UI.
- Add a per-note or workspace AI-exclusion decision in the next privacy review if users need notes that remain searchable locally but never leave the app.

**Acceptance:** fixed-size malicious requests are rejected, list/retrieval work is bounded, repeated chat does not re-embed unchanged notes, quota tests prevent provider calls after exhaustion, and prompt-injection tests preserve system safety/refusal behavior.

### Phase 4 — Persistence honesty, idempotency, and recovery

**Goal:** ensure the UI never implies a remote save that did not happen.

Likely areas:

- `components/notelings/useSubmitNote.ts`
- `components/notelings/useNoteSync.ts`
- `components/notelings/useNotesRealtime.ts`
- `lib/notes/notesApi.ts`
- `lib/notes/types.ts`
- `components/office/useTaskDispatcher.ts` / related agent state modules
- notes migrations and route tests

Tasks:

1. Generate a client submission ID per capture and send it with the request.
2. Make server insert idempotent for `(user_id, client_submission_id)`.
3. Do not label a failed network request “saved”; show “not synced” or “queued locally.”
4. Make remote note state authoritative and expose `saved`, `syncing`, `failed`, and `offline` states.
5. Clear all delayed timers in `useNoteSync` cleanup and cancel stale/aborted requests.
6. Reconcile pending/in-transit notes on app startup and after reconnect.
7. Whitelist and validate status transitions server-side.
8. Add retry with backoff and an explicit retry action; avoid duplicate rows.
9. Decide whether the robot delivery is ephemeral playback or a durable job. The recommended first step is recoverable playback; a durable worker is deferred until required.
10. Add export/delete/recovery semantics to the product documentation before calling the data layer dependable.

**Acceptance:** reloads do not create duplicates, failed writes are visible as failed, retries converge to one note, stale timers cannot patch old work after unmount, and a startup reconciliation test covers interrupted delivery.

### Phase 5 — Security headers, observability, and release controls

**Goal:** make failures diagnosable and reduce browser/platform attack surface without exposing note content.

#### 5.1 Headers/CSP

Add a tested baseline through `next.config.ts` or middleware/proxy, depending on the final nonce and deployment strategy:

- Content-Security-Policy tailored to Next.js, Supabase, Gemini/AI endpoints, required fonts/images, and WebGL.
- `Strict-Transport-Security` only after HTTPS/subdomain behavior is verified.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy` with a privacy-preserving value.
- `Permissions-Policy` disabling unused capabilities.
- Clickjacking protection via `frame-ancestors`/appropriate headers.

Test actual production headers, not only local development. Avoid `unsafe-eval` unless a measured dependency truly requires it; if a temporary exception is unavoidable, document and reduce it.

#### 5.2 Redacted structured logging

Start with a small internal logger and request ID rather than installing a monitoring vendor immediately:

- Log route, status, duration, request ID, provider operation, and error category. Avoid user identifiers unless a documented retention/PII policy explicitly approves a stable opaque dimension.
- Never log note content, note-derived labels, prompts, tokens, auth cookies, raw request bodies, provider raw errors, or embeddings.
- Capture AI latency, timeout, retry, token/embedding usage where provider metadata permits.
- Add an authenticated health/readiness endpoint that does not reveal secrets or private note data.
- Add an error boundary and safe client error state.

After redaction is tested, evaluate Vercel logs plus a privacy-configured error tracker (or another approved service). No vendor is selected by this plan; the Gravity research did not produce a sufficiently specific observability recommendation.

#### 5.3 CI/deployment gates

Add a GitHub Actions workflow only after the user approves repository CI changes:

- install from lockfile
- TypeScript
- unit tests
- lint with an explicit warning policy
- production build
- `npm audit --omit=dev --audit-level=high`
- Playwright with one worker and warmed/known server strategy
- accessibility smoke using axe after the dependency decision
- migration rehearsal against a disposable Supabase project or local Supabase CLI
- authorization matrix tests
- optional Lighthouse/performance budget on a preview deployment

Use Vercel preview deployments for UI smoke, but never point previews at real private data unless authorization and environment isolation are explicit.

**Acceptance:** a pull request cannot merge with type/test/build/security-gate failures; production logs contain correlation IDs but no note content; headers are asserted against the deployed URL; rollback instructions are tested.

### Phase 6 — Measured performance without visual regression

**Goal:** preserve the desktop visual identity while reducing idle and low-end cost.

#### 6.1 Baseline first

Measure at minimum:

- First-load JS and GLB transfer/decode time.
- LCP/INP/CLS and time to usable note capture.
- 95th-percentile frame time and idle CPU/GPU use.
- GPU memory and draw-call/frame behavior where available.
- Chat/categorization p95 latency and provider cost.
- Graph open time and redraw time at 100/500/1,000 notes.
- Desktop capable GPU, integrated GPU/laptop battery profile, iPhone-class mobile, and reduced-motion mode.

Set budgets from observed baselines plus a deliberate target; do not invent a universal FPS number that ignores device tiers.

#### 6.2 Adaptive rendering

Likely areas:

- `components/office/OfficeCanvas.tsx`
- `components/office/NewOfficeScene.tsx`
- `components/office/AgentRobot.tsx`
- graph overlay/canvas components
- global reduced-motion CSS and motion hooks

Implement progressively and compare screenshots/interaction contracts after each step:

1. Pause or suspend expensive work when `document.visibilityState === 'hidden'`.
2. Use device-tier quality profiles: desktop-high, desktop-balanced, mobile-low, reduced-motion.
3. Start DPR conservatively (likely 1 on low/mobile) and adapt only when measurements support it.
4. Lower shadow map/SSAO/Bloom quality on low tiers; keep high quality on capable desktop.
5. Avoid changing to `frameloop="demand"` blindly because robot movement needs continuous frames. Model active animation state and invalidate/render only while robots/camera/transitions require it.
6. Ensure shared geometry/materials, memoized static scene data, and no `setState` in `useFrame`.
7. Lazy-load the graph and non-critical UI as already established; cap graph density or offer a list/search fallback for large vaults.
8. Remove or archive unused production assets only after reachability and visual checks; audit the 18 MB GLB and unused 12 MB legacy video.
9. Keep transitions transform/opacity-only and preserve the bounded graph blur; do not add full-screen blur or extra always-on effects.

**Visual acceptance:** desktop screenshot diffs preserve the office, Bloom/liquid-glass identity, robot scale/paths, graph bounded blur, equal side insets, and note readability. Mobile remains usable and does not gain a full-screen opaque graph treatment.

### Phase 7a — Accessibility, privacy disclosure, and honest states (required hardening)

**Goal:** make the experience understandable and usable beyond pointer-driven happy paths. Focus management, keyboard access, reduced motion, privacy disclosure, and honest sync states are release hardening.

Tasks:

- Replace or augment `GlassModal` with a tested focus manager: initial focus, Tab containment, Escape, restore focus to the trigger, and inert/blocked background controls.
- Give the Knowledge Graph a semantic list/table view with note/tag names, counts, and keyboard selection; canvas remains the visual view.
- Add graph legend, zoom/reset/close affordances, and a short “select a node to inspect” hint without cluttering the scene.
- Apply one reduced-motion policy to modal, graph, chat, Kanban, welcome, and office transitions.
- Run axe on signed-out, signed-in, graph-open, side-peek, chat, tag explorer, error, and mobile states.
- Measure contrast for translucent text over the static frame and graph surface; fix only verified failures while preserving hierarchy.
- Add visible sync state, retry, and safe deletion/recovery language.
- Add privacy/data-flow copy: what stays in Supabase, what is sent to Gemini, how demo data differs, and how deletion works.
- Resolve the five lint warnings and contradictory GLB/DPR/graph-bound documentation.

**Acceptance:** keyboard-only graph/modal flows pass, axe findings are triaged, reduced motion is consistent, privacy language is visible, and sync/delete behavior is tested.

### Phase 7b — Product escape hatches and portfolio finish (deferred P2)

These are valuable product improvements but must not delay the security/reliability release gates:

- Export notes as JSON/Markdown; consider import only after format/version semantics are defined.
- Add bulk archive/recovery, richer graph navigation, and large-vault search/aggregation.
- Update README/case study with the architecture diagram, threat-model boundaries, measured performance, tradeoffs, and known limitations.
- Add portfolio-specific screenshots and a sanitized demo walkthrough.

**Acceptance:** these are separately prioritized and can ship after the private security boundary is verified.

---

## 6. Explicitly deferred work

These are intentionally not part of the first hardening sequence unless a decision gate reopens them:

1. **Zero-knowledge/end-to-end encryption.** It would prevent server-side categorization, chat retrieval, embeddings, and ordinary search unless the architecture is redesigned around client-side keys/compute. It also creates key-loss and recovery problems. Revisit only after the AI/privacy product contract is settled.
2. **A separate queue/background-job vendor.** First make persistence/idempotency/reconciliation correct. Add durable jobs only if browser-close survival and throughput require it.
3. **An external rate-limit vendor.** First use authenticated quotas and measured edge controls. Avoid adding cost/vendor coupling without traffic data.
4. **A second auth provider.** Supabase Auth matches the existing database and Realtime boundary; Clerk/Better Auth should only be reconsidered if Supabase Auth UX becomes a demonstrated blocker.
5. **Full offline-first capture and sync.** Manual/no-AI capture is approved now, but IndexedDB/service-worker queueing, conflict resolution, and background sync should wait until the online private path is secure and reliable.
6. **Broad visual redesign or replacing R3F.** The office and graph are the product differentiators; improve quality adaptively, do not flatten the experience.
7. **Full production multi-region architecture.** Not justified until real concurrency, latency, and revenue requirements exist.
8. **Automated DAST, Snyk/Socket enterprise monitoring, and extensive RUM.** Valuable later, but first establish auth/RLS, CI, redacted logs, dependency audit, and measured budgets.
9. **Large graph visualization upgrades.** Keep the frozen layout and add caps/list fallback before considering clustering or a different graph engine.

---

## 7. Test and acceptance matrix

### Security/data

- Signed-out route matrix: GET/POST/PATCH/DELETE/chat/tags all reject appropriately.
- Two-user isolation: no cross-user row, tag, chat, citation, Realtime, or ID-based mutation access.
- Direct anon-key database reads cannot retrieve private notes.
- Demo deployment cannot reach private project data.
- Service-role imports are server-only and limited to approved paths.
- Security headers/CSP pass against deployed preview.
- Request-size, schema, quota, timeout, and 429 behavior are covered.

### Reliability

- Duplicate submission IDs converge to one row.
- Network failure is not shown as saved.
- Retry/backoff and startup reconciliation converge.
- Timers/abort controllers are cleaned up on unmount.
- Legal status transitions are enforced server-side.
- Delete/export semantics are documented and tested.

### Performance/visual

- Baseline and post-change metrics exist for desktop, integrated GPU, mobile, and reduced motion.
- Office and graph remain visible/usable; bounded graph blur stays local to the graph surface.
- No regression to robot paths, carried note, camera, Bloom, glass UI, or graph selection.
- Idle/background rendering cost decreases or is proven acceptable by measurement.
- GLB transfer/decode and graph open budgets are recorded.

### Accessibility/product

- Keyboard can open/close graph, select a node, inspect/edit a note, close side peek, and return focus.
- Semantic graph fallback contains the same meaningful note/tag information.
- Axe scan has no untriaged critical/serious findings in release states.
- Reduced motion is honored across overlays and office transitions.
- Capture, sync, AI degraded, offline, retry, export, and delete states are understandable.

### Release

- Fresh-schema migration rehearsal passes.
- Upgrade migration rehearsal passes from the current schema.
- Preview and production env vars are isolated.
- CI runs required gates and does not use real private data.
- Vercel timeout/region/streaming behavior is verified against actual plan limits.
- Rollback to the checkpoint/previous release is documented and tested in staging.

---

## 8. Recommended execution order after approval

1. Resolve Gates A–F and approve package/schema/service changes.
2. Preserve current uncommitted graph work separately; create the implementation branch.
3. Run Phase 0 baseline.
4. Implement Phase 1 auth/RLS/route authorization in a disposable Supabase project.
5. Add and test the approved manual/no-AI capture path and AI setting without weakening the private boundary.
6. Verify cross-user isolation and deploy a private preview.
7. Implement Phase 2 demo isolation and deploy a sanitized demo preview.
8. Implement Phase 3 limits, quotas, and cached retrieval.
9. Implement Phase 4 idempotency/recovery and honest sync UI.
10. Implement Phase 5 headers, redacted observability, and CI gates.
11. Measure and implement Phase 6 adaptive performance.
12. Finish Phase 7 accessibility, escape hatches, and portfolio documentation.
13. Run the full release matrix and update `handoff.md`, `knowledge.md`, and `docs/lessons-learned.md` after each substantial phase.

Each phase should end with a review checkpoint, focused tests, full baseline validation where practical, and a small reversible commit. No production migration should run before staging migration and authorization tests pass.

---

## 9. Research used for this plan

### Primary documentation

- [Supabase Auth SSR with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Vercel Route Handlers](https://vercel.com/docs/functions/route-handlers)
- [React Three Fiber performance/scaling](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)
- [Supabase pgvector/vector columns](https://supabase.com/docs/guides/ai/vector-columns)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### Additional skill/tool research

The repository already has local guidance for Next/React, R3F, UI quality, systematic debugging, Supabase/Postgres, and performance. Community candidates researched but not installed:

- Cloudflare `web-perf` and related skills: useful performance guidance, but the app is hosted on Vercel and the local skills cover the immediate work.
- Addy Osmani `web-quality-audit`: useful Lighthouse/Core Web Vitals/accessibility checklist; adopt later as a CI review aid.
- `axe-core`/`axe-playwright`: high-signal runtime accessibility testing; adopt after the first auth/UI states exist and package approval.
- GitHub Dependabot plus `npm audit`: low-friction supply-chain monitoring; Dependabot can be added with CI approval.
- Lighthouse CI: useful after a stable preview deployment and measured budgets exist.
- OWASP ZAP/DAST, Snyk, Socket, Arcjet, and similar services: defer until the basic authorization boundary, request limits, and traffic model are real.

The Gravity Index research did not identify a sufficiently specific privacy-safe observability recommendation. It surfaced existing Supabase/Vercel infrastructure and generic auth/background-job options; no service was installed or selected. The plan therefore starts with internal redacted logs, Vercel logs, authenticated quotas, and explicit measurement rather than premature vendor adoption.

---

## 10. Final decision summary

The plan is intentionally conservative about visible change:

- **Preserved:** office, robots, Bloom, glass UI, graph, side panels, note capture, and the portfolio story.
- **Added visibly:** sign-in/session state, private/demo labeling, honest sync/privacy states, accessibility fallbacks, and a few recovery/export affordances.
- **Changed primarily behind the scenes:** Auth, RLS, route authorization, request/cost bounds, retrieval caching, idempotency, headers, logging, CI, and adaptive rendering.
- **Deferred:** zero-knowledge encryption, broad redesign, queue/rate-limit/observability vendor installs, and scale architecture without measured need.

Implementation should start only after the user approves this plan and answers the decision gates. 
