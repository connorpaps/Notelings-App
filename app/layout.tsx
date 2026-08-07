import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notelings — Second Brain Office',
  description: 'Gamified visual note organizer — 3D voxel office',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
