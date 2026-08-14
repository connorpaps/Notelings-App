# Notelings — Production Readiness Audit

**Audit date:** 2026-08-12  
**Scope:** current repository, current uncommitted Knowledge Graph UX changes, local running app at `http://localhost:3000`, and the stated goal of a polished portfolio/resume product that could eventually serve real users.

> **Executive verdict:** Notelings is a strong, visually distinctive interactive prototype and a credible portfolio demo. It is **not production-ready as a public product** today. The test/build discipline is better than the security and product architecture: the app can render and behave correctly while still exposing every note, accepting unauthenticated mutations, and allowing unbounded AI/database work.

This is a codebase and product-readiness audit, not a penetration test, formal WCAG conformance audit, threat model sign-off, or load test. Findings are labeled as **Confirmed**, **Inferred**, or **Needs measurement** so the report does not pretend to know what has not been tested.

### Review direction captured after the audit

The intended product direction is now a **dual-mode Vercel + Supabase app**: authenticated private workspaces where users may store arbitrary personal/private notes, plus a separately isolated portfolio-demo experience. This is feasible, but the demo must never be a client-side switch that bypasses authorization or exposes a private tenant. Use a separate demo tenant/project or deployment with sanitized seeded data and server-enforced demo permissions.

A personal login is necessary but not sufficient: it must be paired with verified server sessions, an owner key on every note, authenticated Realtime, and RLS policies based on `auth.uid()`. Supabase transport and database encryption are baseline protections; they are not end-to-end encryption. The current Gemini flow receives note/chat content in plaintext, so provider retention/training settings, disclosure, redaction, and prompt-injection handling remain part of the privacy design. Application-level/zero-knowledge encryption can be considered later, but it would materially change server-side AI, search, and retrieval behavior and should not be bolted on casually.

---

## 1. Scorecard

| Area | Current verdict | Score | Why |
|---|---:|---:|---|
| Build and type safety | Good prototype discipline | 7/10 | TypeScript, build, unit, and E2E checks are green. |
| Feature correctness | Good on tested happy paths | 7/10 | Core loop, graph, archive, and degraded path are covered, mostly with mocks. |
| Public security | Release blocker | 2/10 | No authentication or tenant isolation; service-role APIs are unauthenticated. |
| Privacy | Release blocker for real notes | 2/10 | Anonymous Supabase reads can expose the entire `notes` table. |
| Performance | Impressive but expensive | 5/10 | 3D quality is high, but continuous rendering and heavy assets/settings are hostile to mobile and low-end hardware. |
| Reliability | Prototype-grade | 4/10 | Client-owned queue/status sync is volatile; retry/idempotency and durable jobs are absent. |
| Accessibility | Partial foundation | 5/10 | Useful ARIA labels and Escape paths exist, but dialogs and canvas graph interactions are not fully keyboard-accessible. |
| Product clarity | Memorable concept, narrow utility | 5/10 | The animation is compelling; the everyday note-management value and escape hatches need strengthening. |
| Deployment/operations | Incomplete | 3/10 | No headers/CSP, structured observability, budgets, CI gates, or production health model were found. |

### What the score means

- **Portfolio demo:** close, after release hygiene and a measured visual/performance pass.
- **Private personal deployment:** possible with a strict threat model and sanitized/private infrastructure, but the current API boundary is still risky.
- **Public multi-user SaaS:** not close until identity, authorization, RLS, cost controls, and durable data ownership are redesigned.

---

## 2. What is already strong

These are real strengths, not compliments for their own sake:

1. **The interaction is differentiated.** A note physically traveling through an office is memorable and gives the project a clear portfolio story.
2. **The active scene is deliberately audited.** The GLB, navigation grid, destinations, robot state machine, and render profile have extensive baseline tests.
3. **Input schemas exist at important boundaries.** Note content, categorization responses, note patches, and chat request shapes use Zod rather than trusting arbitrary JSON.
4. **The service-role module is marked server-only.** `lib/supabase/server.ts` uses `import 'server-only'`, reducing accidental client bundling risk.
5. **Realtime cleanup is handled.** `useNotesRealtime` removes its channel on cleanup, which avoids a common StrictMode/socket leak.
6. **The degraded AI path is thoughtfully designed.** A categorization failure still persists/dispatches when the route succeeds, and the user gets a visible error state.
7. **The graph fixes addressed actual UX failures.** Close layering, bounded blur, stable hover behavior, larger/color-coded hit areas, and frozen-layout regression coverage are present.
8. **Current automated baseline is green.** At audit time:
   - `npx tsc --noEmit`: passed
   - Vitest: **30 files / 191 tests passed**
   - `npm run lint`: passed, **0 errors / 5 warnings**
   - `npm run build`: passed; 8 routes generated
   - Playwright: **7/7 passed** with one worker in about 4.7 minutes
   - `npm audit --omit=dev`: **0 known production vulnerabilities**
9. **No tracked secret files were found.** `.env.example` is tracked; actual environment files are not.
10. **The live smoke was clean.** Desktop and 390×844 mobile smoke tests opened/closed the graph, kept the office visible, and reported zero application console/page errors.

These strengths make the app worth finishing. They do not remove the security and lifecycle blockers below.

---

## 3. Release-blocking findings

### P0 — No authentication or tenant isolation

**Status:** Confirmed.  
**Evidence:** `MASTER_SPEC_FINAL.md` §7 explicitly says no authentication; `supabase/schema.sql` describes a single-user/no-auth schema; every API route calls `createServerSupabase()` with the service-role key; there is no user ID column or auth check.

**Impact:** Anyone who can reach the deployment can potentially operate on the same vault. This is not merely “no login UI”: there is no server-side identity to authorize against. The current architecture cannot safely become multi-user by adding a login screen later.

**Required direction:** Decide whether this remains a private/single-user demo or becomes a real product. For a real product:

- Add Supabase Auth and a `user_id`/owner key to notes.
- Require a verified session in every route.
- Enforce `auth.uid() = notes.user_id` in RLS `USING` and `WITH CHECK` policies.
- Prefer the authenticated Supabase client for ordinary user operations; reserve service role for narrowly scoped trusted jobs.
- Add authorization tests for cross-user read, update, archive, delete, realtime, and chat retrieval.

**Honest boundary:** This was an intentional MVP non-goal. It is still a **public-release blocker**, not a bug that can be waved away.

---

### P0 — Anonymous users can read the entire notes table

**Status:** Confirmed.  
**Evidence:** `supabase/migrations/20260812_security_hardening.sql` drops write access but creates:

```sql
create policy "notes_anon_read" on public.notes
  for select to anon
  using (true);
```

The browser ships `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `useNotesRealtime` subscribes as anon. The migration comments correctly admit this protects write integrity, **not confidentiality**.

**Impact:** Any person with the project URL/anon key can query all notes directly through Supabase. Notes are likely personal and may contain tasks, finances, work details, or secrets pasted by a user. This alone makes a public deployment unsafe for real data.

**Required direction:** Remove the global anon SELECT policy when auth lands and scope rows by owner. Until then, do not advertise the deployed app as private; use sanitized seed data or keep the project private.

---

### P0 — Unauthenticated service-role API routes allow arbitrary operations

**Status:** Confirmed.  
**Evidence:** `app/api/categorize/route.ts`, `chat/route.ts`, `notes/route.ts`, `notes/[id]/route.ts`, and `tags/route.ts` use the service-role client, which bypasses RLS. There is no session/auth check. `PATCH /api/notes/[id]` accepts lifecycle status and `DELETE /api/notes/[id]` permanently deletes rows.

**Impact:** A caller who knows the endpoint can:

- Insert notes through `/api/categorize`.
- Read the full vault through `/api/notes`, `/api/tags`, or `/api/chat`.
- Change arbitrary note content/status by ID.
- Delete arbitrary rows by ID.
- Spend the owner’s Gemini budget through chat/categorization.

The `isSameOrigin` helper is an anti-cross-site convenience check, not authentication: requests without an `Origin` header are explicitly allowed, so scripted HTTP clients can call these routes directly.

**Required direction:** Authenticate and authorize before any service-role operation. If the app deliberately stays single-user, put it behind a real deployment-level access control or private network boundary rather than treating Origin checks as a secret.

---

### P0 — AI and data work is unbounded enough to become a cost/availability incident

**Status:** Confirmed.  
**Evidence:**

- `/api/notes` does `.select('*')` with no limit or pagination.
- `/api/tags` reads every live row’s tags.
- `/api/chat` reads all active notes with no database limit.
- Above 150 notes, `retrieveRelevantNotes` calls `embedMany` on **every active note on every chat request**, plus a query embedding. There is no persisted embedding cache.
- `ChatRequestSchema` has no maximum message count, message length, or `parts` size; `parts` is `z.array(z.unknown())`.
- `/api/chat` sends up to 20 normalized history messages and up to 150 notes into the prompt; the request body itself can be larger before that pruning.

**Impact:** Latency and provider cost grow with vault size. Repeated chat requests can repeatedly embed the entire vault. Large request bodies can consume memory before application-level limits apply. A public unauthenticated route turns this into an abuse and billing risk.

**Required direction:**

1. Put hard limits on request bytes, message count, message characters, and parts.
2. Paginate notes and cap every list endpoint.
3. Generate/store embeddings once per note revision, then query a vector index (for example pgvector) or another bounded retrieval service.
4. Add per-user and global provider budgets, concurrency limits, timeout telemetry, and `Retry-After` on 429 responses.
5. Test retrieval at 0, 150, 1,000, and 10,000 notes with latency and cost budgets.

Do not add a vector database just for fashion; the important requirement is **bounded, cached retrieval**, not a particular vendor.

---

## 4. High-priority security and reliability findings

### P1 — Current rate limiting is not a production abuse control

**Status:** Confirmed.  
`lib/apiGuard.ts` uses an in-memory `Map`, capped at 10,000 buckets, keyed by an IP extracted from `x-forwarded-for`/`x-real-ip`.

Problems:

- State disappears on restart/cold start and is isolated across serverless instances.
- Unless the hosting proxy overwrites forwarding headers, a caller can rotate/spoof the header and bypass buckets.
- Only `/api/chat` and `/api/categorize` are limited; read and destructive note routes are not.
- 429 responses do not include `Retry-After`.
- There is no authenticated user key or global spend ceiling.

Use a trusted edge/proxy plus a shared limiter keyed by user and IP after auth. Keep the local limiter as defense in depth, not the primary boundary.

### P1 — Client-owned delivery state is volatile and can lie about persistence

**Status:** Confirmed/inferred from implementation.  
The agent queue, robot movement, and archive workflow live in Zustand/client memory. `useNoteSync` fire-and-forgets PATCH requests; failures only write a terminal log. A browser close, reload, crash, or offline interval can lose the in-flight physical workflow while the database remains at an earlier status.

The network-failure branch in `useSubmitNote` is especially misleading: it enqueues a local-only task and displays “note saved as Uncategorized,” even though the request failed and no database row was created.

There is also a concrete lifecycle bug in `useNoteSync`: delayed `setTimeout`s are stored in `inTransitTimers`, but the effect cleanup only unsubscribes from Zustand and does not clear those timers. A component unmount/reload can therefore leave a stale callback that PATCHes an old note after the UI that scheduled it is gone.

Other consequences:

- Retrying a submission can create duplicate notes because there is no idempotency key.
- Status transitions are not enforced as a database state machine.
- A reload can leave `pending`/`in_transit` rows with no worker able to finish them.
- Archive completion can fail to persist while the local robot animation appears successful.

For a personal visual demo, document this as an intentional ephemeral animation. For a real product, persist job state, add idempotent submission IDs, reconcile on startup, and run durable server-side jobs or an explicit recoverable client queue.

### P1 — Missing security headers and CSP

**Status:** Confirmed.  
`next.config.ts` is effectively empty, and no `middleware.ts`/`proxy.ts` header policy was found. No implementation was found for CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or clickjacking protection.

Add a tested baseline at the hosting edge. Be careful with Next.js/R3F/AI connections: a CSP must explicitly allow only the required script/style/connect/image/font sources, ideally with nonces where the deployment model permits it. Enable HSTS only once HTTPS and subdomain behavior are correct.

### P1 — No production observability or incident controls

**Status:** Confirmed.  
Operational failures rely on `console.error` and user-facing generic toasts. No error boundary, structured logger, request IDs, tracing, provider usage metrics, uptime/health endpoint, alerting, or cost dashboard was found.

At minimum, production needs:

- A server error tracker with sensitive payload redaction.
- Structured request logs with correlation IDs and route latency.
- AI call duration, timeout, token/embedding usage, and degraded-rate metrics.
- Database/realtime connection health and queue reconciliation metrics.
- Alerts for 5xx/429 spikes, provider failures, and spend thresholds.

### P1 — Manual schema operations and deployment assumptions are fragile

**Status:** Confirmed.  
The migration files instruct the operator to run SQL manually in the Supabase Dashboard. No CI migration check, deployment verification, or hosting target contract was found in the inspected tree. Routes declare `maxDuration` values of 30 or 60 seconds, but the acceptable timeout, streaming behavior, region, cold-start profile, and environment-variable setup depend on the eventual host.

Before release, choose the host and verify its function limits, streaming support, region latency, secret injection, logs, and rollback behavior. Put migrations in a repeatable deployment path and run a clean-schema plus upgrade-path smoke test in CI. Manual SQL may be acceptable for an experiment; it is not a reliable production release process.

### P1 — Data lifecycle and retention are undefined

**Status:** Confirmed/inferred.  
There is a “Delete forever” UI action, but no documented retention policy, export/backup policy, recovery process, or privacy statement. The database grows forever unless the user manually deletes rows; list and retrieval cost grows with it.

Define retention, export (JSON/Markdown), deletion semantics, backups, restore testing, and what is sent to Gemini. Treat note contents as sensitive by default.

### P1 — AI-provider privacy and prompt-injection policy is missing

**Status:** Confirmed data flow; policy risk needs an explicit product decision.  
Note content and chat context are sent to Google Gemini through the AI SDK. The repository does not document provider retention/training settings, consent, redaction, regional processing, or how users should handle secrets in notes. Note content is also untrusted input inside a grounded prompt: a note can contain instructions designed to manipulate the Librarian. The current system prompt helps, but it is not a security boundary.

Before real users store sensitive material, document the provider data terms/configuration, prohibit or redact secrets, treat note text as untrusted data, add adversarial prompt-injection tests, and make the AI data flow visible in the privacy UX. Do not promise “private notes” without verifying the provider and hosting settings.

---

## 5. Performance findings

### P1 if mobile/low-end support is a launch requirement; otherwise P2 pending measurement — The visual quality budget is expensive by default

**Status:** Confirmed settings; user impact needs real-device measurement.  
`components/office/OfficeCanvas.tsx` currently combines:

- `frameloop="always"` even while idle.
- `dpr={[1, 2]}` (the comment describes a CSS-resolution cap, but the code permits DPR 2 on high-density devices).
- 4096×4096 soft shadow maps.
- EffectComposer with SSAO at 32 samples/4 rings, Bloom, and ToneMapping.
- A continuously animating robot layer and ambient UI motion.

The current scene is beautiful on a capable desktop, but this is a poor default for phones, laptops on battery, integrated GPUs, and browser background tabs. The previous measured optimization note claiming `dpr={1}` is now stale relative to the current source.

**Required direction:** Establish device-tier render profiles and measure real Chrome GPU usage/FPS/frame time on desktop, integrated graphics, iPhone-class mobile, and reduced-motion mode. Likely improvements include DPR 1 by default, lower shadow/SSAO quality on mobile, disabling postprocessing on low-tier devices, pausing/suspending when hidden, and invalidating only when animation requires it. Do not blindly change `frameloop` to demand while robots are moving; model the state transitions first.

### P1 — Large assets and legacy assets inflate the download/deployment surface

**Status:** Confirmed.  
The `public` tree is about **39 MB**. The active GLB is about **18 MB** and `public/videos/bloom-background.mp4` is about **12 MB**, despite the active runtime using a static JPG frame rather than the video. There are also legacy OBJ/preview assets.

Audit which assets are actually reachable, remove or archive unused production assets, compress/transcode the GLB if visual quality permits, and verify CDN caching. Measure first-load LCP, JS parse/execute time, GLB decode time, GPU memory, and mobile data usage.

### P2 — Graph performance is bounded now, but scale assumptions are not

The graph correctly uses a precomputed/frozen layout (`warmupTicks` + `cooldownTicks={0}`) and custom canvas drawing. That is a good choice. It still rebuilds graph data from the entire in-memory note map and redraws a canvas when note edits/realtime updates occur. There is no explicit node/edge cap, progressive rendering, or large-vault UX. Define a product limit or add aggregation/search before the graph becomes a wall of labels.

### P2 — Some asset/render docs and code are out of sync

The source currently says `dpr={[1, 2]}` while handoff text says the cap is `dpr={1}`. The latest handoff graph bounds also record contradictory right-edge/width values for the equal-inset surface. These discrepancies make performance and visual regression claims less trustworthy and should be cleaned before presenting the project professionally.

---

## 6. Accessibility and UX findings

### P1 — Dialog semantics are present, but focus management is incomplete

**Status:** Confirmed from source.  
`GlassModal` and the Knowledge Graph use `role="dialog"`, `aria-modal`, labels, and Escape listeners. However, there is no focus trap, no focus restoration to the trigger, and no inerting of background controls. The graph itself is a canvas with pointer hit areas; nodes do not have an equivalent keyboard/assistive-technology list or focusable representation.

A keyboard user can therefore enter a modal and tab into controls behind it, while a screen-reader user cannot discover graph nodes as notes/tags without a parallel semantic view.

Fix with a tested dialog primitive/focus manager, initial focus, restore-on-close, and a graph “list/table view” or accessible node navigator. Test keyboard-only flows, not just ARIA snapshots.

### P1 — Reduced motion is inconsistent

CSS disables the ambient/glow animations, and `GraphSidePeek` uses `useReducedMotion`. Several Framer Motion surfaces (`GlassModal`, graph overlay, chat, Kanban/note animations, welcome) still declare transitions without a shared reduced-motion policy. A user preference should affect all non-essential motion consistently.

### P2 — Contrast/readability needs measurement, not taste debate

The visual language uses many `text-white/30`, `/40`, `/50` labels, 10–11px metadata, translucent glass over a photographic frame, and faint graph edges. This can look elegant while failing WCAG contrast in parts of the UI. Run axe plus actual contrast checks against representative background states, including graph blur, error state, mobile, and the static frame.

### P2 — The graph is visually impressive but still discoverability-heavy

The graph requires understanding that text hubs and tiny colored satellite dots are interactive. The current hit radius is better, but there is no obvious legend, zoom/reset affordance, keyboard fallback, or “what can I do here?” hint. A portfolio viewer may see decoration before understanding the note-management use case.

### P2 — Failure/loading states are uneven

Tag Explorer has loading/error/retry states, but initial notes loading and realtime failure are mostly terminal-log messages. There is no prominent sync status, retry action, or recovery explanation for a user who submits while offline. The product should distinguish “saved,” “queued locally,” “saved remotely,” and “AI degraded.”

### P2 — Mobile is responsive, but the core interaction is desktop-first

The live mobile smoke kept the office visible and collapsed panels correctly. That is a pass for layout, not proof of mobile usability. A 3D office with tiny robots, glass overlays, a graph, and a bottom dock competes heavily for a 390px viewport. Test capture speed, graph selection, editing, scrolling, keyboard behavior, and battery/thermal impact on a real phone.

### P3 — There is no obvious data portability or safety affordance

For a “second brain,” export, import, search, undo, bulk archive, and visible privacy expectations are more valuable than another visual effect. Their absence limits real-world usefulness and makes the app feel like an experience demo rather than a dependable memory tool.

---

## 7. Product and codebase judgment

### The real product question is not “can the robots file notes?”

They can, and that is the memorable hook. The harder question is whether the physical animation improves the user’s everyday behavior enough to justify AI latency, GPU cost, and the interaction delay.

Current friction:

- A user waits for categorization and then watches a relatively slow walk for confirmation.
- Only three broad categories exist, so the visual office may imply more organization than the data model provides.
- The graph shows relationships but does not yet clearly help a user decide, retrieve, summarize, or act.
- There is no obvious fast path for search, edit, export, recovery, or offline capture.
- “Initialize Agents” is a theatrical onboarding gate, but it delays access to the actual capture control.

**Product recommendation:** Keep the office as the differentiator, but make capture and retrieval instant and dependable. The animation should be a delightful explanation/confirmation layer, not the only path to knowing whether a note was safely stored.

### Codebase quality is good but release hygiene is not finished

Current issues found:

- Lint has five warnings: unused-expression warnings in `app/layout.tsx`, `no-img-element`/LCP warning in `BackgroundVideo.tsx`, and a missing hook dependency in `useLibrarianChat.ts`.
- Several canonical docs are stale or contradictory about the OBJ/GLB transition, destinations, trash cell, task board, and current graph layout.
- The working tree contains uncommitted graph implementation/test/memory changes and unrelated untracked files. That is normal during development, but not a clean portfolio release state.
- E2E coverage is valuable but primarily mocks APIs; there is no CI-visible live Supabase migration test, authorization matrix, load test, accessibility scan, or performance budget.
- No repository CI workflow was evident in the inspected tree, so green local commands are not yet a durable merge/release gate.
- Dependency audit is clean, but several direct packages have patch/minor updates available. Update deliberately with lockfile/test review; do not equate “outdated” with “vulnerable.”

---

## 8. Prioritized roadmap

### Phase 0 — Decide the release boundary

Answer these before changing architecture:

1. Is the next release a **private single-user showcase**, a **public demo with sanitized data**, or a **real multi-user product**?
2. Will real/private notes be used in the deployed portfolio instance?
3. What is the deployment target and expected concurrent user count?
4. What monthly AI spend and maximum note count are acceptable?
5. Must a note survive reload/offline/browser close while a robot is moving?

If the answer is “public demo with no real private notes,” lock the demo down at the hosting layer and use sanitized seeded data. Do not call the current route guards production security.

### Phase 1 — Stop the security/cost bleeding (required before public real data)

- Add Supabase Auth and ownership (`user_id`) or put the app behind a real private access boundary.
- Replace `using (true)` anon policy with owner-scoped RLS; test reads/writes/realtime cross-user.
- Authenticate every route; authorize note IDs and status transitions.
- Add body/message limits and pagination/limits.
- Replace per-instance IP-only limiting with shared/user-aware limits and spend ceilings.
- Cache embeddings per note revision and bound retrieval.
- Add security headers/CSP and verify them in E2E/deployment smoke.
- Add redacted structured errors, request IDs, provider cost/latency metrics, and an alert path.
- Add a CI gate for typecheck, unit/E2E, migration rehearsal, authorization tests, accessibility scan, and performance budgets.

### Phase 2 — Make the core loop dependable

- Add idempotency keys for note submission.
- Make remote persistence authoritative; label local-only fallback honestly.
- Reconcile notes and in-flight jobs on startup.
- Either persist delivery/archive jobs or explicitly frame them as ephemeral visual playback.
- Add export, search, retry, sync status, undo/archive recovery, and clear empty states.
- Fix all lint warnings and stale docs; clean the release branch.

### Phase 3 — Establish a measured performance budget

Set budgets before optimizing:

- First-load JS and GLB transfer/decode.
- LCP and time to usable capture control.
- 95th-percentile frame time and GPU memory by device tier.
- Idle/background CPU/GPU usage.
- Chat/categorization p95 latency and provider cost per action.
- Graph render time at 100/500/1,000 notes.

Then implement adaptive DPR/shadows/postprocessing, pause when hidden, remove unused production assets, and preserve the high-quality desktop profile only where measurement supports it.

### Phase 4 — Accessibility and portfolio finish

- Use a tested accessible dialog primitive with focus trap/restore.
- Provide a semantic graph list and keyboard node navigation.
- Apply reduced motion consistently.
- Run axe/WCAG checks and fix contrast/target-size findings.
- Add a clear privacy/data-flow explanation and a polished README architecture diagram.
- Publish a short case study showing the problem, architecture, trade-offs, measured performance, security model, and known limitations. Honest limitations improve the portfolio story.

---

## 9. Validation performed for this audit

| Check | Result |
|---|---|
| TypeScript | Pass |
| Vitest | 191/191 pass |
| ESLint | Pass; 0 errors, 5 warnings |
| Production build | Pass; 8 routes generated |
| Playwright | 7/7 pass with one worker |
| Production dependency audit | 0 known vulnerabilities |
| Live browser smoke | Desktop + mobile pass; 0 app console/page errors |
| Live graph behavior | Open/close, bounded surface, office visibility pass |
| Repository secret scan | No tracked secret files found |

### Known limitations of this validation

- E2E API flows are mocked; they do not prove deployed auth, RLS, provider failure, or real migration behavior.
- No load test or cost test was run.
- The local migration files were inspected, but no fresh-schema/upgrade-path migration rehearsal was run.
- No formal penetration test was run.
- No automated axe/WCAG scan was run.
- No real-phone thermal/battery test was run.
- Headless SwiftShader performance is not representative of every desktop GPU.

---

## 10. Research and standards consulted

### Authoritative guidance

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10 — 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth with Next.js/server-side guidance](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [React Three Fiber performance guidance](https://docs.pmnd.rs/react-three-fiber/advanced/performance)
- [Vasturiano react-force-graph](https://github.com/vasturiano/react-force-graph)

### Community audit skills researched, not installed

Community skills can accelerate review but do not replace security testing or formal audits. No new community skill was installed during this audit.

- [`cloudflare/skills@web-perf`](https://skills.sh/cloudflare/skills/web-perf) — high-install web-performance guidance.
- [`addyosmani/web-quality-skills@web-quality-audit`](https://skills.sh/addyosmani/web-quality-skills/web-quality-audit) — broad Lighthouse/Core Web Vitals/accessibility-oriented audit.
- [`developers.cloudflare.com@web-perf`](https://skills.sh/developers.cloudflare.com/web-perf) — lower-install Cloudflare-oriented performance guidance.
- [`podo/design-agent-skills@accessibility-catalogue`](https://skills.sh/podo/design-agent-skills/accessibility-catalogue) — accessibility-focused catalogue.

The repository already contains local performance, React/Next, R3F, Supabase, and UI-focused guidance. Installing another community skill should happen only if its rules are reviewed and there is a specific gap to fill.

---

## Bottom line

Do not market the current app as secure or production-ready merely because the tests are green. Market it accurately as a **high-quality, visually ambitious prototype with a tested core loop and a clear path to production hardening**.

The highest-leverage sequence is:

> **Choose the release boundary → protect identity/data → bound AI/database work → make delivery durable → measure GPU/mobile performance → finish accessibility and product escape hatches.**

If those steps are completed, the project becomes more than a flashy demo: it becomes a defensible portfolio case study showing security decisions, performance trade-offs, product judgment, and disciplined engineering.
