'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createSafePathCurve,
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
// Slightly overlap the floor so the rounded capsule reads as grounded instead
// of leaving a visible gap between its tangent point and the floor shadow.
const BODY_FLOOR_OVERLAP = 0.02
const BODY_COLOR = '#2fa8e0'
const FACE_WIDTH = 0.6
const FACE_HEIGHT = 0.4
const FACE_Y = 1.0
// Keep the entire LCD plane outside the capsule's curved front to prevent
// depth-buffer flicker and edge clipping while the robot turns.
const FACE_PROTRUDE = 0.17
const FACE_Z = BODY_RADIUS + FACE_PROTRUDE
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
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null)
  const curveDistanceRef = useRef(0)
  const curveLengthRef = useRef(0)
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
    curveRef.current = null
    setFrameloop('demand')
  }, [setFrameloop])

  useImperativeHandle(
    ref,
    () => ({
      moveTo(goal: GridCell): boolean {
        const group = groupRef.current
        if (!group) return false
        const current = worldToGridCell(group.position.x, group.position.z, grid)
        const path = findPath(current, goal, {
          blocked,
          cols: grid.cols,
          rows: grid.rows,
        })
        if (!path || path.length <= 1) return false
        pathRef.current = path.slice(1) // robot already stands on the start cell
        curveRef.current = createSafePathCurve(path, grid, blocked, { clearanceWorld: BODY_RADIUS })
        curveDistanceRef.current = 0
        curveLengthRef.current = curveRef.current?.getLength() ?? 0
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

    const step = WALK_SPEED_WORLD * Math.min(delta, 0.05)
    const curve = curveRef.current
    if (curve) {
      // Advance by arc length so speed stays constant through the curve rather
      // than slowing down at Catmull-Rom control points.
      curveDistanceRef.current = Math.min(curveLengthRef.current, curveDistanceRef.current + step)
      const distanceRatio = curveLengthRef.current > 0 ? curveDistanceRef.current / curveLengthRef.current : 1
      const point = curve.getPointAt(distanceRatio)
      const tangent = curve.getTangentAt(Math.min(1, distanceRatio + 0.001))
      group.position.x = point.x
      group.position.z = point.z

      // Smoothly turn toward the spline tangent using the shortest path around
      // ±π. The LCD remains on the body's front, so this is visible in-scene.
      const targetHeading = Math.atan2(tangent.x, tangent.z)
      let turn = targetHeading - group.rotation.y
      while (turn > Math.PI) turn -= Math.PI * 2
      while (turn < -Math.PI) turn += Math.PI * 2
      group.rotation.y += turn * Math.min(1, TURN_SPEED * Math.min(delta, 0.05))

      if (curveDistanceRef.current >= curveLengthRef.current) {
        const [tx, tz] = gridCellToWorld(pathRef.current[pathRef.current.length - 1], grid)
        group.position.x = tx
        group.position.z = tz
        pathRef.current = []
        curveRef.current = null
      }
    } else {
      const [tx, tz] = gridCellToWorld(pathRef.current[0], grid)
      const dx = tx - group.position.x
      const dz = tz - group.position.z
      const distance = Math.hypot(dx, dz)

      // Safe fallback for paths whose curve samples touch an obstacle.
      const targetHeading = Math.atan2(dx, dz)
      let turn = targetHeading - group.rotation.y
      while (turn > Math.PI) turn -= Math.PI * 2
      while (turn < -Math.PI) turn += Math.PI * 2
      group.rotation.y += turn * Math.min(1, TURN_SPEED * Math.min(delta, 0.05))

      if (distance <= Math.max(step, WAYPOINT_EPSILON)) {
        group.position.x = tx
        group.position.z = tz
        pathRef.current.shift()
      } else {
        group.position.x += (dx / distance) * step
        group.position.z += (dz / distance) * step
      }
    }

    if (pathRef.current.length === 0) {
      setState('idle')
      onStateChange?.('idle')
      onPathChange?.(null)
      setFrameloop('demand')
      invalidate()
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
      <mesh position-y={BODY_Y - BODY_FLOOR_OVERLAP} castShadow receiveShadow>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* LCD face mounted on the body FRONT (+Z): it points where the robot
          walks, so turning to face each waypoint is clearly visible. */}
      <mesh position={[0, FACE_Y, FACE_Z]}>
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} />
      </mesh>
    </group>
  )
})

export default AgentRobot
