'use client'
import { useMemo } from 'react'
import { WALLS, PLACEMENTS, cellToWorld, CELL_SIZE } from './officeLayout'
import OfficeModel from './OfficeModel'

/** Solid wall segments (replicated from preview.png; primitive boxes) + decor. */
export default function Walls() {
  const segments = useMemo(
    () =>
      WALLS.map((w) => {
        const [cx, cz] = cellToWorld(w.cell[0], w.cell[1])
        const length = w.lenCells * CELL_SIZE
        const isX = w.axis === 'x'
        return (
          <mesh
            key={`wall-${w.cell[0]}-${w.cell[1]}-${w.axis}`}
            position={
              isX
                ? [cx + length / 2, w.height / 2, cz]
                : [cx, w.height / 2, cz + length / 2]
            }
            rotation-y={isX ? 0 : Math.PI / 2}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                isX ? length : w.thickness ?? 0.2,
                w.height,
                isX ? w.thickness ?? 0.2 : length,
              ]}
            />
            <meshStandardMaterial color="#2e3138" />
          </mesh>
        )
      }),
    [],
  )

  const decor = useMemo(
    () =>
      PLACEMENTS.filter((p) => (p.elevationY ?? 0) > 0).map((p) => (
        <OfficeModel key={p.id} placement={p} />
      )),
    [],
  )

  return (
    <group>
      {segments}
      {decor}
    </group>
  )
}
