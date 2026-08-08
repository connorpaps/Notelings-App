'use client'
import { useMemo } from 'react'
import { WALLS, PLACEMENTS, cellToWorld, CELL_SIZE, WALL_THICKNESS } from './officeLayout'
import OfficeModel from './OfficeModel'

/** Solid rear/side shell segments plus wall-mounted decor. */
export default function Walls({ excludePlacementIds = new Set<string>() }: { excludePlacementIds?: ReadonlySet<string> }) {
  const segments = useMemo(
    () =>
      WALLS.map((w) => {
        const isX = w.axis === 'x'
        const mid = w.cell[isX ? 0 : 1] + (w.lenCells - 1) / 2
        const [mx, mz] = cellToWorld(
          isX ? mid : w.cell[0] === 0 ? -0.5 : w.cell[0] + 0.5,
          isX ? w.cell[1] : mid,
        )
        const length = w.lenCells * CELL_SIZE
        const thickness = w.thickness ?? WALL_THICKNESS
        return (
          <mesh
            key={w.id}
            name={w.id}
            position={[mx, w.height / 2, mz]}
            castShadow
            receiveShadow
            userData={{ notelingsRole: 'wall', notelingsWallId: w.id }}
          >
            <boxGeometry args={[isX ? length : thickness, w.height, isX ? thickness : length]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.88} />
          </mesh>
        )
      }),
    [],
  )

  const decor = useMemo(
    () =>
      PLACEMENTS.filter((p) => p.mount === 'wall' && !excludePlacementIds.has(p.id)).map((p) => (
        <OfficeModel key={p.id} placement={p} />
      )),
    [excludePlacementIds],
  )

  return (
    <group name="office-walls">
      {segments}
      {decor}
    </group>
  )
}
