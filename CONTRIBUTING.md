# Contributing to Notelings

Thanks for taking an interest in the project. Notelings is a portfolio product and an experimental visual note-organizer; focused, reviewable changes are preferred over broad rewrites.

## Before opening a change

1. Read [`README.md`](README.md), [`PRODUCT.md`](PRODUCT.md), and [`DESIGN.md`](DESIGN.md).
2. Check [`docs/architecture/`](docs/architecture/) for active runtime and data boundaries.
3. Keep changes scoped to one behavior or documentation concern.
4. Do not include secrets, private notes, credentials, generated reports, or personal recordings.

## Local validation

```bash
npm ci
npx tsc --noEmit
npm test
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
CI=1 npm run test:e2e -- --workers=1
```

For the GLB/WebGL suite, run Playwright against a fresh server with `CI=1` and one worker. Review screenshots for desktop/mobile regressions and keep the transparent office/overlay pointer contract intact.

## Pull requests

Describe the user-visible behavior, the architectural boundary touched, validation commands, and any known limitations. Database or deployment changes require explicit review and must not include credentials.
