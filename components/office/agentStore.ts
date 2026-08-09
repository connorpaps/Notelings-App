'use client'

import { create } from 'zustand'
import type { AgentState } from './agentState'
import { TASK_DESTINATIONS, type AgentId, type TaskDestination } from './agentDestinations'
import type { GridCell } from './pathfinding'

export type Task = {
  id: string
  destination: TaskDestination
  createdAt: number
}

export type AgentCommandKind = 'task' | 'wander' | null

export type AgentRecord = {
  id: AgentId
  color: string
  status: AgentState
  currentTask: Task | null
  target: GridCell | null
  targetKind: AgentCommandKind
  commandRevision: number
  processingStartedAt: number | null
  lastCompletedAt: number | null
  lastCompletedDestination: TaskDestination | null
  lastArrivedTarget: GridCell | null
}

export type AgentStore = {
  taskQueue: Task[]
  agents: Record<AgentId, AgentRecord>
  enqueueTask: (destination: TaskDestination) => string
  dispatchAvailableTasks: () => void
  requestWander: (agentId: AgentId, target: GridCell) => boolean
  arriveAtTask: (agentId: AgentId) => boolean
  completeTask: (agentId: AgentId) => boolean
  failTask: (agentId: AgentId) => boolean
  finishWander: (agentId: AgentId) => boolean
  recoverError: (agentId: AgentId) => boolean
  resetForTests: () => void
}

const INITIAL_AGENTS: Record<AgentId, AgentRecord> = {
  blue: {
    id: 'blue',
    color: '#2fa8e0',
    status: 'idle',
    currentTask: null,
    target: null,
    targetKind: null,
    commandRevision: 0,
    processingStartedAt: null,
    lastCompletedAt: null,
    lastCompletedDestination: null,
    lastArrivedTarget: null,
  },
  green: {
    id: 'green',
    color: '#43c98b',
    status: 'idle',
    currentTask: null,
    target: null,
    targetKind: null,
    commandRevision: 0,
    processingStartedAt: null,
    lastCompletedAt: null,
    lastCompletedDestination: null,
    lastArrivedTarget: null,
  },
}

let taskSequence = 0

function cloneAgents(): Record<AgentId, AgentRecord> {
  return {
    blue: { ...INITIAL_AGENTS.blue },
    green: { ...INITIAL_AGENTS.green },
  }
}

function nextRevision(agent: AgentRecord): number {
  return agent.commandRevision + 1
}

export const useAgentStore = create<AgentStore>((set) => ({
  taskQueue: [],
  agents: cloneAgents(),

  enqueueTask: (destination) => {
    const task: Task = {
      id: `task-${++taskSequence}`,
      destination,
      createdAt: Date.now(),
    }
    set((state) => ({ taskQueue: [...state.taskQueue, task] }))
    return task.id
  },

  dispatchAvailableTasks: () => {
    set((state) => {
      const available = (['blue', 'green'] as AgentId[]).filter((id) => {
        const agent = state.agents[id]
        return agent.status === 'idle' && agent.currentTask === null
      })
      if (available.length === 0 || state.taskQueue.length === 0) return state

      const agents = { ...state.agents }
      const remaining = [...state.taskQueue]
      for (const id of available) {
        const task = remaining.shift()
        if (!task) break
        const agent = agents[id]
        agents[id] = {
          ...agent,
          status: 'walking',
          currentTask: task,
          target: [...TASK_DESTINATIONS[task.destination]] as GridCell,
          targetKind: 'task',
          commandRevision: nextRevision(agent),
        }
      }
      return { agents, taskQueue: remaining }
    })
  },

  requestWander: (agentId, target) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'idle' || agent.currentTask !== null || agent.target !== null || agent.targetKind !== null) return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            target,
            targetKind: 'wander',
            commandRevision: nextRevision(agent),
          },
        },
      }
    })
    return accepted
  },

  arriveAtTask: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'walking' || agent.targetKind !== 'task' || !agent.currentTask) return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'processing',
            target: null,
            targetKind: null,
            commandRevision: nextRevision(agent),
            processingStartedAt: Date.now(),
            lastArrivedTarget: agent.target,
          },
        },
      }
    })
    return accepted
  },

  completeTask: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'processing' || !agent.currentTask) return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'idle',
            currentTask: null,
            target: null,
            targetKind: null,
            commandRevision: nextRevision(agent),
            lastCompletedAt: Date.now(),
            lastCompletedDestination: agent.currentTask.destination,
          },
        },
      }
    })
    return accepted
  },

  failTask: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.currentTask === null || agent.status === 'idle') return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'error',
            target: null,
            targetKind: null,
            commandRevision: nextRevision(agent),
          },
        },
      }
    })
    return accepted
  },

  finishWander: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'idle' || agent.targetKind !== 'wander') return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            target: null,
            targetKind: null,
            commandRevision: nextRevision(agent),
          },
        },
      }
    })
    return accepted
  },

  recoverError: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'error') return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'idle',
            currentTask: null,
            target: null,
            targetKind: null,
            commandRevision: nextRevision(agent),
          },
        },
      }
    })
    return accepted
  },

  resetForTests: () => {
    taskSequence = 0
    set({ taskQueue: [], agents: cloneAgents() })
  },
}))
