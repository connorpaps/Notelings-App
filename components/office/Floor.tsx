'use client'

import { Grid } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CELL_SIZE, OFFICE_CENTER, OFFICE_DEPTH, OFFICE_WIDTH, WALL_THICKNESS } from './officeLayout'

// The finite base remains sized to the full office footprint, including the
// wall thickness, while the camera-facing walls are intentionally cut away.
export const FLOOR_WIDTH = OFFICE_WIDTH + WALL_THICKNESS
export const FLOOR_DEPTH = OFFICE_DEPTH - CELL_SIZE + WALL_THICKNESS

type FloorProps = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  groupRef?: React.Ref<THREE.Group>
  name?: string
  selected?: boolean
  onSelect?: (event: ThreeEvent<MouseEvent>) => void
  builderItemId?: string
}

export default function Floor({
  position = [OFFICE_CENTER[0], 0, OFFICE_CENTER[1]],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  groupRef,
  name = 'office-floor-group',
  selected = false,
  onSelect,
  builderItemId,
}: FloorProps) {
  return (
    <group
      ref={groupRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={onSelect}
      userData={{ notelingsRole: 'floor', notelingsBuilderItemId: builderItemId, notelingsSelected: selected }}
    >
      <mesh
        name="office-floor"
        rotation-x={-Math.PI / 2}
        position-y={-0.01}
        receiveShadow
        userData={{ notelingsRole: 'floor' }}
      >
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.92} />
      </mesh>
      <Grid
        name="office-grid"
        position-y={0.005}
        args={[FLOOR_WIDTH, FLOOR_DEPTH]}
        cellSize={CELL_SIZE}
        cellThickness={0.3}
        cellColor="#afb6b7"
        sectionSize={6}
        sectionThickness={0.7}
        sectionColor="#929d9e"
        fadeDistance={0}
        infiniteGrid={false}
      />
    </group>
  )
}
