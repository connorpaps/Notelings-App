import { test, expect } from '@playwright/test'
import { LOCKED_DEFAULT_ITEMS } from '../components/office/officeBuilderDefault'
import { AGENT_GRID_COLS, AGENT_GRID_ROWS, AGENT_START_CELLS, buildAgentBlockedCells } from '../components/office/agentGrid'
import { TASK_DESTINATIONS } from '../components/office/agentDestinations'
import { findPath } from '../components/office/pathfinding'

const EXPECTED_IDS = LOCKED_DEFAULT_ITEMS.map((item) => item.id)
const MODEL_IDS = LOCKED_DEFAULT_ITEMS.filter((item) => item.kind === 'model').map((item) => item.id)

type SceneObject = {
  name?: string
  children?: SceneObject[]
  isMesh?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  intensity?: number
  position?: { x?: number; y?: number; z?: number }
  userData?: Record<string, unknown>
  material?: unknown
  shadow?: {
    mapSize?: { x?: number; y?: number }
    camera?: { left?: number; right?: number; top?: number; bottom?: number }
  }
}

test('static office diorama preserves the locked visual baseline with two agents', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  await page.addInitScript(() => {
    window.localStorage.setItem('notelings-office-builder-v4', 'preexisting-builder-snapshot')
    window.localStorage.setItem('notelings-office-builder-json-v1', 'preexisting-builder-export')
  })

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('aside[aria-label="Office builder"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send to Whiteboard' })).toBeVisible()

  await page.waitForFunction(
    (ids) => {
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
      const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
        if (root?.name === name) return root
        for (const child of root?.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const count = (root: SceneObject): number =>
        (root.isMesh ? 1 : 0) + (root.children ?? []).reduce((total, child) => total + count(child), 0)
      return Boolean(scene && ids.every((id) => {
        const item = find(scene, id)
        return Boolean(item && count(item) > 0)
      }))
    },
    EXPECTED_IDS,
    { timeout: 60_000, polling: 500 },
  )

  const audit = await page.evaluate((modelIds) => {
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
    const renderer = (window as unknown as { __NOTELINGS_RENDERER__?: { toneMapping?: number; toneMappingExposure?: number; getPixelRatio?: () => number } }).__NOTELINGS_RENDERER__
    const camera = (window as unknown as { __NOTELINGS_CAMERA__?: { position?: { x?: number; y?: number; z?: number }; zoom?: number; near?: number; far?: number } }).__NOTELINGS_CAMERA__
    const cameraProfile = (window as unknown as { __NOTELINGS_CAMERA_PROFILE__?: unknown }).__NOTELINGS_CAMERA_PROFILE__
    const renderProfile = (window as unknown as { __NOTELINGS_RENDER_PROFILE__?: unknown }).__NOTELINGS_RENDER_PROFILE__
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    const configured = modelIds.every((id) => {
      const root = find(scene, id)
      if (!root) return false
      const meshes: SceneObject[] = []
      const collect = (node: SceneObject) => {
        if (node.isMesh) meshes.push(node)
        for (const child of node.children ?? []) collect(child)
      }
      collect(root)
      return meshes.length > 0 && meshes.every((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        return Boolean(mesh.castShadow && mesh.receiveShadow && materials.every((material) => {
          const data = (material as { type?: string; userData?: { notelingsLightingConfigured?: boolean; notelingsHasMap?: boolean } } | undefined)
          return data && data.type !== 'MeshBasicMaterial' && data.userData?.notelingsLightingConfigured && data.userData?.notelingsHasMap
        }))
      })
    })
    return {
      configured,
      lockedScenePresent: Boolean(find(scene, 'locked-office-scene')),
      builderScenePresent: Boolean(find(scene, 'office-builder-scene')),
      gridDebugPresent: Boolean(find(scene, 'grid-debug')),
      rendererPixelRatio: renderer?.getPixelRatio?.() ?? -1,
      rendererToneMappingExposure: renderer?.toneMappingExposure ?? -1,
      ambientIntensity: find(scene, 'office-ambient')?.intensity ?? -1,
      keyIntensity: find(scene, 'office-key')?.intensity ?? -1,
      camera: [camera?.position?.x ?? -1, camera?.position?.y ?? -1, camera?.position?.z ?? -1, camera?.zoom ?? -1, camera?.near ?? -1, camera?.far ?? -1],
      cameraProfile,
      renderProfile,
      shadowEnabled: find(scene, 'office-key')?.castShadow ?? false,
      shadowMapSize: [find(scene, 'office-key')?.shadow?.mapSize?.x ?? -1, find(scene, 'office-key')?.shadow?.mapSize?.y ?? -1],
      shadowBounds: [find(scene, 'office-key')?.shadow?.camera?.left ?? 0, find(scene, 'office-key')?.shadow?.camera?.right ?? 0, find(scene, 'office-key')?.shadow?.camera?.top ?? 0, find(scene, 'office-key')?.shadow?.camera?.bottom ?? 0],
      builderStorage: window.localStorage.getItem('notelings-office-builder-v4'),
      builderExportStorage: window.localStorage.getItem('notelings-office-builder-json-v1'),
    }
  }, MODEL_IDS)

  expect(audit.configured).toBe(true)
  expect(audit.lockedScenePresent).toBe(true)
  expect(audit.builderScenePresent).toBe(false)
  expect(audit.gridDebugPresent).toBe(false)
  expect(audit.rendererPixelRatio).toEqual(expect.any(Number))
  expect(audit.rendererToneMappingExposure).toBe(1.2)
  expect(audit.ambientIntensity).toBe(0.5)
  expect(audit.keyIntensity).toBe(3)
  expect(audit.camera).toEqual([24, 22, 24, 38, -100, 300])
  expect(audit.shadowEnabled).toBe(true)
  expect(audit.shadowMapSize).toEqual([4096, 4096])
  expect(audit.shadowBounds).toEqual([-30, 30, 30, -30])
  expect(audit.builderStorage).toBe('preexisting-builder-snapshot')
  expect(audit.builderExportStorage).toBe('preexisting-builder-export')
  expect(audit.cameraProfile).toEqual({ position: [24, 22, 24], target: [0, 1.5, 0], zoom: 38, near: -100, far: 300, controls: false, frameloop: 'always' })
  expect(audit.renderProfile).toEqual({ frameloop: 'always', shadows: true, shadowMapSize: [4096, 4096], postprocessing: true, toneMappingMode: null, toneMappingExposure: 1.2, bloom: { luminanceThreshold: 1, intensity: 0.2 }, ssao: { samples: 32, rings: 4, intensity: 2 } })
  expect(errors).toEqual([])

  await page.screenshot({ path: 'test-results/office-static-diorama.png', fullPage: true, animations: 'disabled' })
})

test('Milestone 3 dispatches two tasks to two robots and completes them', async ({ page }) => {
  test.setTimeout(45_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Send to Whiteboard' })).toBeVisible()

  await page.waitForFunction(() => {
    const agents = (window as unknown as { __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask: unknown }> } }).__NOTELINGS_AGENTS__
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    return Boolean(agents && scene && agents.taskQueueLength === 0 && Object.keys(agents.agents).length === 2 && find(scene, 'agent-robot-blue') && find(scene, 'agent-robot-green'))
  }, { timeout: 30_000, polling: 100 })

  const blocked = buildAgentBlockedCells()
  for (const [id, cell] of Object.entries(AGENT_START_CELLS)) {
    expect(blocked.has(`${cell[0]},${cell[1]}`)).toBe(false)
    expect(findPath(AGENT_START_CELLS.blue, cell, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
    expect(id).toMatch(/blue|green/)
  }

  const whiteboardButton = page.getByRole('button', { name: 'Send to Whiteboard' })
  const printerButton = page.getByRole('button', { name: 'Send to Printer' })
  await expect(whiteboardButton).toBeEnabled()
  await expect(printerButton).toBeEnabled()
  await whiteboardButton.click()
  await printerButton.click()

  await page.waitForFunction(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask?: { destination: string } | null }> } }).__NOTELINGS_AGENTS__
    if (!runtime) return false
    const assigned = Object.values(runtime.agents).filter((agent) => agent.currentTask !== null)
    return assigned.length === 2 && assigned.every((agent) => agent.status === 'walking' || agent.status === 'processing')
  }, { timeout: 10_000, polling: 100 })

  const assignments = await page.evaluate(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { agents: Record<string, { currentTask?: { destination: string } | null }> } }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {}).map((agent) => agent.currentTask?.destination).sort()
  })
  expect(assignments).toEqual(['printer', 'whiteboard'])

  await page.waitForFunction(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { agents: Record<string, { status: string }> } }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {}).some((agent) => agent.status === 'processing')
  }, { timeout: 60_000, polling: 100 })

  try {
    await page.waitForFunction(() => {
      const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask: unknown }> } }).__NOTELINGS_AGENTS__
      return Boolean(runtime && runtime.taskQueueLength === 0 && Object.values(runtime.agents).every((agent) => agent.status === 'idle' && agent.currentTask === null))
    }, { timeout: 15_000, polling: 100 })
  } catch (error) {
    let diagnostic = 'page unavailable'
    if (!page.isClosed()) {
      diagnostic = JSON.stringify(await page.evaluate(() => {
        const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: unknown }).__NOTELINGS_AGENTS__
        const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
        const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
          if (root?.name === name) return root
          for (const child of root?.children ?? []) {
            const match = find(child, name)
            if (match) return match
          }
          return undefined
        }
        return {
          runtime,
          positions: {
            blue: find(scene, 'agent-robot-blue')?.position,
            green: find(scene, 'agent-robot-green')?.position,
          },
        }
      }))
    }
    throw new Error(`${String(error)}\\nM3 diagnostic: ${diagnostic}`)
  }

  // The completion timer is part of the tested lifecycle; each task must have
  // spent at least two seconds in processing before returning to idle.
  expect(await page.getByText(/idle/i).count()).toBeGreaterThan(0)
  const completed = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: {
        agents: Record<string, {
          lastCompletedAt?: number | null
          processingStartedAt?: number | null
          lastCompletedDestination?: string | null
        }>
      }
    }).__NOTELINGS_AGENTS__
    return runtime?.agents ?? {}
  })
  const completedDestinations = Object.values(completed).map((agent) => agent.lastCompletedDestination).sort()
  expect(completedDestinations).toEqual(['printer', 'whiteboard'])
  for (const agent of Object.values(completed)) {
    expect(agent.processingStartedAt).toEqual(expect.any(Number))
    expect(agent.lastCompletedAt).toEqual(expect.any(Number))
    expect((agent.lastCompletedAt ?? 0) - (agent.processingStartedAt ?? 0)).toBeGreaterThanOrEqual(2000)
  }
  const arrivalTargets = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { lastArrivedTarget?: [number, number] | null }> }
    }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {}).map((agent) => agent.lastArrivedTarget)
  })
  expect(arrivalTargets).toEqual(expect.arrayContaining([[19, 10], [30, 13]]))
  expect(errors).toEqual([])
})
