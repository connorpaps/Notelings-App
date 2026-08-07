'use client'
import { Suspense, useMemo } from 'react'
import { Html } from '@react-three/drei'
import OfficeModel from './OfficeModel'
import Floor from './Floor'
import Walls from './Walls'
import { PLACEMENTS } from './officeLayout'

function LoadingFallback() {
  return (
    <Html center>
      <div
        style={{
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          opacity: 0.7,
        }}
      >
        assembling office…
      </div>
    </Html>
  )
}

export default function VoxelOffice() {
  const furniture = useMemo(
    () =>
      PLACEMENTS.filter((p) => (p.elevationY ?? 0) === 0).map((p) => (
        <OfficeModel key={p.id} placement={p} />
      )),
    [],
  )

  return (
    <group>
      <Floor />
      <Walls />
      <Suspense fallback={<LoadingFallback />}>{furniture}</Suspense>
    </group>
  )
}
