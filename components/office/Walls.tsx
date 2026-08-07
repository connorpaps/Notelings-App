'use client'
import { useMemo } from 'react'
import { WALLS, PLACEMENTS, cellToWorld, CELL_SIZE, WALL_THICKNESS } from './officeLayout'
import OfficeModel from './OfficeModel'

/** Solid wall segments (replicated from preview.png; primitive boxes) + wall decor. */
export default function Walls() {
  const segments = useMemo(
    () =>
      WALLS.map((w) => {
        const isX = w.axis === 'x'
        // Center the box on the middle of the segment (not its start edge)
        const mid = w.cell[isX ? 0 : 1] + (w.lenCells - 1) / 2
        const [mx, mz] = cellToWorld(isX ? mid : w.cell[0], isX ? w.cell[1] : mid)
        const length = w.lenCells * CELL_SIZE
        const thickness = w.thickness ?? WALL_THICKNESS
        return (
          <mesh
            key={`wall-${w.cell[0]}-${w.cell[1]}-${w.axis}`}
            position={[mx, w.height / 2, mz]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[isX ? length : thickness, w.height, isX ? thickness : length]}
            />
            <meshStandardMaterial color="#e9eaec" />
          </mesh>
        )
      }),
    [],
  )

  const decor = useMemo(
    () =>
      PLACEMENTS.filter((p) => p.mount === 'wall').map((p) => (
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
