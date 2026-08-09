'use client'

import dynamic from 'next/dynamic'
import { ENABLE_OFFICE_BUILDER } from '@/components/office/officeMode'
import NotelingsUI from '@/components/notelings/NotelingsUI'
import StaticBackground from '@/components/notelings/StaticBackground'

// WebGL scene must not be SSR'd (three needs browser APIs)
const OfficeCanvas = dynamic(() => import('@/components/office/OfficeCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="office-loading flex h-full w-full items-center justify-center bg-transparent text-white/50"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      loading 3D office…
    </div>
  ),
})

const OfficeBuilderApp = ENABLE_OFFICE_BUILDER
  ? dynamic(() => import('@/components/office/OfficeBuilderApp'), { ssr: false })
  : null

// Static world layering: white background (z-0) → transparent WebGL office
// (z-10) → glass UI overlay (z-20). The office stays the centerpiece.
export default function Home() {
  return (
    <main className="static-white-world relative h-dvh w-full overflow-hidden bg-white">
      <StaticBackground />
      <div className="absolute inset-0 z-10 bg-transparent">
        {OfficeBuilderApp ? <OfficeBuilderApp /> : <OfficeCanvas />}
      </div>
      <NotelingsUI enabled={!ENABLE_OFFICE_BUILDER} />
    </main>
  )
}
