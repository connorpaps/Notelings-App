import type { Metadata } from 'next'
import './globals.css'
import { Inter, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";

// Inter keeps the shadcn `--font-sans` token; Outfit is the display/headline font.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: 'Notelings — Second Brain Office',
  description: 'Gamified visual note organizer — 3D voxel office',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, outfit.variable)}>
      <body>{children}</body>
    </html>
  )
}
