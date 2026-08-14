# Unified Vercel Private/Demo Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the private Notelings workspace at the root path and the isolated portfolio demo at `/demo` from one Vercel project backed by two separate Supabase projects.

**Architecture:** The root path `/` is always private mode and `/demo` is always demo mode. Next `proxy.ts` determines the mode from the request path, rewrites `/demo/api/*` to the existing route handlers while overwriting a trusted internal mode header, and every server route selects the corresponding Supabase URL/anon/service-role credentials from explicit server configuration. Browser API calls and Realtime use mode-aware `/api/*` versus `/demo/api/*` paths; no client-controlled `demo=true`, project selector, or service-role key is an authorization boundary.

**Tech Stack:** Next.js 16 App Router/proxy, React 19, TypeScript, `@supabase/ssr`, Supabase Auth/Postgres/Realtime, Vercel, Playwright, Vitest.

## Global Constraints

- Preserve the current office, camera, Bloom/liquid-glass UI, Knowledge Graph, robots, renderer profiles, live Gemini behavior, and demo AI limits.
- Root `/` must use only the private Supabase project; `/demo` must use only the demo Supabase project.
- Never expose a Supabase service-role key, Management API token, password, or Gemini key to the browser.
- Never trust a browser-provided mode/project/tenant value; `proxy.ts` overwrites the internal mode header on every request.
- Use mode-specific Auth cookie names so private and demo sessions cannot overwrite each other.
- Keep the current `notelings-portfolio-demo.vercel.app` deployment available as a rollback copy until the unified deployment passes all gates.
- Do not change the database schema; both Supabase projects already have the required schema, auth tables, RLS, seed, and demo AI usage migration.
- Do not enable `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` or `SUPABASE_ACCESS_TOKEN` in Vercel.
- Use npm and existing dependencies only; no package installation or new external service.
- User-visible copy must identify demo mode as a demo workspace without changing the private workspace experience.

## Current Revert Point

The current isolated demo deployment and local implementation are preserved by pushed commits:

```text
017976e chore: harden isolated demo deployment
c3ed109 fix: allow the GLB decoder under production CSP
a4c7274 docs: record deployed demo verification
```

The existing annotated baseline tag is:

```text
notelings-pre-dual-track-deployment-readiness-20260813
```

Database rollback remains separate from Git rollback: use the existing demo seed reset and Supabase backup/forward migration procedures, not `git reset`.

---

## Task 1: Add the trusted mode model and explicit environment contract

**Files:**
- Create: `lib/deployment/mode.ts`
- Create: `lib/deployment/mode.test.ts`
- Modify: `.env.example`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/DEMO_DEPLOYMENT_REMAINING_STEPS.md`

**Interfaces:**

```ts
type AppMode = 'private' | 'demo'

const MODE_HEADER = 'x-notelings-app-mode'
const DEMO_PREFIX = '/demo'

function modeFromPathname(pathname: string): AppMode
function apiPath(mode: AppMode, pathname: string): string
function modeConfig(mode: AppMode): {
  url: string
  anonKey: string
  serviceRoleKey?: string
  demoEmail?: string
}
```

- [ ] **Step 1: Write mode resolver tests.**

  Cover `/`, `/auth`, `/api/notes`, and `/demo`/`/demo/`/`/demo/api/notes`. Assert only a path beginning with `/demo` resolves to demo mode; query parameters and request bodies never affect the result. Assert `apiPath('private', '/notes')` returns `/api/notes` and `apiPath('demo', '/notes')` returns `/demo/api/notes`.

- [ ] **Step 2: Implement explicit environment resolution.**

  Prefer these one-project variables:

  ```text
  PRIVATE_SUPABASE_URL
  PRIVATE_SUPABASE_ANON_KEY
  PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  DEMO_SUPABASE_URL
  DEMO_SUPABASE_ANON_KEY
  DEMO_SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_PRIVATE_SUPABASE_URL
  NEXT_PUBLIC_PRIVATE_SUPABASE_ANON_KEY
  NEXT_PUBLIC_DEMO_SUPABASE_URL
  NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY
  NOTELINGS_DEMO_EMAIL
  NOTELINGS_DEMO_PASSWORD
  GOOGLE_GENERATIVE_AI_API_KEY
  ```

  Keep local compatibility fallback from the old private names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) only for private mode during migration; demo mode must require the explicit `DEMO_*` values. Fail with a configuration error rather than silently falling back from demo to private.

- [ ] **Step 3: Document the one-project Vercel environment matrix.**

  State that the same Vercel project needs both private and demo URLs/anon keys/service-role keys, while only anon keys may reach the browser. Document root private mode, `/demo` mode, mode-specific auth cookies, and the current isolated demo deployment as rollback-only.

- [ ] **Step 4: Run the focused mode tests.**

  Run:

  ```bash
  npx vitest run lib/deployment/mode.test.ts
  ```

  Expected: all mode/path/config tests pass.

---

## Task 2: Make proxy/session/auth clients mode-aware

**Files:**
- Modify: `proxy.ts`
- Modify: `lib/supabase/server.ts`
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/auth.ts`
- Create or modify: focused server/client auth tests

**Interfaces:**

```ts
function createServerSupabase(mode: AppMode): SupabaseClient
function createUserSupabase(mode: AppMode): Promise<SupabaseClient>
function createBrowserSupabase(mode?: AppMode): SupabaseClient
function getAuthenticatedContext(request: Request): Promise<AuthenticatedContext | null>
```

- [ ] **Step 1: Add mode-specific configuration and cookie names.**

  Use `notelings-private-auth` for root cookies and `notelings-demo-auth` for `/demo` cookies through the `cookieOptions.name` option supported by `@supabase/ssr`. The browser singleton must be keyed by mode, not shared across both modes in the same tab.

- [ ] **Step 2: Update `proxy.ts`.**

  For `/demo` page requests, refresh the demo Supabase session. For `/demo/api/*`, create a rewritten request to `/api/*` with a new request header `x-notelings-app-mode: demo`; overwrite any incoming value before rewriting. For root and direct `/api/*`, overwrite the internal header to `private`. Do not use a client cookie or query parameter as the mode source.

- [ ] **Step 3: Update authenticated server clients.**

  `getAuthenticatedContext(request)` must read the internal mode header set by `proxy.ts`, create the matching cookie-aware client, call verified `getUser()`, and return the mode with the client/user. Route handlers must not use a module-level client bound permanently to one project.

- [ ] **Step 4: Update the browser Supabase/Reatime client.**

  Resolve mode from `window.location.pathname`, use the matching public URL/anon key, and use the matching cookie name. Realtime subscriptions on `/demo` must connect only to the demo Supabase project.

- [ ] **Step 5: Add mode-boundary tests.**

  Assert root requests select private configuration, `/demo` requests select demo configuration, an incoming forged `x-notelings-app-mode: demo` on root is overwritten to private, and demo cookies/config never use the private service-role key.

- [ ] **Step 6: Run focused auth tests.**

  Run the existing auth/route tests plus the new mode tests. Expected: signed-out root and demo boundaries remain 401 where appropriate; no test uses the E2E bypass in production mode.

---

## Task 3: Route all UI API calls through the correct mode

**Files:**
- Modify every current client fetch site found by searching `fetch('/api/` and `fetch("/api/`:
  - `components/notelings/NotelingsUI.tsx`
  - `components/notelings/useNotesRealtime.ts`
  - `components/notelings/useNoteSync.ts`
  - `components/notelings/useSubmitNote.ts`
  - `components/notelings/useAuthSession.ts`
  - `components/notelings/ChatPanel.tsx`/chat hook
  - tag explorer and graph/archive/edit callers
- Modify: `components/notelings/WelcomeScreen.tsx` only if its demo link needs `/demo` navigation.
- Create/modify: focused client path tests.

**Interfaces:**

```ts
apiPathForCurrentMode(pathname: string): string
```

- [ ] **Step 1: Inventory and test every client API route.**

  The root must call `/api/...`; `/demo` must call `/demo/api/...`. Cover notes GET/PATCH/DELETE, manual capture, AI categorization, chat, tags, auth login/register/demo/logout, archive, and Realtime-related fetches.

- [ ] **Step 2: Replace hard-coded client API paths.**

  Use the shared `apiPath` helper and `window.location.pathname` at call time. Preserve request bodies, status handling, toasts, retries, and existing AI-off behavior exactly.

- [ ] **Step 3: Make the demo entry navigation explicit.**

  The public landing root remains private-mode by default. The portfolio entry must navigate to `/demo` before the demo session request so the browser receives demo cookies and subsequent calls use `/demo/api/*`. Direct `/demo` navigation must also work.

- [ ] **Step 4: Run the client/unit suite.**

  Run:

  ```bash
  npx tsc --noEmit
  npm test
  ```

  Expected: existing behavior remains green and no hard-coded client call can cross the mode boundary.

---

## Task 4: Preserve demo AI limits and server route behavior per mode

**Files:**
- Modify: `app/api/categorize/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/auth/demo/route.ts`
- Modify: `lib/ai/demoUsage.ts`
- Modify: `lib/observability.ts` only if mode needs to be included as a non-sensitive field
- Modify/add: route tests

**Interfaces:**

```ts
reserveDemoAiUsage(action: 'categorize' | 'chat', mode: AppMode): Promise<boolean>
```

- [ ] **Step 1: Bind every route to the verified request mode.**

  Categorization, chat, notes, tags, archive/edit, and demo auth must use the Supabase client returned for the internal mode. A root request cannot sign into or query the demo project; a `/demo` request cannot query the private project.

- [ ] **Step 2: Keep the current demo budget.**

  In demo mode, preserve 12 categorization calls/day and 6 chat calls/day using the existing demo usage RPC. In private mode, do not call the demo usage table. Preserve deterministic count answers and degraded/manual fallbacks.

- [ ] **Step 3: Add forged-boundary route tests.**

  Test root `/api` requests with client-supplied demo headers, demo `/demo/api` requests, missing demo configuration, and provider exhaustion. Expected: mode comes only from proxy routing, wrong-project access is rejected, and manual capture remains usable when demo AI is capped.

- [ ] **Step 4: Run focused route tests.**

  Run all existing API/auth tests plus the new root/demo boundary tests. Expected: no private note content is returned to a demo request and no demo request falls back to private credentials.

---

## Task 5: Add the `/demo` page and preserve visual behavior

**Files:**
- Create: `app/demo/page.tsx`
- Modify: `app/page.tsx` only if a shared page component is needed
- Modify: `components/notelings/WelcomeScreen.tsx` for the demo link copy/navigation
- Modify: `app/auth/page.tsx`/callback only if redirects need a mode-preserving path
- Add: `e2e/unified-deployment.spec.ts`

**Interfaces:**

```tsx
// app/demo/page.tsx
export default function DemoPage(): JSX.Element
```

- [ ] **Step 1: Render the same office/UI at `/demo`.**

  Reuse the existing home composition and preserve camera, renderer profile, robots, graph, glass UI, and static background. The only intended visible difference is the existing `Demo workspace` indicator and an explicit reset/disclosure message if the approved placement supports it without changing the visual hierarchy.

- [ ] **Step 2: Add demo navigation tests.**

  Assert `/` shows private entry behavior, `/demo` shows the demo entry/session behavior, root and demo use separate cookie names, and browser navigation never changes mode without changing the path.

- [ ] **Step 3: Add live-mode visual captures.**

  Capture root and `/demo` at desktop and mobile sizes. Compare office canvas pixels, canvas alpha/transparency, camera profile, GLB mesh count, robot layout, glass UI, Graph overlay, and absence of unexpected layout shift. Accept only the intended demo label/path differences.

- [ ] **Step 4: Obtain explicit visual approval.**

  Pause before any additional visual changes. Do not redesign the landing page or add a large demo banner as part of routing.

---

## Task 6: Configure the single Vercel project and two Supabase boundaries

**External configuration:** User supplies values through Vercel/Supabase dashboards; never paste secrets into chat or Git.

- [ ] **Step 1: Add both project configurations to the one Vercel project.**

  Production and Preview must contain:

  ```text
  PRIVATE_SUPABASE_URL
  PRIVATE_SUPABASE_ANON_KEY
  PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  DEMO_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
  DEMO_SUPABASE_ANON_KEY
  DEMO_SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_PRIVATE_SUPABASE_URL
  NEXT_PUBLIC_PRIVATE_SUPABASE_ANON_KEY
  NEXT_PUBLIC_DEMO_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
  NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY
  NOTELINGS_DEMO_EMAIL=demo@notelings.local
  NOTELINGS_DEMO_PASSWORD
  GOOGLE_GENERATIVE_AI_API_KEY
  NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=auto
  ```

  The old single-project `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` variables may remain temporarily for private fallback during rollout but must not be used for demo resolution. Never add `SUPABASE_ACCESS_TOKEN` or E2E bypass variables.

- [ ] **Step 2: Configure Supabase Auth URLs for both projects.**

  Add the one Vercel origin plus `/auth/callback` and `/demo/auth/callback` only if the implementation uses separate callback paths. Verify root login returns to `/` and demo login returns to `/demo`; do not allow arbitrary redirect targets.

- [ ] **Step 3: Rename the Vercel project/alias only after unified verification.**

  Rename `notelings-portfolio-demo` to the chosen main-app project name only after `/` is private and `/demo` is demo. Keep the current deployment URL as a rollback alias if Vercel permits it.

- [ ] **Step 4: Do not delete the isolated demo project/deployment.**

  Keep it until the unified deployment has passed production checks and a rollback test.

---

## Task 7: Run full validation and release the unified app

**Files:**
- Modify: `docs/DEPLOYMENT.md`, `docs/DEMO_DEPLOYMENT_REMAINING_STEPS.md`, `handoff.md`, `knowledge.md`, and `PERFORMANCE_AUDIT_2026-08-13.md` with final mode/deployment evidence.

- [ ] **Step 1: Run repository gates.**

  ```bash
  npx tsc --noEmit
  npm test
  npm run lint
  npm run build
  CI=1 npm run test:e2e -- --workers=1
  npm audit --omit=dev --audit-level=high
  ```

- [ ] **Step 2: Run deployed health/header smoke.**

  Verify `/api/health`, CSP including `'wasm-unsafe-eval'`, HSTS, required security headers, page status, and no private data in liveness output.

- [ ] **Step 3: Run live root/private boundary checks.**

  Using a private test session, verify root notes/auth/Realtime use the private project and `/demo` cannot read private rows. Signed-out root and demo routes must reject authenticated data requests.

- [ ] **Step 4: Run live `/demo` checks.**

  Verify demo login, 8 fictional seed notes, AI categorization, 12/6 caps/fallback, manual capture, graph, archive, reset, and mobile loading. Reset demo after tests.

- [ ] **Step 5: Run visual comparison.**

  Compare root and `/demo` captures to the current deployed demo baseline. Keep the unified change only if office framing, GLB textures, shadows, Bloom/SSAO, robots, transparency, graph surface, and mobile layout remain visually equivalent apart from the intended path/mode label.

- [ ] **Step 6: Record the final release state.**

  Document the Vercel deployment SHA, private/demo Supabase refs, smoke results, rollback deployment, and remaining private-product gaps. Never write keys, passwords, cookies, or PATs into tracked files.

**Acceptance:** One Vercel project serves private root mode and isolated `/demo` mode; every server and browser data path selects the correct Supabase project; forged mode headers cannot cross the boundary; live AI remains capped; all repository/deployed/visual gates pass; the old demo deployment remains available for rollback.
