# Notelings Deployment Runbook

## Release strategy

Notelings has two intentionally separate release tracks:

| Track | Vercel | Supabase | Data | AI |
| --- | --- | --- | --- | --- |
| Portfolio demo | Public demo project | Separate demo project | Fictional seed data; visitor writes are ephemeral/resettable | Strictly budgeted Gemini only when configured; deterministic fallback when unavailable |
| Private workspace | Private product project | Private owner-scoped project | Authenticated private notes | Disclosed Gemini processing plus manual/no-AI capture |

A domain alias alone is not isolation. The demo must use different Supabase URLs, anon keys, service-role keys, database rows, and environment variables from the private workspace.

## Environment contract

### Private workspace

Set in the Vercel **Production** environment only:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GENERATIVE_AI_API_KEY
NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=auto
```

The private workspace does not need demo credentials.

### Portfolio demo

Set in the separate demo Vercel project:

```text
NEXT_PUBLIC_SUPABASE_URL       # demo Supabase project only
NEXT_PUBLIC_SUPABASE_ANON_KEY  # demo Supabase project only
SUPABASE_SERVICE_ROLE_KEY      # demo project service role only
GOOGLE_GENERATIVE_AI_API_KEY   # optional; hard quota required when set
NOTELINGS_DEMO_EMAIL
NOTELINGS_DEMO_PASSWORD
NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=auto

# Local reset script only; never set the confirmation in Vercel.
NOTELINGS_DEMO_PROJECT_REF
NOTELINGS_DEMO_RESET_CONFIRM=RESET_DEMO
```

When Gemini is not configured or the demo quota is exhausted, the demo must use deterministic seeded/mock behavior rather than failing the showcase. Do not promise that a vendor free tier is permanent; enforce an application-level demo ceiling anyway.

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

- Set the Supabase Site URL to the correct Vercel deployment.
- Add only the correct production and approved preview callback URLs.
- Verify `/auth/callback` accepts only allow-listed redirects.
- Test sign-in, sign-out, expired sessions, and demo entry separately.
- Never point a public demo redirect at the private deployment.

## Vercel configuration

- Connect each Vercel project to the same repository but different environment variables.
- Use Node 22 and the committed npm lockfile.
- Use the normal Next.js build command: `npm run build`.
- Keep Preview isolated from private production data unless a specific preview project is configured.
- Enable HTTPS before enabling production HSTS behavior.
- Confirm streaming route limits for `/api/chat` and execution limits for categorization.
- Record the deployed commit SHA and previous Vercel deployment URL for rollback.

## Demo write policy

The demo may accept visitor notes to demonstrate the full interaction, but writes are ephemeral:

- Demo rows exist only in the demo Supabase project.
- A scheduled/manual reset restores the sanitized seed.
- Demo reset may delete all visitor-created rows; the UI must disclose this.
- Demo AI calls use a separate hard quota and never retrieve private-project data.
- If the demo quota/provider is unavailable, deterministic fallback behavior keeps the showcase usable.
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

Rotate only the affected credential: provider key, service-role key, demo password, owner password, or temporary Management PAT. Never record values in this file, `handoff.md`, `knowledge.md`, screenshots, or CI logs.

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
