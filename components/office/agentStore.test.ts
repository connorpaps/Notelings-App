import { beforeEach, describe, expect, it } from 'vitest'
import { useAgentStore } from './agentStore'
import { TASK_DESTINATIONS } from './agentDestinations'

const task = (destination: 'whiteboard' | 'printer' | 'corkboard', content = 'a', category: 'Work' | 'Admin' | 'Uncategorized' = 'Work') => ({
  destination,
  content,
  category,
  tags: ['tag'],
})

const note = (id: string, status: 'pending' | 'in_transit' | 'filed' | 'archived' = 'pending') => ({
  id,
  content: 'note content',
  category: 'Work' as const,
  tags: [],
  status,
  created_at: new Date().toISOString(),
})

describe('agent store', () => {
  beforeEach(() => {
    useAgentStore.getState().resetForTests()
  })

  it('starts with three agents (blue, green, red sentinel) and an empty queue', () => {
    const state = useAgentStore.getState()
    expect(state.taskQueue).toEqual([])
    expect(Object.keys(state.agents)).toEqual(['blue', 'green', 'red'])
    expect(Object.values(state.agents).every((agent) => agent.status === 'idle')).toBe(true)
    expect(state.agents.red.color).toBe('#ef4444')
  })

  it('preserves FIFO order and assigns blue before green', () => {
    const enqueue = useAgentStore.getState().enqueueTask
    expect(enqueue(task('whiteboard', 'first', 'Work'))).toBe('task-1')
    expect(enqueue(task('printer', 'second', 'Admin'))).toBe('task-2')
    expect(enqueue(task('whiteboard', 'third', 'Work'))).toBe('task-3')

    useAgentStore.getState().dispatchAvailableTasks()
    let state = useAgentStore.getState()
    expect(state.taskQueue.map((queued) => queued.id)).toEqual(['task-3'])
    expect(state.agents.blue.currentTask?.destination).toBe('whiteboard')
    expect(state.agents.green.currentTask?.destination).toBe('printer')
    expect(state.agents.blue.currentTask?.content).toBe('first')
    expect(state.agents.blue.currentTask?.category).toBe('Work')
    expect(state.agents.blue.currentTask?.tags).toEqual(['tag'])
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
    expect(useAgentStore.getState().enqueueTask(task('printer'))).toBe('task-1')
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

    useAgentStore.getState().enqueueTask(task('printer'))
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().failTask('blue')).toBe(true)
    expect(useAgentStore.getState().recoverError('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('idle')
    expect(useAgentStore.getState().agents.blue.currentTask).toBeNull()
    expect(useAgentStore.getState().recoverError('blue')).toBe(false)
  })

  it('records task arrival and completion timing metadata', () => {
    useAgentStore.getState().enqueueTask(task('whiteboard'))
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
    useAgentStore.getState().enqueueTask(task('whiteboard'))
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
    useAgentStore.getState().enqueueTask(task('printer'))
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().failTask('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('error')
    expect(useAgentStore.getState().agents.blue.currentTask?.id).toBe('task-1')
    expect(useAgentStore.getState().dispatchAvailableTasks()).toBeUndefined()
    expect(useAgentStore.getState().agents.green.status).toBe('idle')
  })

  it('keeps red as a non-dispatchable error sentinel', () => {
    useAgentStore.getState().enqueueTask(task('whiteboard'))
    useAgentStore.getState().enqueueTask(task('printer', 'b', 'Admin'))
    useAgentStore.getState().enqueueTask(task('corkboard', 'c', 'Uncategorized'))
    useAgentStore.getState().dispatchAvailableTasks()
    const { agents, taskQueue } = useAgentStore.getState()
    expect(agents.blue.currentTask?.destination).toBe('whiteboard')
    expect(agents.green.currentTask?.destination).toBe('printer')
    expect(agents.red.currentTask).toBeNull()
    expect(agents.red.status).toBe('idle')
    expect(taskQueue).toHaveLength(1)
    expect(taskQueue[0].category).toBe('Uncategorized')
  })

  it('signalError marks any agent error and can recover', () => {
    expect(useAgentStore.getState().signalError('red')).toBe(true)
    expect(useAgentStore.getState().agents.red.status).toBe('error')
    expect(useAgentStore.getState().recoverError('red')).toBe(true)
    expect(useAgentStore.getState().agents.red.status).toBe('idle')
    expect(useAgentStore.getState().signalError('green')).toBe(true)
    expect(useAgentStore.getState().agents.green.status).toBe('error')
  })

  it('records a toast-ready completion event for each finished task', () => {
    useAgentStore.getState().enqueueTask(task('printer', 'print the contracts', 'Admin'))
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(true)
    expect(useAgentStore.getState().completeTask('blue')).toBe(true)
    const state = useAgentStore.getState()
    expect(state.completions).toHaveLength(1)
    expect(state.completions[0]).toMatchObject({
      id: 'task-1',
      agentId: 'blue',
      destination: 'printer',
      category: 'Admin',
      content: 'print the contracts',
    })
    expect(state.completions[0].completedAt).toEqual(expect.any(Number))
  })

  it('does not record completion events for failed work', () => {
    useAgentStore.getState().enqueueTask(task('whiteboard'))
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().failTask('blue')).toBe(true)
    expect(useAgentStore.getState().recoverError('blue')).toBe(true)
    expect(useAgentStore.getState().completions).toEqual([])
  })

  it('records multiple completions in dispatch order and resets with resetForTests', () => {
    const store = useAgentStore.getState()
    store.enqueueTask(task('whiteboard', 'one', 'Work'))
    store.enqueueTask(task('printer', 'two', 'Admin'))
    store.dispatchAvailableTasks()
    expect(useAgentStore.getState().arriveAtTask('blue')).toBe(true)
    expect(useAgentStore.getState().arriveAtTask('green')).toBe(true)
    expect(useAgentStore.getState().completeTask('blue')).toBe(true)
    expect(useAgentStore.getState().completeTask('green')).toBe(true)
    const state = useAgentStore.getState()
    expect(state.completions.map((completion) => completion.agentId)).toEqual(['blue', 'green'])
    expect(state.completions.map((completion) => completion.category)).toEqual(['Work', 'Admin'])
    state.resetForTests()
    expect(useAgentStore.getState().completions).toEqual([])
  })

  it('carries the DB note id through enqueueTask and dispatch', () => {
    const id = useAgentStore.getState().enqueueTask({ ...task('whiteboard'), noteId: 'note-1' })
    useAgentStore.getState().dispatchAvailableTasks()
    expect(useAgentStore.getState().agents.blue.currentTask?.noteId).toBe('note-1')
    expect(useAgentStore.getState().agents.blue.currentTask?.kind).toBe('note')
    useAgentStore.getState().arriveAtTask('blue')
    useAgentStore.getState().completeTask('blue')
    expect(useAgentStore.getState().completions[0].noteId).toBe('note-1')
    expect(useAgentStore.getState().completions[0].kind).toBe('note')
    expect(id).toBe('task-1')
  })

  it('keeps notes and terminal logs in state with a 100-entry cap', () => {
    const store = useAgentStore.getState()
    store.setNotes([note('n1')])
    expect(useAgentStore.getState().notes.n1.status).toBe('pending')
    for (let i = 0; i < 120; i += 1) useAgentStore.getState().logTerminal(`line ${i}`)
    expect(useAgentStore.getState().terminalLogs).toHaveLength(100)
    expect(useAgentStore.getState().terminalLogs[99].message).toBe('line 119')
    store.upsertNote({ ...useAgentStore.getState().notes.n1, status: 'filed' })
    expect(useAgentStore.getState().notes.n1.status).toBe('filed')
    store.removeNote('n1')
    expect(useAgentStore.getState().notes.n1).toBeUndefined()
  })

  it('logs queued/dispatched/filed events to the terminal', () => {
    useAgentStore.getState().enqueueTask(task('whiteboard', 'roadmap', 'Work'))
    useAgentStore.getState().dispatchAvailableTasks()
    useAgentStore.getState().arriveAtTask('blue')
    useAgentStore.getState().completeTask('blue')
    const messages = useAgentStore.getState().terminalLogs.map((entry) => entry.message)
    expect(messages[0]).toMatch(/Note queued: "roadmap"/)
    expect(messages[1]).toMatch(/Blue Agent dispatched: "roadmap"/)
    expect(messages[2]).toMatch(/Blue Agent filed "roadmap" in Work\./)
  })

  it('runs the archive state machine without emitting a delivery completion', () => {
    useAgentStore.getState().markNoteArchiving('note-a')
    expect(useAgentStore.getState().archivingNoteIds).toContain('note-a')
    useAgentStore.getState().enqueueArchive({ noteId: 'note-a', category: 'Work', content: 'old idea', tags: [] })
    useAgentStore.getState().dispatchAvailableTasks()
    const walking = useAgentStore.getState().agents.blue
    expect(walking.targetKind).toBe('archive')
    expect(walking.target).toEqual(TASK_DESTINATIONS.whiteboard)
    expect(walking.currentTask?.finalDestination).toEqual([29, 24])
    expect(useAgentStore.getState().arriveArchiveStage('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('processing')
    expect(useAgentStore.getState().completeArchiveStage('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.targetKind).toBe('archive-final')
    expect(useAgentStore.getState().agents.blue.target).toEqual([29, 24])
    expect(useAgentStore.getState().arriveArchiveFinal('blue')).toBe(true)
    expect(useAgentStore.getState().agents.blue.status).toBe('idle')
    expect(useAgentStore.getState().agents.blue.currentTask).toBeNull()
    expect(useAgentStore.getState().archivingNoteIds).not.toContain('note-a')
    expect(useAgentStore.getState().completions).toEqual([])
    expect(useAgentStore.getState().archivedTasks).toHaveLength(1)
    expect(useAgentStore.getState().archivedTasks[0]).toMatchObject({ noteId: 'note-a', kind: 'archive', agentId: 'blue' })
    expect(useAgentStore.getState().terminalLogs.at(-1)?.message).toMatch(/Blue Agent archived "old idea"\./)
  })

  it('guards the archive machine against invalid transitions', () => {
    expect(useAgentStore.getState().arriveArchiveStage('blue')).toBe(false)
    expect(useAgentStore.getState().completeArchiveStage('blue')).toBe(false)
    expect(useAgentStore.getState().arriveArchiveFinal('blue')).toBe(false)
    useAgentStore.getState().enqueueArchive({ noteId: 'n', category: 'Admin', content: 'x', tags: [] })
    useAgentStore.getState().dispatchAvailableTasks()
    // Leg 2 cannot start before the robot arrives at the destination.
    expect(useAgentStore.getState().completeArchiveStage('blue')).toBe(false)
    expect(useAgentStore.getState().arriveArchiveStage('blue')).toBe(true)
    // The final arrival cannot happen before leg 2 is issued.
    expect(useAgentStore.getState().arriveArchiveFinal('blue')).toBe(false)
    expect(useAgentStore.getState().completeArchiveStage('blue')).toBe(true)
    expect(useAgentStore.getState().arriveArchiveFinal('blue')).toBe(true)
  })

  it('clears notes, logs, and archive state in resetForTests', () => {
    const store = useAgentStore.getState()
    store.setNotes([note('n1')])
    store.logTerminal('hello')
    store.markNoteArchiving('n1')
    store.resetForTests()
    expect(useAgentStore.getState().notes).toEqual({})
    expect(useAgentStore.getState().terminalLogs).toEqual([])
    expect(useAgentStore.getState().archivingNoteIds).toEqual([])
    expect(useAgentStore.getState().archivedTasks).toEqual([])
  })
})
