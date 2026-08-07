'use client'
import dynamic from 'next/dynamic'

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

export default function Home() {
  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <OfficeCanvas />
    </main>
  )
}
