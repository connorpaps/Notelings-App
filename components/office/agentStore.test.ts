import { beforeEach, describe, expect, it } from 'vitest'
import { useAgentStore } from './agentStore'

describe('agent store', () => {
  beforeEach(() => {
    useAgentStore.getState().resetForTests()
  })

  it('starts with exactly two idle agents and an empty queue', () => {
    const state = useAgentStore.getState()
    expect(state.taskQueue).toEqual([])
    expect(Object.keys(state.agents)).toEqual(['blue', 'green'])
    expect(Object.values(state.agents).every((agent) => agent.status === 'idle')).toBe(true)
  })

  it('preserves FIFO order and assigns blue before green', () => {
    const enqueue = useAgentStore.getState().enqueueTask
    expect(enqueue('whiteboard')).toBe('task-1')
    expect(enqueue('printer')).toBe('task-2')
    expect(enqueue('whiteboard')).toBe('task-3')

    useAgentStore.getState().dispatchAvailableTasks()
    let state = useAgentStore.getState()
    expect(state.taskQueue.map((task) => task.id)).toEqual(['task-3'])
    expect(state.agents.blue.currentTask?.destination).toBe('whiteboard')
    expect(state.agents.green.currentTask?.destination).toBe('printer')
    expect(state.agents.blue.status).toBe('walking')
    expect(state.agents.green.status).toBe('walking')

    expect(useAgentStore.getState().completeTask('blue')).toBe(false)
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(true)
    state = useAgentStore.getState()
    expect(state.agents.blue.status).toBe('processing')
    expect(state.agents.blue.currentTask?.id).toBe('task-1')

    expect(useAgentStore.getState().completeTask('blue')).toBe(true)
    useAgentStore.getState().dispatchAvailableTasks()
    state = useAgentStore.getState()
    expect(state.agents.blue.currentTask?.id).toBe('task-3')
    expect(state.agents.blue.status).toBe('walking')
  })

  it('lets a queued task preempt a wandering idle agent', () => {
    expect(useAgentStore.getState().requestWander('blue', [8, 12])).toBe(true)
    expect(useAgentStore.getState().enqueueTask('printer')).toBe('task-1')
    useAgentStore.getState().dispatchAvailableTasks()
    const agent = useAgentStore.getState().agents.blue
    expect(agent.status).toBe('walking')
    expect(agent.targetKind).toBe('task')
    expect(agent.target).toEqual([30, 13])
    expect(agent.currentTask?.destination).toBe('printer')
  })

  it('rejects duplicate wander commands and recovers errors safely', () => {
    expect(useAgentStore.getState().requestWander('blue', [8, 12])).toBe(true)
    expect(useAgentStore.getState().requestWander('blue', [9, 12])).toBe(false)
    expect(useAgentStore.getState().agents.blue.target).toEqual([8, 12])

    useAgentStore.getState().enqueueTask('printer')
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().failTask('blue')).toBe(true)
    expect(useAgentStore.getState().recoverError('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('idle')
    expect(useAgentStore.getState().agents.blue.currentTask).toBeNull()
    expect(useAgentStore.getState().recoverError('blue')).toBe(false)
  })

  it('records task arrival and completion timing metadata', () => {
    useAgentStore.getState().enqueueTask('whiteboard')
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(true)
    const processing = useAgentStore.getState().agents.blue
    expect(processing.processingStartedAt).toEqual(expect.any(Number))
    expect(processing.lastArrivedTarget).toEqual([29, 4])
    expect(useAgentStore.getState().completeTask('blue')).toBe(true)
    const completed = useAgentStore.getState().agents.blue
    expect(completed.lastCompletedAt).toEqual(expect.any(Number))
    expect(completed.lastCompletedDestination).toBe('whiteboard')
  })

  it('guards stale transitions and clears a completed task', () => {
    useAgentStore.getState().enqueueTask('whiteboard')
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().completeTask('blue')).toBe(false)
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(true)
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(false)
    expect(useAgentStore.getState().completeTask('blue')).toBe(true)
    expect(useAgentStore.getState().completeTask('blue')).toBe(false)
    const agent = useAgentStore.getState().agents.blue
    expect(agent.status).toBe('idle')
    expect(agent.currentTask).toBeNull()
    expect(agent.target).toBeNull()
  })

  it('moves failed work into error without leaving the task queue blocked', () => {
    useAgentStore.getState().enqueueTask('printer')
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().failTask('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('error')
    expect(useAgentStore.getState().agents.blue.currentTask?.id).toBe('task-1')
    expect(useAgentStore.getState().dispatchAvailableTasks()).toBeUndefined()
    expect(useAgentStore.getState().agents.green.status).toBe('idle')
  })
})
