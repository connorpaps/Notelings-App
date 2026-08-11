'use client'

import { Suspense } from 'react'
import NewOfficeModel from './NewOfficeModel'
import AgentLayer from './AgentLayer'

export default function NewOfficeScene() {
  return (
    <group name="new-office-scene" userData={{ notelingsNewOffice: true }}>
      <Suspense fallback={null}>
        <NewOfficeModel />
      </Suspense>
      <AgentLayer />
    </group>
  )
}
