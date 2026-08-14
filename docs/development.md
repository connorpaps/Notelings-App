# Development Guide

## Requirements

- Node.js 22.x
- npm
- Git
- Git Bash on Windows for the committed POSIX helper scripts
- A Supabase project and Google Gemini key for real authenticated capture/chat; the office and UI can render without provider credentials

## First run

```bash
npm ci
npx playwright install chromium
cp .env.example .env.local
```

Fill `.env.local` with the appropriate private/local values. Never commit it. Public anon values may be browser-visible; service-role and provider keys must remain server-only.

## Run locally

Foreground:

```bash
npm run dev
```

On Windows Git Bash, the detached launcher is convenient:

```bash
bash scripts/dev-server.sh start
bash scripts/dev-server.sh status
bash scripts/dev-server.sh logs
bash scripts/dev-server.sh stop
```

Open <http://localhost:3000>. `/demo` uses the demo-mode environment when configured.

## Validation

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
CI=1 npm run test:e2e -- --workers=1
```

The GLB/WebGL Playwright suite is intentionally serial on constrained SwiftShader machines. Use a fresh `CI=1` server so test-only auth/render variables are injected; do not diagnose a reused signed-out server as an application failure.

## Public-repo hygiene

Keep screenshots and fictional fixtures sanitized. Do not stage `.env*`, logs, build output, browser reports, local recordings, passwords, provider keys, Supabase Management tokens, or private notes. The public repository contains product source and curated documentation; AI memory files, hooks, vendored skills, editor metadata, and internal execution plans remain local-only and are preserved only in the developer working copy.

## Architectural constraints

- Keep the active GLB and its measured navigation map stable unless the office is intentionally re-baked and revalidated.
- Do not call React state setters or perform heavy A*/curve work in `useFrame`.
- Do not expose service-role Supabase clients to browser modules.
- Preserve the transparent canvas and explicit `pointer-events-auto` opt-in for interactive overlay surfaces.
- Make schema changes through reviewed Supabase migrations, not ad hoc local SQL.
