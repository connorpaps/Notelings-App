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
const FACE_Y = 1.0
const FACE_PROTRUDE = 0.17
const FACE_Z = BODY_RADIUS + FACE_PROTRUDE
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
}

const AgentRobot = function AgentRobot({
  agentId,
  start,
  blocked,
  grid,
  color = DEFAULT_BODY_COLOR,
  name = `agent-robot-${agentId}`,
}: AgentRobotProps) {
  const groupRef = useRef<THREE.Group>(null)
  const pathRef = useRef<GridCell[]>([])
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null)
  const curveDistanceRef = useRef(0)
  const curveLengthRef = useRef(0)
  const commandRevisionRef = useRef(-1)
  const commandKindRef = useRef<'task' | 'wander' | null>(null)
  const wanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const status = useAgentStore((state) => state.agents[agentId].status)
  const target = useAgentStore((state) => state.agents[agentId].target)
  const targetKind = useAgentStore((state) => state.agents[agentId].targetKind)
  const commandRevision = useAgentStore((state) => state.agents[agentId].commandRevision)
  const requestWander = useAgentStore((state) => state.requestWander)
  const finishWander = useAgentStore((state) => state.finishWander)
  const arriveAtTask = useAgentStore((state) => state.arriveAtTask)
  const completeTask = useAgentStore((state) => state.completeTask)
  const failTask = useAgentStore((state) => state.failTask)
  const recoverError = useAgentStore((state) => state.recoverError)

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
    if (!path) {
      clearPath()
      if (targetKind === 'task') failTask(agentId)
      else finishWander(agentId)
      return
    }
    if (path.length <= 1) {
      clearPath()
      if (targetKind === 'task') arriveAtTask(agentId)
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
  }, [agentId, arriveAtTask, blocked, commandRevision, failTask, finishWander, grid, status, target, targetKind])

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
      completeTask(agentId)
    }, 2000)
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current)
      processingTimerRef.current = null
    }
  }, [agentId, completeTask, status])

  useEffect(() => {
    if (status !== 'error') return
    const timer = setTimeout(() => recoverError(agentId), ERROR_RECOVERY_DELAY)
    return () => clearTimeout(timer)
  }, [agentId, recoverError, status])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group || pathRef.current.length === 0) return

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
      if (commandKindRef.current === 'task') arriveAtTask(agentId)
      else finishWander(agentId)
      commandKindRef.current = null
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
      <mesh position-y={BODY_Y - BODY_FLOOR_OVERLAP} castShadow receiveShadow>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, FACE_Y, FACE_Z]}>
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} />
      </mesh>
    </group>
  )
}

export default AgentRobot
