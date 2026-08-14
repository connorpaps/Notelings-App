# Bloom liquid-glass UI reskin (Milestone 4.2)

**Date:** 2026-08-09 · **Status:** awaiting approval · **Revert point:** git tag `pre-ui-reskin` @ `2e3fcbc`

## Brief (user-pinned direction)

Redesign the 2D UI overlays of Notelings with the Bloom liquid-glass morphism aesthetic (motionsites.ai reference): looping video background, Poppins + Source Serif 4, strict grayscale palette, `.liquid-glass` / `.liquid-glass-strong` glass tiers, `hover:scale-105` interactions, rounded Lucide icons. The 3D office stays the centerpiece and **looks the same**. Existing overlays (3 Agent Cards, Task Queue, Input Dock) remain absolute-positioned over the canvas. NOT following the reference's two-panel split.

## Hard preserve boundary (do not touch)

R3F scene content (robots, pathfinding, Zustand store, camera, lights, shadows, SSAO/Bloom/ToneMapping profile), Supabase backend + `/api/categorize`, unit tests, E2E scene/render-profile/toast assertions, accessible names (`Initialize Agents`, `Type a new note`, `Submit note`), pointer-events contract (root `none`, interactives `auto`), toast copy.

## Steps

### 0. Revert point ✅ done
`git tag pre-ui-reskin` at HEAD `2e3fcbc`. Reskin ships as staged commits on `main`, never pushed.

### 1. Impeccable ceremony (product truth + world record)
- Create `PRODUCT.md` (product truth, brief-pinned Bloom direction, preserved boundary) — init flow per skill.
- Direction contract comment in `app/page.tsx` emitted markup (THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM / FINISH).
- `DESIGN.md` written at finish from the built world (documenter), not before.

### 2. Foundation
- **Fonts** (`app/layout.tsx`): swap Inter/Outfit → `Poppins` (`--font-sans`, weights 400/500/600) + `Source Serif 4` (`--font-serif`, incl. italic). `app/globals.css` `@theme`: add `--font-serif`.
- **Radius:** `--radius: 0.625rem` → `1rem` (reference token).
- **Glass CSS** (`app/globals.css` `@layer components`), exactly per reference:
  - `.liquid-glass`: `rgba(255,255,255,0.01)` + `background-blend-mode: luminosity`; `backdrop-filter: blur(4px)`; inset highlight `0 1px 1px rgba(255,255,255,0.1)`; `::before` gradient border `linear-gradient(180deg, rgba(255,255,255,.45) 0%, .15 20%, transparent 40%, transparent 60%, .15 80%, .45 100%)`, `padding: 1.4px`, `-webkit-mask-composite: xor` / `mask-composite: exclude`.
  - `.liquid-glass-strong`: `blur(50px)`, `box-shadow: 4px 4px 4px rgba(0,0,0,.05)` + inset `0 1px 1px rgba(255,255,255,.15)`, `::before` at 0.5/0.2 alphas.
- **Video background:** new `components/notelings/BackgroundVideo.tsx` — `<video autoPlay muted loop playsInline preload="metadata" class="absolute inset-0 z-0 h-full w-full object-cover">` (provided CloudFront URL **or vendored copy — open decision Q2**) + subtle grayscale dark overlay (`bg-black/40`-ish) for text legibility.
- **`app/page.tsx`:** video `z-0` → Canvas wrapper `bg-transparent` `z-10` → `NotelingsUI` `z-20`.
- **`OfficeCanvas.tsx` (minimal, scene untouched):** `gl.alpha: false → true`; remove `<color attach="background">`. Fallback if postprocessing blocks alpha: `scene.background = THREE.VideoTexture` (same visual). Render-profile/E2E contracts unchanged.

### 3. Component reskin (grayscale liquid glass, Poppins, serif accents)
- `WelcomeScreen` → Bloom-hero glass panel: Poppins headline with a Source Serif italic accent word, tagline, `Initialize Agents` liquid-glass-strong pill (keep a11y name), three destination pills (Work Whiteboard / Printer / Corkboard) — optional per Q4.
- `AgentStatusCard` → `.liquid-glass` cards; icon in `w-8 h-8 rounded-full bg-white/10`; grayscale hierarchy (`text-white/80`, `/60`); `hover:scale-105`; red error pulse kept but rendered in glass/grayscale (3D red glow unchanged). Identity dot option = Q3.
- `TaskQueuePanel` → `.liquid-glass`, grayscale, AnimatePresence list preserved.
- `CommandDock` → `.liquid-glass-strong` pill; Send icon in `w-7 h-7 rounded-full bg-white/15` circle; `hover:scale-105 active:scale-95`; grayscale error pill.
- `NotelingsUI` → z-layering update; optional slim top brand bar (wordmark + pill) per Q4; pointer-events + a11y preserved.
- Sonner `Toaster` → grayscale glass restyle.

### 4. Validation (bounded)
`tsc` 0 · 83/83 unit tests · lint 0 errors · `npm run build` · E2E 3/3. One batched browser round (desktop + mobile screenshots): video behind office, glass renders, text readable, zero console errors → one fix batch → at most one confirmation round. Then `node .agents/skills/impeccable/scripts/detect.mjs --json` on changed targets, finish review, `DESIGN.md`, memory updates (`handoff.md`/`knowledge.md`), staged commits (never push).

## Open decisions (grill)
1. Canvas alpha change consent + fallback.
2. Video: hotlink vs vendor 12.4 MB into `/public`.
3. Agent identity: strict grayscale vs tiny color dot.
4. Layout scope: restyle-only vs + Bloom top bar / destination pills.
5. Welcome screen: keep (reskinned hero) vs remove.
