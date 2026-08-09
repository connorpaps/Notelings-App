import type { Metadata } from 'next'
import './globals.css'
import { Poppins, Source_Serif_4 } from "next/font/google";
import { cn } from "@/lib/utils";

// Bloom reskin typography (reference: motionsites.ai bloom-ai-hero):
// Poppins is the shadcn `--font-sans` token (Display/Body, weight 500 headings);
// Source Serif 4 powers `--font-serif` italic accents inside headings.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: 'Notelings — Second Brain Office',
  description: 'Gamified visual note organizer — 3D voxel office',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", poppins.variable, serif.variable)}>
      <body>
        {
          // React renders a string child starting with `<!--` as a real HTML
          // comment node, so this direction contract survives into the built
          // markup where it can be audited.
          '<!-- THESIS: the office is the stage; a grayscale liquid-glass control surface floats over a looping video world. Refuses the category default of a flat dark dashboard around a 3D viewer. OWN-WORLD: Bloom liquid glass - .liquid-glass/.liquid-glass-strong tiers (blur 4/50px, inset highlights, masked gradient borders), Poppins + Source Serif 4 italic accents, strict grayscale text hierarchy, a subtle white glow ring rotating around card edges, tiny robot-color identity cues only. The colored 3D office is the only color on screen. STORY: a visitor sees a living video world with the office floating at its center; agent cards, the task queue, and the command dock read as frosted glass; typing a note sends a robot across the floor and a toast confirms the delivery. FIRST VIEWPORT: looping video fills the viewport (z-0); the transparent WebGL canvas floats the office center (z-10); a slim brand bar tops the overlay (z-20), three glass agent cards stack left, the glass task queue sits right, the liquid-glass-strong command dock anchors bottom-center, and the Bloom hero welcome panel centers over everything until dismissed. FORM: brief-pinned Bloom liquid-glass; no concept roll - the user pinned this direction from the bloom-ai-hero reference on 2026-08-09. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->'
        }
        {children}
      </body>
    </html>
  )
}
