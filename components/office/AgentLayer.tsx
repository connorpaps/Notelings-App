'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_DEPTH, FLOOR_WIDTH } from './Floor'
import { cellToWorld, worldToCell } from './officeLayout'
import { buildEffectiveBlockedCells, findFreeCell, type GridCell } from './pathfinding'
import AgentRobot, { type AgentRobotHandle } from './AgentRobot'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { ENABLE_PATH_PREVIEW } from './officeMode'
import type { AgentState } from './agentState'

/** First free cell near the lounge front — computed so the start is never blocked. */
export const AGENT_START_CELL: GridCell =
  findFreeCell([3, 6], buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS)) ?? [9, 7]

export default function AgentLayer() {
  const robotRef = useRef<AgentRobotHandle>(null)
  const [previewPath, setPreviewPath] = useState<GridCell[] | null>(null)
  const effectiveBlocked = useMemo(
    () => buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS),
    [],
  )

  // Mutable runtime contract for e2e/browser QA — no extra renders.
  const runtimeRef = useRef({
    state: 'idle' as AgentState,
    startCell: AGENT_START_CELL,
    currentCell: AGENT_START_CELL,
    pathLength: 0,
  })
  useEffect(() => {
    ;(window as unknown as { __NOTELINGS_AGENT__: typeof runtimeRef.current }).__NOTELINGS_AGENT__ =
      runtimeRef.current
  }, [])

  const onStateChange = (state: AgentState) => {
    runtimeRef.current.state = state
  }
  const onPathChange = (path: GridCell[] | null) => {
    runtimeRef.current.pathLength = path ? path.length : 0
    runtimeRef.current.currentCell = path ? path[0] : AGENT_START_CELL
    setPreviewPath(path) // React state only updates on real path assignment
  }

  const handleFloorClick = (event: ThreeEvent<MouseEvent>) => {
    const [col, row] = worldToCell(event.point.x, event.point.z)
    robotRef.current?.moveTo([col, row])
  }

  const previewPoints: Array<[number, number, number]> = (previewPath ?? []).map(([col, row]) => {
    const [x, z] = cellToWorld(col, row)
    return [x, 0.03, z]
  })

  return (
    <group name="agent-layer" userData={{ notelingsAgentLayer: true }}>
      <mesh
        name="nav-floor"
        rotation-x={-Math.PI / 2}
        position-y={0.012}
        onClick={handleFloorClick}
      >
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <AgentRobot
        ref={robotRef}
        start={AGENT_START_CELL}
        blocked={effectiveBlocked}
        onStateChange={onStateChange}
        onPathChange={onPathChange}
      />
      {ENABLE_PATH_PREVIEW && previewPoints.length > 1 && (
        <Line points={previewPoints} color="#38bdf8" lineWidth={2} transparent opacity={0.7} />
      )}
    </group>
  )
}
