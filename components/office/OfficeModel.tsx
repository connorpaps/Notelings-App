'use client'
import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import type { ModelPlacement } from './officeLayout'
import { cellToWorld } from './officeLayout'

/**
 * Loads a MagicaVoxel OBJ + its MTL palette texture and normalizes it so the
 * group origin sits at the bottom-center of the model's bounding box. This
 * makes `cell`-based placement predictable regardless of raw OBJ offsets.
 */
function OfficeModel({ placement }: { placement: ModelPlacement }) {
  const { obj, mtl, cell, rotationY = 0, scale = 1, elevationY = 0 } = placement

  // 1) Materials — MTLLoader auto-resolves the MTL's relative map_Kd PNG path
  // against the MTL file's own directory (e.g. .../Tables/), which is exactly
  // where the PNGs live, so no setResourcePath is needed.
  const materials = useLoader(MTLLoader, mtl)

  // 2) Geometry with materials pre-injected
  const object = useLoader(OBJLoader, obj, (loader) => {
    loader.setMaterials(materials)
  })

  // 3) Normalize once: center on X/Z, floor on Y (origin = bottom-center)
  const normalized = useMemo(() => {
    if (!object) return null
    const box = new THREE.Box3().setFromObject(object)
    const center = box.getCenter(new THREE.Vector3())
    const group = new THREE.Group()
    group.add(object)
    object.position.set(-center.x, -box.min.y, -center.z)
    group.scale.setScalar(scale)
    group.position.set(0, elevationY, 0)
    return { group }
  }, [object, scale, elevationY])

  // 4) Dispose on unmount (R3F does NOT auto-dispose raw loader results)
  useEffect(() => {
    return () => {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        }
      })
    }
  }, [object])

  const [x, z] = cellToWorld(cell[0], cell[1])
  if (!normalized) return null

  return (
    <group position={[x, 0, z]} rotation-y={rotationY}>
      <primitive object={normalized.group} />
    </group>
  )
}

export default OfficeModel
