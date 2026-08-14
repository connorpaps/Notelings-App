// LEGACY office (M1–M4 voxel/OBJ composition). NOT mounted since the 2026-08-10
// GLB swap; kept intact as a backup (git tag `pre-new-office`). If re-enabled,
// re-point AgentLayer + agentDestinations at the legacy agentGrid modules.

'use client'

import { lazy, Suspense } from 'react'
import OfficeLockedScene from './OfficeLockedScene'
import AgentLayer from './AgentLayer'
import { ENABLE_OFFICE_BUILDER } from './officeMode'

const OfficeBuilderScene = lazy(() => import('./OfficeBuilderScene'))

/** The released office is static; the builder remains a deliberate opt-in. */
export default function VoxelOffice() {
  if (!ENABLE_OFFICE_BUILDER) {
    return (
      <>
        <OfficeLockedScene />
        <AgentLayer />
      </>
    )
  }
  return (
    <Suspense fallback={null}>
      <OfficeBuilderScene />
    </Suspense>
  )
}
