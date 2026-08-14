# DESIGN.md — Notelings (light paper-and-glass world)

Written from the light visual pass on 2026-08-14. The previous Bloom liquid-glass identity is retained as material language, but the shell now uses a calm light paper surface instead of the dark Skybridge image/scrim.

## World
**Light paper and frosted glass around a living office.** The colored 3D office remains the stage and the only large identity color. The 2D overlay is a clean control surface with layered white glass, soft neutral shadows, and a restrained paper vignette that keeps the diorama legible without competing with it.

## Palette
- Paper background: `#f6f7f5`, with a subtle neutral radial vignette.
- Primary text: charcoal `#172027`; secondary text: slate gray `#536168` through `#7f8c92`.
- Glass fills: `rgba(255,255,255,0.68)` for light panels and `rgba(255,255,255,0.84)` for strong panels.
- Glass borders: dark neutral alpha borders plus white inset highlights; shadows use cool neutral gray at low opacity.
- Identity color only: blue `#2fa8e0`, green `#43c98b`, red `#ef4444`. Demo cyan is reserved for the demo identity badge.
- Error/code surfaces may remain dark with white text when their contrast role requires it.

## Typography
- Poppins (`--font-sans`, weights 400/500/600) — display/body; headings weight 500.
- Source Serif 4 (`--font-serif`, normal + italic) — italic accents inside headings only.
- Radius token: `--radius: 1rem`.

## Glass tiers (`app/globals.css`)
- `.liquid-glass` — white translucent cards, 14px blur, visible neutral border, soft shadow, and inset highlight.
- `.liquid-glass-strong` — more opaque white panels, 28px blur, deeper shadow, and stronger inset highlight for the dock, CTA, welcome panel, and side rails.
- `.glass-glow-ring` — restrained neutral rotating edge highlight.
- `.glass-glow-halo` — soft white halo behind glass panels.

## Layering
Light paper background → transparent WebGL office (`z-10`) → light glass UI (`z-20`) → welcome/dock (`z-30`) → graph/modal surfaces above. The WebGL canvas remains alpha-enabled and the office remains unmodified.

## Components
- **Brand bar:** charcoal `notelings` wordmark, slate serif accent, neutral status pill.
- **Agent cards:** light glass cards with dark grayscale status copy and unchanged blue/green/red identity cues.
- **Spatial Board:** light glass right rail with readable charcoal headings, slate metadata, and layered note cards.
- **Command dock:** strong white glass panel with dark input text, visible borders, and dark-on-light controls.
- **Welcome hero:** strong white glass panel with charcoal headline, slate copy, destination pills, and high-contrast dark CTA text.
- **Toasts/modals:** light glass by default; deliberately dark alert/code surfaces retain white text.

## Motion
Keep the existing hover scale, glow ring, error pulse, queue transitions, focus traps, and reduced-motion behavior. No scene or movement changes are part of this visual pass.

## Responsive
Preserve the current right-rail/mobile bottom-sheet breakpoints, dock sizing, and hidden UI/nav controls.

## Preserved boundary
R3F scene content, robots, pathfinding, Zustand, Supabase, unit/E2E contracts, accessible names, toast copy, pointer-events layering, and the transparent canvas contract remain unchanged.
