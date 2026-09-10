import type { Metadata } from 'next'
import './globals.css'
import { Poppins, Source_Serif_4 } from "next/font/google";
import { cn } from "@/lib/utils";

// Current light paper-and-glass typography (retained from the Bloom reskin):
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

// Keep the visual direction contract auditable without rendering it into the
// page body. A body string beginning with `<!--` is ordinary visible text in
// React; metadata is the correct non-visual home for this internal contract.
const DIRECTION_CONTRACT = `THESIS: the office is the stage; a light paper-and-glass control surface floats over a calm paper world.
OWN-WORLD: Bloom liquid glass with Poppins, Source Serif 4 italic accents, strict grayscale hierarchy, subtle monochrome glow rings, and tiny robot-color identity cues.
STORY: a visitor sees a calm paper world with the office at its center; typing a note sends a robot across the floor and a toast confirms delivery.
FIRST VIEWPORT: paper surface, transparent WebGL office, slim brand bar, three glass agent cards, right-side task queue, bottom command dock, and centered welcome panel.
FORM: brief-pinned Bloom liquid-glass from bloom-ai-hero.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.`

export const metadata: Metadata = {
  title: 'Notelings — Second Brain Office',
  description: 'Gamified visual note organizer — 3D voxel office',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", poppins.variable, serif.variable)}>
      <head>
        <meta name="notelings-direction-contract" content={DIRECTION_CONTRACT} />
      </head>
      <body>{children}</body>
    </html>
  )
}
