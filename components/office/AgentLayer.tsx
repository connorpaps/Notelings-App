'use client'

import { useEffect, useMemo } from 'react'
import { AGENT_GRID_RESOLUTION, AGENT_GRID_TRANSFORM, AGENT_START_CELLS, RED_START_CELL, buildAgentBlockedCells } from './agentGrid'
import AgentRobot from './AgentRobot'
import { useAgentStore } from './agentStore'
import { useTaskDispatcher } from './useTaskDispatcher'
import type { AgentId } from './agentDestinations'

// Blue/Green take notes; Red is the error sentinel (never dispatched).
const AGENT_IDS: AgentId[] = ['blue', 'green', 'red']

export default function AgentLayer() {
  useTaskDispatcher()
  const effectiveBlocked = useMemo(() => buildAgentBlockedCells(), [])
  const agents = useAgentStore((state) => state.agents)
  const taskQueueLength = useAgentStore((state) => state.taskQueue.length)

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
          startCell: id === 'red' ? RED_START_CELL : AGENT_START_CELLS[id],
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
      gridCols: AGENT_GRID_TRANSFORM.cols ?? 0,
      gridRows: AGENT_GRID_TRANSFORM.rows ?? 0,
      gridResolution: AGENT_GRID_RESOLUTION,
    }
  }, [agents, taskQueueLength])

  return (
    <group name="agent-layer" userData={{ notelingsAgentLayer: true }}>
      {AGENT_IDS.map((agentId) => (
        <AgentRobot
          key={agentId}
          agentId={agentId}
          start={agentId === 'red' ? RED_START_CELL : AGENT_START_CELLS[agentId]}
          blocked={effectiveBlocked}
          grid={AGENT_GRID_TRANSFORM}
          color={agents[agentId].color}
          name={`agent-robot-${agentId}`}
          errorRecoveryDelayMs={agentId === 'red' ? 5000 : undefined}
        />
      ))}
    </group>
  )
}
