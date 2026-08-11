'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { NEW_OFFICE_MODEL_PATH, NEW_OFFICE_RECENTER } from './newOfficeLayout'

/**
 * The 3D Note Office GLB. Cloned (never reparent the useGLTF cache — React 19
 * StrictMode empties it; see lessons) and recentered so the floor center sits
 * at world origin, matching the static navigation grid in newOfficeGridData.
 */
export default function NewOfficeModel() {
  const { scene } = useGLTF(NEW_OFFICE_MODEL_PATH)

  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      // Opaque geometry casts; the floor and low furniture receive.
      const transparent = Array.isArray(mesh.material)
        ? mesh.material.some((m) => m.transparent)
        : mesh.material?.transparent
      mesh.castShadow = !transparent
      const box = new THREE.Box3().setFromObject(mesh)
      mesh.receiveShadow = box.min.y <= 0.05
    })
    return clone
  }, [scene])

  return <primitive object={model} position={[NEW_OFFICE_RECENTER[0], 0, NEW_OFFICE_RECENTER[2]]} />
}
