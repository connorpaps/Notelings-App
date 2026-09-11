# Notelings Deployment Runbook

Use the single consolidated user checklist first: [`DEMO_DEPLOYMENT_REMAINING_STEPS.md`](DEMO_DEPLOYMENT_REMAINING_STEPS.md).

The older setup reference remains here: [`DEPLOYMENT_SETUP_CHECKLIST.md`](DEPLOYMENT_SETUP_CHECKLIST.md).

## Release strategy

Notelings uses one Vercel project with two trusted paths:

| Path | Supabase | Data | AI |
| --- | --- | --- | --- |
| `/` | Private owner-scoped project | Authenticated private notes | Disclosed Gemini processing plus manual/no-AI capture |
| `/demo` | Separate demo project | Fictional seed data; visitor writes are ephemeral/resettable | Strictly budgeted Gemini with deterministic fallback |

One Vercel project is not one data boundary: the server must select different Supabase URLs, anon keys, service-role keys, auth cookies, and rows based on the trusted path. A browser-provided mode/project selector is never sufficient.

## Environment contract

### One Vercel project

Set both project configurations in the same Vercel Production/Preview environment:

```text
PRIVATE_SUPABASE_URL
PRIVATE_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_PRIVATE_SUPABASE_URL
NEXT_PUBLIC_PRIVATE_SUPABASE_ANON_KEY

DEMO_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
DEMO_SUPABASE_ANON_KEY
DEMO_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_DEMO_SUPABASE_URL
NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY
NOTELINGS_DEMO_EMAIL=demo@notelings.local
NOTELINGS_DEMO_PASSWORD

GOOGLE_GENERATIVE_AI_API_KEY
NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=auto
```

The server uses `PRIVATE_*` for `/` and `DEMO_*` for `/demo`. Only the `NEXT_PUBLIC_*` anon values reach the browser; service-role keys remain server-only. During migration, the old private `NEXT_PUBLIC_SUPABASE_*` names may remain as a private-mode fallback, never as demo configuration.

When Gemini is not configured or the demo quota is exhausted, `/demo` uses deterministic/degraded behavior rather than failing the showcase. Do not promise a permanent vendor free tier; enforce the application-level 12 categorization/day and 6 chat/day demo ceiling.

### Local-only reset variables

```text
NOTELINGS_DEMO_PROJECT_REF=aczmwzeupytsfdcwmofz
NOTELINGS_DEMO_RESET_CONFIRM=RESET_DEMO
```

Never set the reset confirmation in Vercel.

### Never deploy

These variables must never be present in Vercel Preview or Production:

```text
SUPABASE_ACCESS_TOKEN
NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS
```

`SUPABASE_ACCESS_TOKEN` is a short-lived local migration credential only. `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` is test-only.

## Supabase setup

For each project:

1. Confirm the project reference and URL before applying SQL.
2. Apply the complete migration sequence against a disposable rehearsal project first.
3. Apply migrations to the intended project during a controlled window.
4. Verify `notes_category_check` allows `Work`, `Admin`, `Uncategorized`, and `Manual`.
5. Verify owner-scoped RLS and authenticated Realtime.
6. Verify anonymous clients cannot read private rows.
7. For the demo project, run the sanitized seed and record its expected row/category counts.
8. Back up/export the private workspace before future schema changes.

The demo reset is a destructive operation against the demo project only. Run `node scripts/reset-demo.mjs` only with the demo project environment loaded. It verifies the target project reference, requires `NOTELINGS_DEMO_RESET_CONFIRM=RESET_DEMO`, deletes demo rows, and restores the fictional seed in one idempotent run. Never set the confirmation in Vercel or run the script with private-project variables.

## Auth configuration

For the private project and demo project separately:

- Set each Supabase Site URL to the same Vercel origin.
- Allow the private callback at `/auth/callback` and the demo callback at `/demo/auth/callback` if callback auth is enabled.
- Verify `/` uses private mode and `/demo` uses demo mode after sign-in, sign-out, and session refresh.
- Use separate mode-specific Auth cookie names.
- Never trust an arbitrary `next`, mode, project, or tenant value from the browser.

## Vercel configuration

- Connect one Vercel project to the repository and configure both Supabase environments above.
- Use Node 22 and the committed npm lockfile.
- Use the normal Next.js build command: `npm run build`.
- Treat `/` Preview as private only when its private project is explicitly approved; otherwise use a sanitized private test project.
- Enable HTTPS before enabling production HSTS behavior.
- Confirm streaming route limits for `/api/chat` and execution limits for categorization.
- Record the deployed commit SHA and keep the current demo-only deployment URL for rollback until unified routing is verified.

## Automated production deployment

Pushes to `main` run the full validation job in GitHub Actions. Production deployment is owned by Vercel's native GitHub integration for `connorpaps/Notelings-App`; once Vercel receives the `main` push, it builds and promotes the deployment to `https://notelings-portfolio.vercel.app/`.

This repository intentionally does not duplicate that deployment in GitHub Actions. Vercel already owns the linked project and its environment configuration, so a second CLI build would add another credential boundary and build the same commit twice. Use the Vercel project dashboard to inspect deployment logs or redeploy a verified commit.

## Demo write policy

The demo may accept visitor notes to demonstrate the full interaction, but writes are ephemeral:

- Demo rows exist only in the demo Supabase project.
- A scheduled/manual reset restores the sanitized seed.
- Demo reset may delete all visitor-created rows; the UI must disclose this.
- Demo AI calls use a separate hard quota and never retrieve private-project data: 12 categorization calls/day and 6 chat calls/day for the shared demo account.
- If the demo quota/provider is unavailable, deterministic fallback behavior keeps the showcase usable; manual/no-AI capture remains available.
- The demo must not expose service-role credentials or allow a browser-provided project/tenant selector.

## Backup and recovery

### Private workspace

Before each schema or deployment boundary:

1. Use Supabase’s available backup/export facility.
2. Export notes in a portable format when possible.
3. Record the migration and deployment commit.
4. Verify the restore owner and recovery steps.
5. Use forward migrations or a tested restore; never use `git reset` as a database rollback.

### Demo workspace

The sanitized seed is the recovery source. Keep it versioned in the repository only if it contains fictional data and no secrets. The reset script must be idempotent and target-guarded.

## Required smoke checks

Run against the actual deployment URL, not only localhost:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
CI=1 npm run test:e2e -- --workers=1
npm audit --omit=dev --audit-level=high
```

Then verify:

- `/api/health` returns liveness only and no private data.
- Security headers are present.
- WebGL/GLB textures load without CSP violations.
- Signed-out private routes reject access.
- Private owner can sign in and see only owner rows.
- Demo entry reaches only the demo project.
- AI-off capture makes no categorize/provider call.
- Demo reset removes visitor rows and restores seed rows.
- No application console/page errors beyond known Three.js deprecations.

## Rollback

### Code

Use the previous Vercel deployment or the local checkpoint:

```text
notelings-pre-dual-track-deployment-readiness-20260813
```

### Database

Use a tested backup restore or a forward corrective migration. Do not reopen anonymous reads as a rollback shortcut.

### Secrets

Rotate only the affected credential: provider key, service-role key, demo password, owner password, or temporary Management PAT. Never record values in this file, local development memory, screenshots, or CI logs.

## Release gates

### Portfolio demo may launch when

- Demo/private projects are separate.
- Demo seed/reset/isolation checks pass.
- Demo AI is disabled or hard-capped with deterministic fallback.
- Privacy/AI disclosure is live.
- Actual preview/production smoke passes.
- Screenshots and performance artifacts are reviewed.
- Rollback and reset owners are documented.

### Private beta may launch when

- All portfolio gates pass.
- Two-user auth/RLS/Realtime isolation passes in the deployed private project.
- Request limits and authenticated quotas are active.
- Failed writes are truthful and retries are idempotent.
- Provider settings/privacy are verified.
- Backups, health, redacted logs, and CI gates are active.

### Paid product may launch when

- Private beta gates pass.
- Password/account recovery, export/delete policy, terms/privacy, support, usage limits, cost monitoring, and outage response are complete.
- Load/cost testing supports the chosen note count and concurrency budget.
