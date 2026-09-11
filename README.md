# Notelings

## Spatial Second Brain Office

**Notelings turns a captured thought into a visible workflow.** Type a note, optionally let Gemini categorize it, and watch a capsule-shaped Librarian agent carry it through a navigable 3D office to a physical destination.

[![CI](https://github.com/connorpaps/Notelings-App/actions/workflows/ci.yml/badge.svg)](https://github.com/connorpaps/Notelings-App/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-9.7-20232A?logo=three.js&logoColor=white)](https://r3f.docs.pmnd.rs/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**[Open the live demo](https://notelings-portfolio.vercel.app/)** · **[View the source](https://github.com/connorpaps/Notelings-App)**

> Portfolio demo, not an unrestricted SaaS product. The public workspace uses fictional seed data, resettable visitor writes, application-level AI ceilings, and deterministic degraded behavior when AI is unavailable.

![Current Notelings landing view showing the centered 3D office and recruiter-first demo entry.](docs/images/notelings-desktop-overview.png)

## Why this project exists

Most note apps hide their operational state behind lists and status labels. Notelings makes that state observable:

- A note is captured through a glass control surface.
- A strict categorization contract returns `Work`, `Admin`, or `Uncategorized` plus bounded tags.
- The authenticated server route persists the note to owner-scoped Supabase data.
- A Zustand queue dispatches the work to an idle agent.
- The agent follows a validated A* path across the active GLB office.
- The destination, board column, terminal log, toast, Realtime mirror, and agent face update together.

AI is optional. AI-off capture saves a manually created note without calling Gemini and routes it to **Needs sorting**.

## One-minute recruiter walkthrough

1. Open the live app and select **Enter demo workspace**. No account is required.
2. Review the centered office, three agent cards, Spatial Board, and Command Dock.
3. Capture a note with AI on, or switch AI off to demonstrate the deterministic manual path.
4. Watch the Librarian pick up the note, navigate the office, and file it at a category destination.
5. Open **Graph** to inspect the current tag-to-note Knowledge Graph, or use **Ask AI** for grounded answers with citations.

The demo is deliberately resettable, so the workflow can be shown repeatedly without using personal data.

## Current product surface

### The office is the interface

![Current populated Notelings workspace with the centered office, translucent Spatial Board overlay, agent cards, and Command Dock.](docs/images/notelings-delivery-flow.png)

The active office is a detailed GLB scene. It is not a decorative background or a screenshot behind a dashboard. The interface stays layered over it so the physical delivery is the primary feedback loop.

Three code-generated capsule agents have distinct roles:

- **Blue Agent, Librarian:** dispatches and files notes.
- **Green Agent, Archivist:** available for delivery work and archive operations.
- **Red Agent, Security / Error:** visible sentinel for failures and recovery states.

The current desktop composition keeps the office directly centered. The Spatial Board remains a readable translucent overlay rather than moving the office into a separate lane.

### Knowledge Graph

![Current Notelings Knowledge Graph overlay showing tag hubs and note satellites over the office.](docs/images/notelings-knowledge-graph.png)

The graph is a bounded, readable bipartite view:

- Tag hubs connect to note satellites, rather than producing a note-to-note hairball.
- Archived notes are excluded.
- The force layout is warmed once and then frozen, avoiding a permanent physics loop beside WebGL.
- Selecting a note opens a side peek for grounded inspection and editing.

### Responsive control surface

![Current Notelings mobile control surface with the office still visible behind the glass agent card and note composer.](docs/images/notelings-mobile-overview.png)

Desktop is the primary 3D showcase. Mobile is a supported control surface with safe-area padding, larger touch targets, compact controls, and capability-aware rendering. The office remains visible instead of being replaced by a static mobile dashboard.

## Technical highlights

- **3D runtime:** React Three Fiber, Three.js, Drei, and a transparent orthographic canvas.
- **Active asset:** `public/models/3D_Note_Office_2/3d_note_office.glb`.
- **Navigation:** baked 42×42 grid, four-direction A*, reachable destination checks, and runtime path-safety validation.
- **State:** Zustand owns the note mirror, agent state, task queue, completion events, and view controls.
- **Persistence:** Next.js route handlers backed by Supabase Postgres, Auth, and Realtime.
- **AI:** Vercel AI SDK with Google Gemini for bounded categorization, grounded Librarian chat, and embeddings retrieval.
- **Validation:** Zod contracts, server-side session checks, origin guards, rate limits, redacted observability, and focused Playwright contracts.
- **Accessibility:** keyboard-friendly dialogs, focus trapping and restoration, Escape handling, reduced-motion support, and responsive touch targets.

### Performance work

The office asset was optimized with standard Meshopt geometry compression and WebP textures:

| Measurement | Result |
| --- | ---: |
| Original GLB | approximately 18.22 MB |
| Optimized GLB | approximately 2.90 MB |
| Repository asset budget | 4 MB |
| Browser transfer observed locally | approximately 1.93 MB |
| Measured desktop renderer improvement at device scale 2 | approximately 35.6 → 80.9 FPS |
| Measured mobile backbuffer | reduced from 780×1688 to 390×844 |

These are local, device- and browser-dependent measurements, not a universal FPS guarantee. The renderer uses high and balanced capability profiles, capped DPR, and reduced postprocessing on constrained devices while preserving the full office scene.

## Architecture

```text
Command Dock
    │
    ├── AI on  ──> /api/categorize ──> Gemini + Zod contract ──┐
    └── AI off ──> /api/notes ─────────────────────────────────┤
                                                               ▼
                                                   Supabase persistence
                                                               │
                                                   Zustand task queue
                                                               │
                                                   Blue/Green agent
                                                               │
                                                    42×42 A* grid
                                                               │
                                                    Physical destination
                                                               │
                                      Board + Realtime + terminal + toast
```

The active scene is composed in `components/office/NewOfficeScene.tsx`:

```text
OfficeCanvas
└── NewOfficeScene
    ├── NewOfficeModel        active GLB office
    └── AgentLayer             capsule robots and delivery state

NotelingsUI
├── WelcomeScreen             demo/private entry
├── AgentStatusCard           live agent state
├── Spatial Board             pending, in transit, filed
├── Command Dock              capture and Librarian chat
├── Terminal Dock             lifecycle log and tools
└── Knowledge Graph            frozen tag-to-note visualization
```

The retired OBJ/builder implementation remains under [`archive/legacy-office/`](archive/legacy-office/README.md) for historical reference only. It is outside the shipped runtime.

## Technology stack

| Area | Current implementation |
| --- | --- |
| App | Next.js 16.3.4 App Router, React 19.2, TypeScript 5 |
| UI | Tailwind CSS v4, Base UI, shadcn components, Framer Motion |
| 3D | React Three Fiber 9.7, Three.js 0.185, Drei 10.7 |
| Graph | `react-force-graph-2d` with a frozen layout |
| State | Zustand 5 |
| Data | Supabase Postgres, Auth, Realtime |
| AI | Vercel AI SDK 7, Google Gemini, Zod 4 |
| Testing | Vitest 4, Playwright 1.62, serial WebGL smoke coverage |
| Delivery | GitHub Actions and Vercel |

## Run locally

### Requirements

- Node.js 22.x
- npm and Git
- Git Bash on Windows for the repository helper scripts
- Supabase and Gemini environment values for authenticated/provider-backed flows

```bash
npm ci
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

The app shell and office can render without provider credentials. Real authentication, persistence, Realtime, categorization, and chat require the environment described by `.env.example`. Never commit `.env.local` or any credentials.

## Verification

The current release pass has verified:

- 228/228 unit tests
- TypeScript typecheck
- ESLint
- Production build
- `npm audit --omit=dev --audit-level=high`, zero production vulnerabilities
- Optimized office asset under the 4 MB budget
- `git diff --check`
- Serial Playwright browser coverage, with WebGL tests run using `--workers=1`
- Live health, first-click demo entry, seeded workspace, Realtime connection, note capture, board, graph, chat surface, and mobile composition

Run the gates locally:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
CI=1 npm run test:e2e -- --workers=1
```

WebGL tests are intentionally serial on constrained SwiftShader environments. Use a fresh `CI=1` test server rather than diagnosing a reused signed-out development server.

## Security and product boundaries

- Private notes are owner-scoped through Supabase Auth and RLS.
- Service-role keys remain server-only.
- AI processing is disclosed and can be bypassed with manual capture.
- Request logging redacts note content, prompts, provider responses, tokens, cookies, and embeddings.
- Gemini, Supabase, and Vercel allowances depend on provider plans and can change. The demo uses application-level ceilings and deterministic fallback; it is not advertised as permanently free.
- Physics/colliders, rigged robot animation, multi-user sync, and unrestricted public SaaS behavior are intentionally out of scope.
- This public repository has no license. **All rights reserved.**

More detail is available in [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md), [`docs/architecture/runtime.md`](docs/architecture/runtime.md), and [`docs/architecture/data-and-security.md`](docs/architecture/data-and-security.md).

## Repository map

```text
app/                  pages, layouts, route handlers, auth callbacks
components/notelings/ glass UI, board, dock, graph, chat, note controls
components/office/    active GLB scene, agents, A*, grid, render profiles
lib/                  note/domain logic, AI helpers, auth, Supabase clients
supabase/             schema and reviewed migrations
e2e/                  browser contracts and recruiter-flow smoke tests
docs/architecture/    current runtime and security documentation
docs/images/          curated, sanitized README captures
scripts/               development, asset, performance, and smoke tooling
archive/legacy-office/ historical inactive OBJ implementation
```

## Links

- **Live demo:** https://notelings-portfolio.vercel.app/
- **GitHub repository:** https://github.com/connorpaps/Notelings-App
- **CI workflow:** https://github.com/connorpaps/Notelings-App/actions/workflows/ci.yml
