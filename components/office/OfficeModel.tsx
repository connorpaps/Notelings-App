'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { MTLLoader, OBJLoader } from 'three-stdlib'
import * as THREE from 'three'
import type { ModelPlacement } from './officeLayout'
import { cellToWorld } from './officeLayout'

/** Load one OBJ with its adjacent MTL, then clone it for each placement. */
function wallSideOffset(placement: ModelPlacement, anchorX: number, wallOffset: number): number {
  return placement.wallSide === 'left' ? anchorX + wallOffset : anchorX
}

export type OfficeModelProps = {
  placement: ModelPlacement
  name?: string
  transform?: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
  groupRef?: React.Ref<THREE.Group>
  selected?: boolean
  onSelect?: (event: ThreeEvent<MouseEvent>) => void
  children?: React.ReactNode
}

function OfficeModel({ placement, name = placement.id, transform, groupRef, selected = false, onSelect, children }: OfficeModelProps) {
  const { obj, mtl, cell, rotationY = 0, scale = 1, elevationY = 0, wallOffset = 0 } = placement
  const materials = useLoader(MTLLoader, mtl)
  const invalidate = useThree((state) => state.invalidate)
  materials.preload()
  // OBJLoader is cached by loader class in R3F. Do not mutate the shared
  // loader with setMaterials: concurrent assets all use the same `palette`
  // material name, so one placement can otherwise inherit another texture.
  const object = useLoader(OBJLoader, obj)

  const instance = useMemo(() => {
    const clone = object.clone()
    clone.userData.notelingsSource = { obj, mtl }
    return clone
  }, [object, obj, mtl])

  const configuredInstanceRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    if (configuredInstanceRef.current === instance) return
    configuredInstanceRef.current = instance
    const configuredMaterials: THREE.Material[] = []

    instance.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh

      // Keep these flags on the cloned scene graph rather than relying only on
      // the loader defaults; this covers every imported model in both builder
      // and locked scenes.
      mesh.castShadow = true
      mesh.receiveShadow = true

      const materialList: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = materialList.map((material) => {
        // Every pack OBJ references `usemtl palette`, while OBJLoader's
        // unconfigured fallback is an untextured gray material. Resolve the
        // OBJ name against this placement's own MTL creator, then fall back to
        // that creator's palette for assets whose parsed name is blank.
        const sourceMaterial = materials.materials[material.name] ?? materials.materials.palette ?? material
        if (!(sourceMaterial instanceof THREE.MeshBasicMaterial)) return sourceMaterial.clone()

        // MeshBasicMaterial ignores scene lights. Preserve its visible texture
        // and key alpha/render settings while upgrading it to a lit material.
        const basicMaterial = sourceMaterial
        return new THREE.MeshStandardMaterial({
          color: basicMaterial.color,
          map: basicMaterial.map,
          alphaMap: basicMaterial.alphaMap,
          transparent: basicMaterial.transparent,
          opacity: basicMaterial.opacity,
          side: basicMaterial.side,
          fog: basicMaterial.fog,
          depthTest: basicMaterial.depthTest,
          depthWrite: basicMaterial.depthWrite,
          blending: basicMaterial.blending,
          vertexColors: basicMaterial.vertexColors,
          wireframe: basicMaterial.wireframe,
        })
      })

      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
      clonedMaterials.forEach((material) => {
        configuredMaterials.push(material)
        const texturedMaterial = material as THREE.Material & {
          userData: Record<string, unknown>
          map?: (THREE.Texture & { image?: { src?: string } }) | null
        }
        if (texturedMaterial.map) {
          texturedMaterial.map.colorSpace = THREE.SRGBColorSpace
          texturedMaterial.map.needsUpdate = true
        }
        texturedMaterial.userData.notelingsLightingConfigured = true
        texturedMaterial.userData.notelingsSourceMtl = mtl
        texturedMaterial.userData.notelingsHasMap = Boolean(texturedMaterial.map)
        texturedMaterial.userData.notelingsTextureSource =
          typeof texturedMaterial.map?.image?.src === 'string' ? texturedMaterial.map.image.src : null
      })
    })

    // Material assignment runs in an effect after the demand-frame that
    // resolved Suspense. Explicitly request a frame so refreshes cannot leave
    // the pre-material (untextured) draw on screen.
    invalidate()

    return () => {
      // These are per-instance material clones. Their maps remain shared with
      // the MTL cache and are intentionally not disposed here.
      configuredMaterials.forEach((material) => material.dispose())
      configuredInstanceRef.current = null
    }
  }, [instance, invalidate, materials.materials, mtl])

  const [anchorX, anchorZ] = cellToWorld(cell[0], cell[1])
  // Left-wall mounts move toward the room (+X) so their rear depth does not
  // sit inside the procedural wall. Other mounts retain their cell anchor.
  const x = wallSideOffset(placement, anchorX, wallOffset)
  const z = anchorZ
  const resolvedTransform = transform ?? {
    position: [x, elevationY, z] as [number, number, number],
    rotation: [0, rotationY, 0] as [number, number, number],
    scale: [scale, scale, scale] as [number, number, number],
  }

  return (
    <group
      ref={groupRef}
      name={name}
      position={resolvedTransform.position}
      rotation={resolvedTransform.rotation}
      scale={resolvedTransform.scale}
      onClick={onSelect}
      userData={{
        notelingsBuilderItemId: name,
        notelingsSelected: selected,
        notelingsPlacement: placement.id,
        notelingsSourceMtl: mtl,
        notelingsSourceObj: obj,
        notelingsWallSide: placement.wallSide ?? null,
        notelingsWallAnchor: placement.cell,
        notelingsWallOffset: wallOffset,
      }}
    >
      <primitive object={instance} dispose={null} />
      {children}
    </group>
  )
}

export default OfficeModel
