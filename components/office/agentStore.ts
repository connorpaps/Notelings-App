'use client'

import { create } from 'zustand'
import type { AgentState } from './agentState'
import {
  TASK_DESTINATIONS,
  TASK_DESTINATION_LABELS,
  TRASH_STAGING_CELL,
  type AgentId,
  type TaskDestination,
} from './agentDestinations'
import type { NoteCategory, NoteRecord } from '../../lib/notes/types'
import type { GridCell } from './pathfinding'
import { categoryToDestination } from '../../lib/notes/categorization'
import { appendLog, truncateContent, type TerminalLog } from '../../lib/notes/terminalLogs'
import { AGENT_DISPLAY_NAMES } from '../notelings/completionToasts'

export type TaskKind = 'note' | 'archive'

export type Task = {
  id: string
  kind: TaskKind
  /** DB row id; undefined when the note was created fully offline. */
  noteId?: string
  destination: TaskDestination
  /** Archive only: where the note is disposed of after pickup. */
  finalDestination?: GridCell
  content: string
  category: NoteCategory
  tags: string[]
  createdAt: number
}

/**
 * Emitted exactly once when a robot finishes filing a note (the `processing` →
 * `idle` transition in `completeTask`). The UI layer subscribes to these to
 * surface the physical-delivery success toast; failure paths never emit one.
 * Archive tasks emit into `archivedTasks` instead — never here, so they can
 * never trigger the delivery toast.
 */
export type TaskCompletion = {
  id: string
  agentId: AgentId
  kind: TaskKind
  noteId?: string
  category: NoteCategory
  destination: TaskDestination
  content: string
  completedAt: number
}

export type AgentCommandKind = 'task' | 'wander' | 'archive' | 'archive-final' | null

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

export type EnqueueTaskInput = {
  kind?: TaskKind
  noteId?: string
  destination: TaskDestination
  finalDestination?: GridCell
  content: string
  category: NoteCategory
  tags: string[]
}

export type AgentStore = {
  taskQueue: Task[]
  agents: Record<AgentId, AgentRecord>
  /** Append-only log of finished deliveries, in completion order. */
  completions: TaskCompletion[]
  /** Append-only log of finished archive disposals (M2 agentic delete). */
  archivedTasks: TaskCompletion[]
  /** Notes mirrored from Supabase (initial fetch + Realtime). Keyed by id. */
  notes: Record<string, NoteRecord>
  /** Capped monospace event log for the Terminal dock (PHASE_2_SPEC M1). */
  terminalLogs: TerminalLog[]
  /** noteIds whose archive walk is in progress (Kanban shows a pulse). */
  archivingNoteIds: string[]
  enqueueTask: (input: EnqueueTaskInput) => string
  enqueueArchive: (input: { noteId: string; category: NoteCategory; content: string; tags: string[] }) => string
  dispatchAvailableTasks: () => void
  requestWander: (agentId: AgentId, target: GridCell) => boolean
  arriveAtTask: (agentId: AgentId) => boolean
  completeTask: (agentId: AgentId) => boolean
  failTask: (agentId: AgentId) => boolean
  finishWander: (agentId: AgentId) => boolean
  recoverError: (agentId: AgentId) => boolean
  /** M4 LLM-failure path: mark an agent error regardless of prior state. */
  signalError: (agentId: AgentId) => boolean
  /** M2 archive machine: arrival at the note's destination (pickup). */
  arriveArchiveStage: (agentId: AgentId) => boolean
  /** M2 archive machine: pickup finished → walk the note to the trash. */
  completeArchiveStage: (agentId: AgentId) => boolean
  /** M2 archive machine: note disposed at the trash → idle + archived log. */
  arriveArchiveFinal: (agentId: AgentId) => boolean
  setNotes: (notes: NoteRecord[]) => void
  upsertNote: (note: NoteRecord) => void
  removeNote: (id: string) => void
  logTerminal: (message: string, level?: TerminalLog['level']) => void
  markNoteArchiving: (noteId: string) => void
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
  // Error sentinel: rendered + wandering, never claimed by the dispatcher.
  red: {
    id: 'red',
    color: '#ef4444',
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
    red: { ...INITIAL_AGENTS.red },
  }
}

function nextRevision(agent: AgentRecord): number {
  return agent.commandRevision + 1
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  taskQueue: [],
  agents: cloneAgents(),
  completions: [],
  archivedTasks: [],
  notes: {},
  terminalLogs: [],
  archivingNoteIds: [],

  enqueueTask: (input) => {
    const task: Task = {
      id: `task-${++taskSequence}`,
      kind: input.kind ?? 'note',
      noteId: input.noteId,
      destination: input.destination,
      finalDestination: input.finalDestination,
      content: input.content,
      category: input.category,
      tags: input.tags,
      createdAt: Date.now(),
    }
    set((state) => ({
      taskQueue: [...state.taskQueue, task],
      terminalLogs: appendLog(state.terminalLogs, {
        message: `Note queued: "${truncateContent(task.content)}"`,
      }),
    }))
    return task.id
  },

  enqueueArchive: ({ noteId, category, content, tags }) =>
    get().enqueueTask({
      kind: 'archive',
      noteId,
      destination: categoryToDestination(category),
      finalDestination: TRASH_STAGING_CELL,
      content,
      category,
      tags,
    }),

  dispatchAvailableTasks: () => {
    set((state) => {
      // Red is an error sentinel and is deliberately NOT in the dispatch roster.
      const available = (['blue', 'green'] as AgentId[]).filter((id) => {
        const agent = state.agents[id]
        return agent.status === 'idle' && agent.currentTask === null
      })
      if (available.length === 0 || state.taskQueue.length === 0) return state

      const agents = { ...state.agents }
      const remaining = [...state.taskQueue]
      const logInputs = []
      for (const id of available) {
        const task = remaining.shift()
        if (!task) break
        const agent = agents[id]
        agents[id] = {
          ...agent,
          status: 'walking',
          currentTask: task,
          target: [...TASK_DESTINATIONS[task.destination]] as GridCell,
          targetKind: task.kind === 'archive' ? 'archive' : 'task',
          commandRevision: nextRevision(agent),
        }
        logInputs.push({
          message: `${AGENT_DISPLAY_NAMES[id]} dispatched: "${truncateContent(task.content)}" → ${TASK_DESTINATION_LABELS[task.destination]}`,
        })
      }
      return {
        agents,
        taskQueue: remaining,
        terminalLogs: appendLog(state.terminalLogs, logInputs),
      }
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
      const task = agent.currentTask
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
            lastCompletedDestination: task.destination,
          },
        },
        completions: [
          ...state.completions,
          {
            id: task.id,
            agentId,
            kind: task.kind,
            noteId: task.noteId,
            category: task.category,
            destination: task.destination,
            content: task.content,
            completedAt: Date.now(),
          },
        ],
        terminalLogs: appendLog(state.terminalLogs, {
          message: `${AGENT_DISPLAY_NAMES[agentId]} filed "${truncateContent(task.content)}" in ${task.category}.`,
          level: 'success',
        }),
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

  signalError: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status === 'error') return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'error',
            // The sentinel never holds a task, but if signalError is ever
            // reused on a dispatched agent, clear the stale task too.
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

  arriveArchiveStage: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'walking' || agent.targetKind !== 'archive' || !agent.currentTask) return state
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
        terminalLogs: appendLog(state.terminalLogs, {
          message: `${AGENT_DISPLAY_NAMES[agentId]} picking up "${truncateContent(agent.currentTask.content)}" for archive…`,
        }),
      }
    })
    return accepted
  },

  completeArchiveStage: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'processing' || !agent.currentTask || !agent.currentTask.finalDestination) return state
      accepted = true
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            status: 'walking',
            target: [...agent.currentTask.finalDestination] as GridCell,
            targetKind: 'archive-final',
            commandRevision: nextRevision(agent),
          },
        },
      }
    })
    return accepted
  },

  arriveArchiveFinal: (agentId) => {
    let accepted = false
    set((state) => {
      const agent = state.agents[agentId]
      if (agent.status !== 'walking' || agent.targetKind !== 'archive-final' || !agent.currentTask) return state
      accepted = true
      const task = agent.currentTask
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
            lastCompletedDestination: task.destination,
          },
        },
        archivedTasks: [
          ...state.archivedTasks,
          {
            id: task.id,
            agentId,
            kind: 'archive',
            noteId: task.noteId,
            category: task.category,
            destination: task.destination,
            content: task.content,
            completedAt: Date.now(),
          },
        ],
        archivingNoteIds: task.noteId
          ? state.archivingNoteIds.filter((id) => id !== task.noteId)
          : state.archivingNoteIds,
        terminalLogs: appendLog(state.terminalLogs, {
          message: `${AGENT_DISPLAY_NAMES[agentId]} archived "${truncateContent(task.content)}".`,
          level: 'success',
        }),
      }
    })
    return accepted
  },

  setNotes: (notes) =>
    set((state) => {
      // MERGE, never replace: the initial GET snapshot can resolve AFTER
      // realtime events for a freshly submitted note (cold-route latency),
      // and a replace would clobber the newer pending/in_transit upserts.
      // Newest-wins by updated_at (fall back to created_at).
      const merged = { ...state.notes }
      for (const note of notes) {
        const existing = merged[note.id]
        const stamp = note.updated_at ?? note.created_at
        const existingStamp = existing ? existing.updated_at ?? existing.created_at : null
        if (!existing || !existingStamp || stamp >= existingStamp) {
          merged[note.id] = note
        }
      }
      return { notes: merged }
    }),

  upsertNote: (note) =>
    set((state) => ({ notes: { ...state.notes, [note.id]: note } })),

  removeNote: (id) =>
    set((state) => {
      const notes = { ...state.notes }
      delete notes[id]
      return { notes }
    }),

  logTerminal: (message, level = 'info') =>
    set((state) => ({ terminalLogs: appendLog(state.terminalLogs, { message, level }) })),

  markNoteArchiving: (noteId) =>
    set((state) => ({
      archivingNoteIds: state.archivingNoteIds.includes(noteId)
        ? state.archivingNoteIds
        : [...state.archivingNoteIds, noteId],
    })),

  resetForTests: () => {
    taskSequence = 0
    set({
      taskQueue: [],
      agents: cloneAgents(),
      completions: [],
      archivedTasks: [],
      notes: {},
      terminalLogs: [],
      archivingNoteIds: [],
    })
  },
}))
