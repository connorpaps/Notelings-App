# Data & Security Architecture

## Workspace modes

The deployed application uses one Vercel project with trusted path-derived modes:

- `/` — private workspace backed by the private Supabase project.
- `/demo` — isolated portfolio workspace backed by the demo Supabase project.

The server derives the mode from the trusted request path. Browser-provided project or mode selectors are not trusted. Mode-specific Supabase clients and Auth cookie names prevent the demo path from reading private rows.

## Supabase boundary

- Notes are owner-scoped in Postgres with Auth-backed RLS.
- Browser clients receive only public anon configuration and use Realtime/session behavior; service-role keys remain server-only.
- All note mutations flow through authenticated Next.js routes.
- The current schema supports `Work`, `Admin`, `Uncategorized`, and `Manual` categories plus `pending`, `in_transit`, `filed`, and `archived` statuses.
- Realtime mirrors database changes into the client board; it is not multi-user synchronization for unrelated workspaces.
- Schema changes belong in reviewed, idempotent Supabase migrations and are outside repository cleanup.

## Request boundaries

API routes verify same-origin behavior, authenticated session state, request schemas, bounded input, and route-specific rate limits. Observability records request IDs, status, and duration without logging note content, prompts, provider messages, tokens, cookies, or embeddings.

The in-memory rate limits are an application safeguard, not a complete shared abuse boundary for a multi-instance public service. The portfolio demo therefore also uses an application-level AI budget and deterministic/degraded fallback.

## AI and privacy

- Gemini is used for categorization, grounded Librarian chat, and embeddings when retrieval needs them.
- The UI should disclose provider-backed processing before users submit notes.
- AI-off capture uses tags-only/manual routing and does not call Gemini.
- Chat is grounded in the authenticated workspace’s non-archived notes, uses deterministic counting where applicable, and refuses unsupported context rather than inventing an answer.
- The demo uses fictional seed data, an isolated database, a shared demo account, hard daily AI ceilings, and resettable visitor writes. It must never be configured with private Supabase credentials or private note data.

## Secrets policy

Never commit `.env`, `.env.local`, `.env.demo.local`, service-role keys, Gemini keys, Supabase Management tokens, passwords, test auth bypass variables, or cookies. Use `.env.example` as the non-secret variable map. Deployment environments must keep `SUPABASE_ACCESS_TOKEN` and `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` out of Preview and Production.

## Release posture

Notelings is a tested portfolio product and private-workspace prototype, not a claim of unrestricted public SaaS readiness. Before using real sensitive notes, verify the private deployment, owner-scoped RLS, backups, provider privacy settings, and the actual deployment’s security-header/browser smoke results.
