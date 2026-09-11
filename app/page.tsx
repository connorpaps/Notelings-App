'use client'

import dynamic from 'next/dynamic'
import GridEditorPanel from '@/components/office/GridEditorPanel'
import NotelingsUI from '@/components/notelings/NotelingsUI'
import PaperWorldBackground from '@/components/notelings/PaperWorldBackground'
import { useOfficeViewStore } from '@/components/office/officeViewStore'

// WebGL scene must not be SSR'd (three needs browser APIs)
const OfficeCanvas = dynamic(() => import('@/components/office/OfficeCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center bg-transparent px-6 text-center text-sm text-slate-500"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <span role="status">Preparing your office…</span>
    </div>
  ),
})

// Paper surface (z-0) → transparent WebGL office (z-10) → glass UI overlay
// (z-20). The office stays the colored centerpiece above the paper world.
export default function Home() {
  const gridEditorOpen = useOfficeViewStore((state) => state.gridEditorOpen)

  return (
    <main className="light-world relative h-dvh w-full overflow-hidden bg-[#f6f7f5]">
      <PaperWorldBackground />
      <div className="notelings-office-stage absolute inset-y-0 left-0 z-10 bg-transparent">
        <OfficeCanvas />
      </div>
      <NotelingsUI />
      {/* Nav Grid Editor — hidden by default, toggled from the header controls. */}
      {gridEditorOpen && <GridEditorPanel />}
    </main>
  )
}
