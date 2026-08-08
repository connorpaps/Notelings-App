'use client'

import { cellToWorld } from './officeLayout'

/** The low-poly T partition visible between the four central workstations. */
export default function CubicleDivider() {
  const [x, z] = cellToWorld(8, 9)

  const horizontalZ = -0.9
  const horizontalDepth = 0.14
  const stemDepth = 1.15
  const stemFront = horizontalZ + horizontalDepth / 2
  const stemCenterZ = stemFront + stemDepth / 2

  return (
    <group name="central-t-divider" position={[x, 0, z]} userData={{ notelingsRole: 't-divider' }}>
      <mesh name="divider-horizontal" position={[0, 1.15, horizontalZ]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 2.3, horizontalDepth]} />
        <meshStandardMaterial color="#f1f2f1" roughness={0.86} />
      </mesh>
      <mesh name="divider-desk-stem" position={[0, 1.15, stemCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 2.3, stemDepth]} />
        <meshStandardMaterial color="#f1f2f1" roughness={0.86} />
      </mesh>
    </group>
  )
}
