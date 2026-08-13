# Notelings-App

Notelings is a visual second brain: notes are categorized, saved, and physically delivered by capsule agents through a 3D office.

## First-time setup (macOS or Windows)

Prerequisites:

- Node.js 22.x (the current AI SDK dependencies require Node 22 or newer)
- npm
- Git
- A Supabase project and Google Generative AI API key for real note submission

From the repository root:

```bash
npm ci
npx playwright install chromium
bash scripts/machine-sync.sh
cp .env.example .env.local
```

Open `.env.local` and fill the four values. `.env.local` is ignored by Git and must never be committed.

On Windows, run the commands from Git Bash (the committed shell scripts use portable POSIX paths and `.gitattributes` keeps them LF-only). PowerShell can still run the npm commands; Git Bash is required for the memory bootstrap scripts.

## Run the app

Foreground (any machine):

```bash
npm run dev
```

Detached background (recommended on Windows Git Bash, where `tmux` is not installed):

```bash
bash scripts/dev-server.sh start   # boot the dev server and wait for readiness
bash scripts/dev-server.sh status  # is it up? PID + log tail
bash scripts/dev-server.sh logs    # follow the server log
bash scripts/dev-server.sh stop    # shut it down
```

`start` is idempotent — it is a no-op when the server is already running, so it is safe at the top of every session.

Open <http://localhost:3000>.

The 3D office and UI render without credentials. Saving and changing notes requires a session: sign in or create an account with a username (or email) and password, or enter the shared demo workspace with one click. AI features are provider-backed and must be disclosed; AI-off capture is tags-only and routes notes to a visible Needs sorting holding area without calling Gemini. Uncategorized is reserved for AI classification fallback. Full offline-first capture is not yet supported.

## Deployment tracks

Notelings uses separate deployments for its two goals:

- **Portfolio demo:** a separate Vercel + Supabase project with sanitized seed data, ephemeral visitor writes, and a hard-capped/demo-safe AI policy.
- **Private workspace:** an authenticated Vercel + Supabase project with owner-scoped RLS and private notes.

Do not point a public demo at the private Supabase project. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the environment matrix, migration rehearsal, reset, smoke, backup, and rollback runbook.

## Validation

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run test:e2e
```

`npm run test:e2e` starts its own dev server when one is not already running. On a fresh machine, install Chromium once with `npx playwright install chromium`.

## Git/memory setup

`bash scripts/machine-sync.sh` is safe to run at the start of every session. It fetches `origin/main` only when the working tree is clean and automatically enables the committed `.githooks` directory when local Git config has not been set yet. The hook configuration is machine-local and is not transferred by GitHub.

The repository uses `main` and tracks `origin/main`:

```bash
git status --short --branch
git remote -v
git pull --ff-only
```

Never commit `.env.local`, build output, `node_modules`, or Playwright reports.
