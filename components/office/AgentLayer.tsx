'use client'

import { useEffect } from 'react'
import {
  NEW_OFFICE_GRID_RESOLUTION,
  NEW_OFFICE_GRID_TRANSFORM,
  NEW_OFFICE_AGENT_START_CELLS,
  NEW_OFFICE_RED_START_CELL,
  NEW_OFFICE_EFFECTIVE_BLOCKED,
} from './newOfficeGrid'
import { NEW_OFFICE_CLEARANCE } from './newOfficeLayout'
import AgentRobot from './AgentRobot'
import { useAgentStore } from './agentStore'
import { useTaskDispatcher } from './useTaskDispatcher'
import GridDebugOverlay from './GridDebugOverlay'
import { useOfficeViewStore } from './officeViewStore'
import type { AgentId } from './agentDestinations'

// Blue/Green take notes; Red is the error sentinel (never dispatched).
const AGENT_IDS: AgentId[] = ['blue', 'green', 'red']

export default function AgentLayer() {
  useTaskDispatcher()
  // Active navigation grid: the GLB office map is 42×42 at 0.25 m per cell.
  const effectiveBlocked = NEW_OFFICE_EFFECTIVE_BLOCKED
  const agents = useAgentStore((state) => state.agents)
  const taskQueueLength = useAgentStore((state) => state.taskQueue.length)
  const gridEditorOpen = useOfficeViewStore((state) => state.gridEditorOpen)

  useEffect(() => {
    const runtimeAgents = Object.fromEntries(
      AGENT_IDS.map((id) => [
        id,
        {
          id,
          status: agents[id].status,
          currentTask: agents[id].currentTask,
          target: agents[id].target,
          targetKind: agents[id].targetKind,
          startCell: id === 'red' ? NEW_OFFICE_RED_START_CELL : NEW_OFFICE_AGENT_START_CELLS[id],
          processingStartedAt: agents[id].processingStartedAt,
          lastCompletedAt: agents[id].lastCompletedAt,
          lastCompletedDestination: agents[id].lastCompletedDestination,
          lastArrivedTarget: agents[id].lastArrivedTarget,
        },
      ]),
    )
    ;(window as unknown as {
      __NOTELINGS_AGENTS__: {
        taskQueueLength: number
        agents: typeof runtimeAgents
        gridCols: number
        gridRows: number
        gridResolution: number
      }
    }).__NOTELINGS_AGENTS__ = {
      taskQueueLength,
      agents: runtimeAgents,
      gridCols: NEW_OFFICE_GRID_TRANSFORM.cols ?? 0,
      gridRows: NEW_OFFICE_GRID_TRANSFORM.rows ?? 0,
      gridResolution: NEW_OFFICE_GRID_RESOLUTION,
    }
  }, [agents, taskQueueLength])

  return (
    <>
      {gridEditorOpen && <GridDebugOverlay blocked={effectiveBlocked} grid={NEW_OFFICE_GRID_TRANSFORM} />}
      <group name="agent-layer" userData={{ notelingsAgentLayer: true }}>
      {AGENT_IDS.map((agentId) => (
        <AgentRobot
          key={agentId}
          agentId={agentId}
          start={agentId === 'red' ? NEW_OFFICE_RED_START_CELL : NEW_OFFICE_AGENT_START_CELLS[agentId]}
          blocked={effectiveBlocked}
          grid={NEW_OFFICE_GRID_TRANSFORM}
          color={agents[agentId].color}
          name={`agent-robot-${agentId}`}
          errorRecoveryDelayMs={agentId === 'red' ? 5000 : undefined}
          clearanceWorld={NEW_OFFICE_CLEARANCE}
          smoothPath={false}
        />
      ))}
      </group>
    </>
  )
}
