'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  findPath,
  gridCellToWorld,
  worldToGridCell,
  type BlockedSet,
  type GridCell,
  type GridTransform,
} from './pathfinding'
import type { AgentState } from './agentState'
import { createFaceTexture } from './agentFace'

export type AgentRobotHandle = { moveTo: (cell: GridCell) => boolean }

const BODY_RADIUS = 0.38
const BODY_LENGTH = 0.72
// capsuleGeometry is centered on its origin; lifting it by half its total
// height keeps the capsule's BOTTOM perfectly flush with the floor (y=0).
const BODY_Y = BODY_RADIUS + BODY_LENGTH / 2
const BODY_COLOR = '#2fa8e0'
const FACE_WIDTH = 0.6
const FACE_HEIGHT = 0.4
const FACE_Y = 1.0
const FACE_PROTRUDE = 0.03
const WALK_SPEED_WORLD = 2.6 // world units per second (CELL_SIZE ≈ 1.2)
const TURN_SPEED = 8 // radians per second
const WAYPOINT_EPSILON = 0.02

type AgentRobotProps = {
  start: GridCell
  blocked: BlockedSet
  grid: GridTransform
  name?: string
  onStateChange?: (state: AgentState) => void
  onPathChange?: (path: GridCell[] | null) => void
}

const AgentRobot = forwardRef<AgentRobotHandle, AgentRobotProps>(function AgentRobot(
  { start, blocked, grid, name = 'agent-robot', onStateChange, onPathChange },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null)
  const pathRef = useRef<GridCell[]>([])
  const [state, setState] = useState<AgentState>('idle')
  const startWorld = useMemo(() => gridCellToWorld(start, grid), [grid, start])

  const setFrameloop = useThree((state) => state.setFrameloop)
  const invalidate = useThree((state) => state.invalidate)

  // Recreate the LCD texture only when the expression changes.
  const faceTexture = useMemo(() => createFaceTexture(state), [state])

  // Restore demand rendering and drop any in-flight path if the robot
  // unmounts mid-walk (HMR/StrictMode).
  useEffect(() => () => {
    pathRef.current = []
    setFrameloop('demand')
  }, [setFrameloop])

  useImperativeHandle(
    ref,
    () => ({
      moveTo(goal: GridCell): boolean {
        const group = groupRef.current
        if (!group) return false
        const current = worldToGridCell(group.position.x, group.position.z, grid)
        const path = findPath(current, goal, { blocked })
        if (!path || path.length <= 1) return false
        pathRef.current = path.slice(1) // robot already stands on the start cell
        setState('walking')
        onStateChange?.('walking')
        onPathChange?.(path)
        setFrameloop('always')
        return true
      },
    }),
    [blocked, grid, onPathChange, onStateChange, setFrameloop],
  )

  // The only React state write in useFrame is the terminal arrival transition.
  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group || pathRef.current.length === 0) return

    const [tx, tz] = gridCellToWorld(pathRef.current[0], grid)
    const dx = tx - group.position.x
    const dz = tz - group.position.z
    const distance = Math.hypot(dx, dz)

    // Smoothly turn to face the next waypoint (shortest path around ±π).
    const targetHeading = Math.atan2(dx, dz)
    let turn = targetHeading - group.rotation.y
    while (turn > Math.PI) turn -= Math.PI * 2
    while (turn < -Math.PI) turn += Math.PI * 2
    group.rotation.y += turn * Math.min(1, TURN_SPEED * Math.min(delta, 0.05))

    const step = WALK_SPEED_WORLD * Math.min(delta, 0.05)
    if (distance <= Math.max(step, WAYPOINT_EPSILON)) {
      group.position.x = tx
      group.position.z = tz
      pathRef.current.shift()
      if (pathRef.current.length === 0) {
        setState('idle')
        onStateChange?.('idle')
        onPathChange?.(null)
        setFrameloop('demand')
        invalidate()
      }
    } else {
      group.position.x += (dx / distance) * step
      group.position.z += (dz / distance) * step
    }
  })

  return (
    <group
      ref={groupRef}
      name={name}
      position={[startWorld[0], 0, startWorld[1]]}
      userData={{
        notelingsAgentRole: 'agent',
        notelingsAgentState: state,
        notelingsAgentStart: start,
      }}
    >
      <mesh position-y={BODY_Y} castShadow receiveShadow>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* LCD face mounted on the body FRONT (+Z): it points where the robot
          walks, so turning to face each waypoint is clearly visible. */}
      <mesh position={[0, FACE_Y, BODY_RADIUS + FACE_PROTRUDE]}>
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} />
      </mesh>
    </group>
  )
})

export default AgentRobot
