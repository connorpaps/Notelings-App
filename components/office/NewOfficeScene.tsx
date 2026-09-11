'use client'

import { Suspense } from 'react'
import { Html, useProgress } from '@react-three/drei'
import NewOfficeModel from './NewOfficeModel'
import AgentLayer from './AgentLayer'

function OfficeLoadStatus() {
  const { active, progress } = useProgress()
  if (!active) return null

  return (
    <Html center>
      <div className="w-52 rounded-2xl border border-slate-900/10 bg-white/85 px-4 py-3 text-center shadow-xl backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700">Waking the office</p>
        <p className="mt-1 text-xs text-slate-500">Loading the Librarians · {Math.round(progress)}%</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-900/10">
          <div className="h-full rounded-full bg-slate-700 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Html>
  )
}

export default function NewOfficeScene() {
  return (
    <group name="new-office-scene" userData={{ notelingsNewOffice: true }}>
      <OfficeLoadStatus />
      <Suspense fallback={null}>
        <NewOfficeModel />
        <AgentLayer />
      </Suspense>
    </group>
  )
}
