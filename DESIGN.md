# DESIGN.md — Notelings (static white liquid-glass world)

Written from the built world after the M4.2 reskin (2026-08-09). Replaces the pre-reskin colorful gradient-card overlay language; the 3D office visual contract is deliberately unchanged.

## World
**Bloom liquid glass over a static white world.** The office is the stage: a colored 3D diorama floating center-screen above a quiet white surface. Dark frosted-glass controls preserve contrast against the white world, while the office remains the visual focus. The glow-features border DNA from `UI_PROMPTS.md` survives as a subtle monochrome glow ring rotating around glass edges (never multicolor).

## Palette
- Strict grayscale text hierarchy: `text-white` / `text-white/80` / `text-white/60` / `text-white/50` / `text-white/40`.
- Glass fills: Bloom glass tiers, with a static-world dark-glass override (`rgba(10,18,30,0.86)`) so the existing white type remains legible against the white background.
- Identity color only (robot cues): blue `#2fa8e0`, green `#43c98b`, red `#ef4444` — small glowing dot + tinted icon on agent cards; red card pulses on error. No other accents.

## Typography
- Poppins (`--font-sans`, weights 400/500/600) — display/body; headings weight 500.
- Source Serif 4 (`--font-serif`, normal + italic) — italic accents inside headings only (e.g. "Spatial Second *Brain*", "Global Task *Queue*").
- Radius token: `--radius: 1rem`.

## Glass tiers (`app/globals.css` `@layer components`)
- `.liquid-glass` (cards, queue, pills): blur 4px, inset top highlight, `::before` masked 1.4px gradient border (vertical white gradient, xor/exclude mask).
- `.liquid-glass-strong` (dock, CTA, welcome panel): blur 50px, 4px drop shadow, stronger inset highlight, 0.5/0.2 border alphas.
- `.glass-glow-ring`: `@property --glass-glow-angle` conic-gradient ring, 1.5px, masked, spinning 8s linear — the rotating edge glow.
- `.glass-glow-halo`: blurred white wash behind glass panels.

## Layering
Static white background `z-0` → transparent WebGL office `z-10` (canvas `alpha: true`, no scene background) → glass UI `z-20` → welcome/dock `z-30` → sonner toasts bottom-right.

## Components
- **Brand bar**: dark `notelings` wordmark (Poppins semibold, tracking-tighter) + muted serif italic "second brain"; live "N agents online" dark-glass pill with a pulsing white dot.
- **Agent cards** (left, 3): dark glass, icon in white/10 circle tinted with the robot color, glowing identity dot, grayscale status; red pulses on error; gentle hover lift.
- **Task queue** (right, hidden below `lg`): dark glass, serif-accent heading, count pill, AnimatePresence note list.
- **Command dock** (bottom-center): strong glass pill, ghost input, submit button with the reference's icon-in-circle CTA anatomy; `hover:scale-105 active:scale-95`.
- **Welcome hero**: strong glass panel, tracked overline, Poppins headline with serif italic accent, tagline, three destination pills (Whiteboard/Printer/Corkboard), `Initialize Agents` CTA.
- **Toasts**: dark glass (`rgba(10,10,11,0.72)`, blur, white text), bottom-right.

## Motion
Interactive elements `hover:scale-105 active:scale-95` (framer `whileHover` on the welcome CTA); glow ring continuous spin; error card opacity pulse; queue list AnimatePresence.

## Responsive
Right rail hidden below `lg`; cards and dock shrink with `min()` widths; the white background remains fixed and non-animated.

## Preserved boundary
R3F scene content, robots, pathfinding, Zustand, Supabase, unit/E2E contracts, accessible names, toast copy — unchanged. The canvas remains transparent with no scene background (verified by E2E corner-pixel alpha); only the layer-0 background and renderer DPR range changed.
