'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CELL_SIZE, cellToWorld, worldToCell } from './officeLayout'
import { findPath, type BlockedSet, type GridCell } from './pathfinding'
import type { AgentState } from './agentState'
import { createFaceTexture } from './agentFace'

export type AgentRobotHandle = { moveTo: (cell: GridCell) => boolean }

const BODY_RADIUS = 0.38
const BODY_LENGTH = 0.72
const BODY_COLOR = '#2fa8e0'
const FACE_WIDTH = 0.5
const FACE_HEIGHT = 0.32
const CELLS_PER_SECOND = 2.2
const WAYPOINT_EPSILON = 0.02

type AgentRobotProps = {
  start: GridCell
  blocked: BlockedSet
  name?: string
  onStateChange?: (state: AgentState) => void
  onPathChange?: (path: GridCell[] | null) => void
}

const AgentRobot = forwardRef<AgentRobotHandle, AgentRobotProps>(function AgentRobot(
  { start, blocked, name = 'agent-robot', onStateChange, onPathChange },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null)
  const faceMeshRef = useRef<THREE.Mesh>(null)
  const pathRef = useRef<GridCell[]>([])
  const [state, setState] = useState<AgentState>('idle')
  const [startWorld] = useState<[number, number]>(() => cellToWorld(start[0], start[1]))

  const camera = useThree((state) => state.camera)
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

  // Orient the LCD once on mount (fixed camera) so the first idle frame is right.
  useEffect(() => {
    faceMeshRef.current?.lookAt(camera.position)
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      moveTo(goal: GridCell): boolean {
        const group = groupRef.current
        if (!group) return false
        const current = worldToCell(group.position.x, group.position.z)
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
    [blocked, onPathChange, onStateChange, setFrameloop],
  )

  // The only React state write in useFrame is the terminal arrival transition.
  useFrame((_, delta) => {
    const group = groupRef.current
    const face = faceMeshRef.current
    if (!group || !face) return
    face.lookAt(camera.position)
    if (pathRef.current.length === 0) return

    const [tx, tz] = cellToWorld(pathRef.current[0][0], pathRef.current[0][1])
    const dx = tx - group.position.x
    const dz = tz - group.position.z
    const distance = Math.hypot(dx, dz)
    const step = CELLS_PER_SECOND * CELL_SIZE * Math.min(delta, 0.05)

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
      group.rotation.y = Math.atan2(dx, dz)
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
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh ref={faceMeshRef} position={[0, 0.06, BODY_RADIUS + 0.012]}>
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  )
})

export default AgentRobot
