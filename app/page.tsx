'use client'

import dynamic from 'next/dynamic'
import { ENABLE_OFFICE_BUILDER } from '@/components/office/officeMode'
import Milestone3VerificationOverlay from '@/components/office/Milestone3VerificationOverlay'

// WebGL scene must not be SSR'd (three needs browser APIs)
const OfficeCanvas = dynamic(() => import('@/components/office/OfficeCanvas'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100vh',
        color: '#8a8f98',
        fontFamily: 'system-ui',
      }}
    >
      loading 3D office…
    </div>
  ),
})

const OfficeBuilderApp = ENABLE_OFFICE_BUILDER
  ? dynamic(() => import('@/components/office/OfficeBuilderApp'), { ssr: false })
  : null

export default function Home() {
  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      {OfficeBuilderApp ? <OfficeBuilderApp /> : <OfficeCanvas />}
      <Milestone3VerificationOverlay enabled={!ENABLE_OFFICE_BUILDER} />
    </main>
  )
}
