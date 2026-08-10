'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createSafePathCurve,
  findPath,
  isPathSafe,
  gridCellToWorld,
  worldToGridCell,
  type BlockedSet,
  type GridCell,
  type GridTransform,
  ROBOT_NAVIGATION_CLEARANCE,
} from './pathfinding'
import type { AgentId } from './agentDestinations'
import { pickWanderCell } from './agentWandering'
import { useAgentStore } from './agentStore'
import type { AgentState } from './agentState'
import { createFaceTexture } from './agentFace'

const BODY_RADIUS = 0.38
// Navigation uses a separately measured grid clearance because the fine grid
// rasterizes conservative AABBs; the physical capsule is still rendered at
// BODY_RADIUS. The path-level `isPathSafe` sweep then checks each segment
// against the occupied cell rectangles before either spline or fallback motion
// begins. Do not use BODY_RADIUS as cell inflation without re-auditing the
// locked scene's narrow corridors.
const BODY_LENGTH = 0.72
const BODY_Y = BODY_RADIUS + BODY_LENGTH / 2
const BODY_FLOOR_OVERLAP = 0.02
const DEFAULT_BODY_COLOR = '#2fa8e0'
const FACE_WIDTH = 0.6
const FACE_HEIGHT = 0.4
// Raise the LCD toward the capsule's head while keeping it local to the
// animated robot root. The face overlaps the upper half of the capsule instead
// of reading as a low, floating panel during movement.
const FACE_Y = BODY_Y + 0.4
// Keep the screen centered on the capsule's local X axis. A lateral bias
// projects outward for the down-right heading under the fixed isometric camera.
const FACE_LATERAL_OFFSET = 0
// Keep the LCD just beyond the capsule's measured front radius. Values below
// BODY_RADIUS place the plane inside the capsule at this raised Y position.
const FACE_Z = 0.42
const NOTE_WIDTH = 0.42
const NOTE_HEIGHT = 0.52
const NOTE_DEPTH = 0.035
const NOTE_X = 0.28
const NOTE_Y = BODY_Y + 0.46
// Keep the card clearly in front of the LCD/body along the robot's local +Z.
const NOTE_Z = 0.56
const WALK_SPEED_WORLD = 2.6
const TURN_SPEED = 8
const WAYPOINT_EPSILON = 0.02
const WANDER_DELAY_MIN = 1500
const WANDER_DELAY_RANGE = 2000
const ERROR_RECOVERY_DELAY = 1500
// SwiftShader/post-processing can deliver sparse frames in headless QA. Keep
// normal motion unchanged while allowing a long frame to make real progress.
const MAX_FRAME_DELTA = 0.5

type AgentRobotProps = {
  agentId: AgentId
  start: GridCell
  blocked: BlockedSet
  grid: GridTransform
  color?: string
  name?: string
  /** How long an error state persists before auto-recovery (M4: red sentinel uses a longer window). */
  errorRecoveryDelayMs?: number
}

const AgentRobot = function AgentRobot({
  agentId,
  start,
  blocked,
  grid,
  color = DEFAULT_BODY_COLOR,
  name = `agent-robot-${agentId}`,
  errorRecoveryDelayMs = ERROR_RECOVERY_DELAY,
}: AgentRobotProps) {
  const groupRef = useRef<THREE.Group>(null)
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const pathRef = useRef<GridCell[]>([])
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null)
  const curveDistanceRef = useRef(0)
  const curveLengthRef = useRef(0)
  const commandRevisionRef = useRef(-1)
  const commandKindRef = useRef<'task' | 'wander' | 'archive' | 'archive-final' | null>(null)
  const wanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const status = useAgentStore((state) => state.agents[agentId].status)
  const target = useAgentStore((state) => state.agents[agentId].target)
  const targetKind = useAgentStore((state) => state.agents[agentId].targetKind)
  const commandRevision = useAgentStore((state) => state.agents[agentId].commandRevision)
  const currentTask = useAgentStore((state) => state.agents[agentId].currentTask)
  const requestWander = useAgentStore((state) => state.requestWander)
  const finishWander = useAgentStore((state) => state.finishWander)
  const arriveAtTask = useAgentStore((state) => state.arriveAtTask)
  const completeTask = useAgentStore((state) => state.completeTask)
  const failTask = useAgentStore((state) => state.failTask)
  const recoverError = useAgentStore((state) => state.recoverError)
  // M2 archive machine: two-leg walks (destination → trash) chain through these.
  const arriveArchiveStage = useAgentStore((state) => state.arriveArchiveStage)
  const completeArchiveStage = useAgentStore((state) => state.completeArchiveStage)
  const arriveArchiveFinal = useAgentStore((state) => state.arriveArchiveFinal)

  // The robot visibly carries a note card: during every note delivery, and on
  // archive tasks only AFTER the pickup at the destination (spec: walks to the
  // destination, "picks it up", walks to the trash).
  const carrying = currentTask
    ? currentTask.kind === 'note'
      ? status === 'walking' || status === 'processing'
      : status === 'processing' || targetKind === 'archive-final'
    : false

  const startWorld = useMemo(() => gridCellToWorld(start, grid), [grid, start])
  const faceTexture = useMemo(() => createFaceTexture(status), [status])

  const clearTimers = () => {
    if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current)
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current)
    wanderTimerRef.current = null
    processingTimerRef.current = null
  }

  const clearPath = () => {
    pathRef.current = []
    curveRef.current = null
    curveDistanceRef.current = 0
    curveLengthRef.current = 0
  }

  useEffect(() => () => {
    clearTimers()
    clearPath()
  }, [])

  // A store command is an intent boundary. The local motor owns all path and
  // curve data, while this effect only translates a new intent into movement.
  useEffect(() => {
    const group = groupRef.current
    if (!group || commandRevision === commandRevisionRef.current) return
    commandRevisionRef.current = commandRevision
    clearTimers()

    if (!target || !targetKind || (status !== 'walking' && status !== 'idle')) {
      clearPath()
      return
    }

    const current = worldToGridCell(group.position.x, group.position.z, grid)
    const path = findPath(current, target, {
      blocked,
      cols: grid.cols,
      rows: grid.rows,
    })
    const isTaskKind = targetKind === 'task' || targetKind === 'archive' || targetKind === 'archive-final'
    if (!path) {
      clearPath()
      if (isTaskKind) failTask(agentId)
      else finishWander(agentId)
      return
    }
    if (path.length <= 1) {
      clearPath()
      if (targetKind === 'task') arriveAtTask(agentId)
      else if (targetKind === 'archive') arriveArchiveStage(agentId)
      else if (targetKind === 'archive-final') arriveArchiveFinal(agentId)
      else finishWander(agentId)
      return
    }

    const safePath = isPathSafe(path, grid, blocked, {
      clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
    })
    if (!safePath) {
      clearPath()
      if (targetKind === 'task') failTask(agentId)
      else finishWander(agentId)
      return
    }

    pathRef.current = path.slice(1)
    curveRef.current = createSafePathCurve(path, grid, blocked, {
      clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
      startWorld: [group.position.x, group.position.z],
    })
    curveDistanceRef.current = 0
    curveLengthRef.current = curveRef.current?.getLength() ?? 0
    commandKindRef.current = targetKind
  }, [agentId, arriveArchiveFinal, arriveArchiveStage, arriveAtTask, blocked, commandRevision, failTask, finishWander, grid, status, target, targetKind])

  // Idle agents continually request another reachable target. Wander commands
  // intentionally leave the store status idle so a queued task preempts them.
  useEffect(() => {
    if (status !== 'idle' || target !== null || targetKind !== null || wanderTimerRef.current) return
    const delay = WANDER_DELAY_MIN + Math.random() * WANDER_DELAY_RANGE
    wanderTimerRef.current = setTimeout(() => {
      wanderTimerRef.current = null
      const group = groupRef.current
      if (!group) return
      const current = worldToGridCell(group.position.x, group.position.z, grid)
      const next = pickWanderCell(current, blocked, {
        cols: grid.cols ?? 0,
        rows: grid.rows ?? 0,
      })
      if (next) requestWander(agentId, next)
    }, delay)
    return () => {
      if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current)
      wanderTimerRef.current = null
    }
  }, [agentId, blocked, grid, requestWander, status, target, targetKind])

  useEffect(() => {
    if (status !== 'processing') return
    processingTimerRef.current = setTimeout(() => {
      processingTimerRef.current = null
      // Archive tasks: the "processing" beat is the pickup — then the store
      // issues leg 2 to the trash instead of filing a completion.
      if (currentTask?.kind === 'archive') completeArchiveStage(agentId)
      else completeTask(agentId)
    }, 2000)
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current)
      processingTimerRef.current = null
    }
  }, [agentId, completeArchiveStage, completeTask, currentTask, status])

  useEffect(() => {
    if (status !== 'error') return
    const timer = setTimeout(() => recoverError(agentId), errorRecoveryDelayMs)
    return () => clearTimeout(timer)
  }, [agentId, errorRecoveryDelayMs, recoverError, status])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    // M4: pulsing red glow while the error state is active (LLM failure path).
    const glowMaterial = glowMaterialRef.current
    if (glowMaterial) {
      glowMaterial.opacity = status === 'error'
        ? 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 6))
        : 0
    }

    // The LCD is a normal child of the moving root group. Its local +Z
    // orientation therefore follows the same heading as the capsule; do not
    // billboard it toward the fixed isometric camera. Keep the face centered on
    // the capsule's local X axis so the isometric projection does not push it
    // off the body for one diagonal heading.
    if (pathRef.current.length === 0) return

    const step = WALK_SPEED_WORLD * Math.min(delta, MAX_FRAME_DELTA)
    const curve = curveRef.current
    if (curve) {
      curveDistanceRef.current = Math.min(curveLengthRef.current, curveDistanceRef.current + step)
      const ratio = curveLengthRef.current > 0 ? curveDistanceRef.current / curveLengthRef.current : 1
      const point = curve.getPointAt(ratio)
      const tangent = curve.getTangentAt(Math.min(1, ratio + 0.001))
      group.position.x = point.x
      group.position.z = point.z
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
      const targetHeading = Math.atan2(dx, dz)
      let turn = targetHeading - group.rotation.y
      while (turn > Math.PI) turn -= Math.PI * 2
      while (turn < -Math.PI) turn += Math.PI * 2
      group.rotation.y += turn * Math.min(1, TURN_SPEED * Math.min(delta, 0.05))
      if (distance <= Math.max(step, WAYPOINT_EPSILON)) {
        group.position.x = tx
        group.position.z = tz
        pathRef.current.shift()
      } else if (distance > 0) {
        group.position.x += (dx / distance) * step
        group.position.z += (dz / distance) * step
      }
    }

    if (pathRef.current.length === 0) {
      const kind = commandKindRef.current
      commandKindRef.current = null
      if (kind === 'task') arriveAtTask(agentId)
      else if (kind === 'archive') arriveArchiveStage(agentId)
      else if (kind === 'archive-final') arriveArchiveFinal(agentId)
      else finishWander(agentId)
    }
  })

  return (
    <group
      ref={groupRef}
      name={name}
      position={[startWorld[0], 0, startWorld[1]]}
      userData={{
        notelingsAgentRole: 'agent',
        notelingsAgentId: agentId,
        notelingsAgentState: status,
        notelingsAgentStart: start,
      }}
    >
      <mesh
        name="robot-body"
        position-y={BODY_Y - BODY_FLOOR_OVERLAP}
        castShadow
        receiveShadow
        userData={{ notelingsRobotPart: 'body' }}
      >
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh
        name="robot-face"
        position={[FACE_LATERAL_OFFSET, FACE_Y, FACE_Z]}
        userData={{ notelingsRobotPart: 'face', notelingsFaceOrientation: 'heading-aligned' }}
      >
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} />
      </mesh>
      {/* M4 error sentinel glow: only visible while status is `error`. */}
      <mesh
        name="robot-glow"
        position-y={BODY_Y - BODY_FLOOR_OVERLAP}
        visible={status === 'error'}
        userData={{ notelingsRobotPart: 'glow' }}
      >
        <sphereGeometry args={[BODY_RADIUS * 1.3, 16, 16]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          color="#ff2d2d"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Phase 2: a readable clipboard-like note the robot carries while working. */}
      <group
        name="robot-note"
        position={[NOTE_X, NOTE_Y, NOTE_Z]}
        rotation={[0.16, 0, 0.35]}
        visible={carrying}
        userData={{ notelingsRobotPart: 'note' }}
      >
        <mesh castShadow userData={{ notelingsRobotPart: 'note-card' }}>
          <boxGeometry args={[NOTE_WIDTH, NOTE_HEIGHT, NOTE_DEPTH]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.35}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        <mesh position={[0, NOTE_HEIGHT * 0.28, NOTE_DEPTH / 2 + 0.008]} userData={{ notelingsRobotPart: 'note-clip' }}>
          <boxGeometry args={[0.26, 0.055, 0.012]} />
          <meshStandardMaterial color="#27313a" roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[0, -0.02, NOTE_DEPTH / 2 + 0.008]} userData={{ notelingsRobotPart: 'note-line-1' }}>
          <boxGeometry args={[0.25, 0.018, 0.012]} />
          <meshStandardMaterial color="#8a959e" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.1, NOTE_DEPTH / 2 + 0.008]} userData={{ notelingsRobotPart: 'note-line-2' }}>
          <boxGeometry args={[0.18, 0.018, 0.012]} />
          <meshStandardMaterial color="#b0bac1" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

export default AgentRobot
