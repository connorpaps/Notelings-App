'use client'

import { useEffect } from 'react'
import { useAgentStore } from './agentStore'

export function useTaskDispatcher(): void {
  const queueLength = useAgentStore((state) => state.taskQueue.length)
  const blueStatus = useAgentStore((state) => state.agents.blue.status)
  const greenStatus = useAgentStore((state) => state.agents.green.status)
  const blueTask = useAgentStore((state) => state.agents.blue.currentTask?.id ?? null)
  const greenTask = useAgentStore((state) => state.agents.green.currentTask?.id ?? null)
  const dispatchAvailableTasks = useAgentStore((state) => state.dispatchAvailableTasks)

  useEffect(() => {
    dispatchAvailableTasks()
  }, [blueStatus, blueTask, dispatchAvailableTasks, greenStatus, greenTask, queueLength])
}
