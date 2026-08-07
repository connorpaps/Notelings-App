'use client'
import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import type { ModelPlacement } from './officeLayout'
import { cellToWorld } from './officeLayout'

/**
 * Loads a MagicaVoxel OBJ + its MTL palette texture via useLoader (suspends).
 * The OBJ files are Y-up with the model floor at y=0, so the raw model group
 * can be placed directly at the cell origin; per-model tuning (scale, rotation,
 * elevation) is handled by the placement config on the wrapping group.
 *
 * IMPORTANT: useLoader caches ONE object instance per URL, and several
 * placements reuse the same asset (chairs 1/3, chairs 2/4, plants). A cached
 * object can only have one parent in three.js, so we clone per placement —
 * geometry/materials stay shared; only the object graph is duplicated.
 */
function OfficeModel({ placement }: { placement: ModelPlacement }) {
  const { obj, mtl, cell, rotationY = 0, scale = 1, elevationY = 0 } = placement

  // Materials — MTLLoader auto-resolves the MTL's relative map_Kd PNG paths
  // against the MTL file's own directory (e.g. .../Tables/), where the PNGs live.
  const materials = useLoader(MTLLoader, mtl)

  // Geometry with materials pre-injected
  const object = useLoader(OBJLoader, obj, (loader) => {
    loader.setMaterials(materials)
  })

  // Clone the cached object so repeated asset URLs (chairs, plants) each get
  // their own mount — sharing the raw cached group under two <primitive>s
  // would reparent it (three.js single-parent rule) and empty the first one.
  const instance = useMemo(() => object.clone(), [object])

  const [x, z] = cellToWorld(cell[0], cell[1])

  return (
    <group
      name={placement.id}
      position={[x, elevationY, z]}
      rotation-y={rotationY}
      scale={scale}
    >
      <primitive object={instance} />
    </group>
  )
}

export default OfficeModel
