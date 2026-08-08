'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Line } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_DEPTH, FLOOR_WIDTH } from './Floor'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { ENABLE_GRID_DEBUG, ENABLE_PATH_PREVIEW } from './officeMode'
import AgentRobot, { type AgentRobotHandle } from './AgentRobot'
import { AGENT_GRID_TRANSFORM, AGENT_START_CELL, buildAgentBlockedCells } from './agentGrid'
import { gridCellToWorld, worldToGridCell, type GridCell } from './pathfinding'
import type { AgentState } from './agentState'

// One shared geometry for all 152 debug cells (same size — the agent grid
// transform is constant across the floor).
const DEBUG_BOX_GEOMETRY = new THREE.BoxGeometry(
  AGENT_GRID_TRANSFORM.scale[0] * 0.92,
  0.12,
  AGENT_GRID_TRANSFORM.scale[1] * 0.92,
)

export default function AgentLayer() {
  const robotRef = useRef<AgentRobotHandle>(null)
  const [previewPath, setPreviewPath] = useState<GridCell[] | null>(null)
  const effectiveBlocked = useMemo(() => buildAgentBlockedCells(), [])
  const floorItem = useMemo(() => LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'floor'), [])

  // Mutable runtime contract for e2e/browser QA — no extra renders.
  const runtimeRef = useRef({
    state: 'idle' as AgentState,
    startCell: AGENT_START_CELL,
    currentCell: AGENT_START_CELL,
    pathLength: 0,
    blockedCount: 0,
  })
  useEffect(() => {
    runtimeRef.current.blockedCount = effectiveBlocked.size
    ;(window as unknown as { __NOTELINGS_AGENT__: typeof runtimeRef.current }).__NOTELINGS_AGENT__ =
      runtimeRef.current
  }, [effectiveBlocked])

  const onStateChange = (state: AgentState) => {
    runtimeRef.current.state = state
  }
  const onPathChange = (path: GridCell[] | null) => {
    runtimeRef.current.pathLength = path ? path.length : 0
    // currentCell = the walk destination (last path cell), kept across walks.
    if (path) runtimeRef.current.currentCell = path[path.length - 1]
    setPreviewPath(path) // React state only updates on real path assignment
  }

  const handleFloorClick = (event: ThreeEvent<MouseEvent>) => {
    const [col, row] = worldToGridCell(event.point.x, event.point.z, AGENT_GRID_TRANSFORM)
    robotRef.current?.moveTo([col, row])
  }

  const previewPoints: Array<[number, number, number]> = (previewPath ?? []).map((cell) => {
    const [x, z] = gridCellToWorld(cell, AGENT_GRID_TRANSFORM)
    return [x, 0.03, z]
  })

  const debugCells = useMemo(
    () => [...effectiveBlocked].map((key) => key.split(',').map(Number) as [number, number]),
    [effectiveBlocked],
  )

  return (
    <group name="agent-layer" userData={{ notelingsAgentLayer: true }}>
      {/* Invisible click surface aligned to the locked floor item's transform,
          so grid clicks land exactly where the visible floor grid is. */}
      <mesh
        name="nav-floor"
        rotation-x={-Math.PI / 2}
        position={[
          floorItem ? floorItem.transform.position[0] : 0,
          0.012,
          floorItem ? floorItem.transform.position[2] : 0,
        ]}
        scale={floorItem ? [floorItem.transform.scale[0], 1, floorItem.transform.scale[2]] : [1, 1, 1]}
        onClick={handleFloorClick}
      >
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <AgentRobot
        ref={robotRef}
        start={AGENT_START_CELL}
        blocked={effectiveBlocked}
        grid={AGENT_GRID_TRANSFORM}
        onStateChange={onStateChange}
        onPathChange={onPathChange}
      />
      {/* Temporary verification aid: translucent red boxes over every blocked
          grid cell so the A* grid alignment with the 3D furniture can be
          checked visually. Flip ENABLE_GRID_DEBUG to false once verified. */}
      {ENABLE_GRID_DEBUG && (
        <group name="grid-debug" userData={{ notelingsGridDebug: true }}>
          {debugCells.map(([col, row]) => {
            const [wx, wz] = gridCellToWorld([col, row], AGENT_GRID_TRANSFORM)
            return (
              <mesh
                key={`${col},${row}`}
                position={[wx, 0.07, wz]}
                geometry={DEBUG_BOX_GEOMETRY}
                renderOrder={999}
              >
                {/* depthTest off → the red squares read THROUGH desks/cubicles
                    as an x-ray overlay, so the blocked-cell grid can be checked
                    against the 3D furniture at a glance. Temporary debug aid. */}
                <meshBasicMaterial
                  color="#ff3b3b"
                  transparent
                  opacity={0.45}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            )
          })}
        </group>
      )}
      {ENABLE_PATH_PREVIEW && previewPoints.length > 1 && (
        <Line points={previewPoints} color="#38bdf8" lineWidth={2} transparent opacity={0.7} />
      )}
    </group>
  )
}
