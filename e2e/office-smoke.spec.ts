import { test, expect } from '@playwright/test'
import { LOCKED_DEFAULT_ITEMS } from '../components/office/officeBuilderDefault'

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
  rotation?: { x?: number; y?: number; z?: number }
  userData?: Record<string, unknown>
  parent?: { name?: string }
  material?: unknown
  visible?: boolean
  shadow?: {
    mapSize?: { x?: number; y?: number }
    camera?: { left?: number; right?: number; top?: number; bottom?: number }
  }
}

test('static office diorama preserves the locked baseline with three robots and the M4 UI', async ({ page }) => {
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
  await expect(page.locator('body')).not.toContainText('THESIS: the office is the stage')
  await expect(page.locator('meta[name="notelings-direction-contract"]')).toHaveAttribute('content', /THESIS: the office is the stage/)
  // M4 UI replaces the M3 task console entirely.
  await expect(page.getByRole('button', { name: 'Send to Whiteboard' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Initialize Agents' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Type a new note' })).toBeVisible()
  await page.getByRole('button', { name: 'Initialize Agents' }).click()
  await expect(page.getByRole('button', { name: 'Initialize Agents' })).toHaveCount(0)

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
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    const renderer = (window as unknown as { __NOTELINGS_RENDERER__?: { toneMapping?: number; toneMappingExposure?: number; getPixelRatio?: () => number } }).__NOTELINGS_RENDERER__
    const camera = (window as unknown as { __NOTELINGS_CAMERA__?: { position?: { x?: number; y?: number; z?: number }; zoom?: number; near?: number; far?: number } }).__NOTELINGS_CAMERA__
    const cameraProfile = (window as unknown as { __NOTELINGS_CAMERA_PROFILE__?: unknown }).__NOTELINGS_CAMERA_PROFILE__
    const renderProfile = (window as unknown as { __NOTELINGS_RENDER_PROFILE__?: unknown }).__NOTELINGS_RENDER_PROFILE__
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
  expect(audit.rendererPixelRatio).toBe(1)
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

  const runtime = await page.evaluate(() => {
    const agents = (window as unknown as { __NOTELINGS_AGENTS__?: { agents: Record<string, { id: string; status: string }> } }).__NOTELINGS_AGENTS__
    return agents?.agents ?? {}
  })
  expect(Object.keys(runtime).sort()).toEqual(['blue', 'green', 'red'])
  expect(Object.values(runtime).every((agent) => agent.status === 'idle')).toBe(true)

  const robotParts = await page.evaluate(() => {
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    return ['blue', 'green', 'red'].map((id) => {
      const robot = find(scene, `agent-robot-${id}`)
      const body = robot?.children?.find((child) => child.name === 'robot-body')
      const face = robot?.children?.find((child) => child.name === 'robot-face')
      const glow = robot?.children?.find((child) => child.name === 'robot-glow')
      return {
        robotParent: robot?.name,
        bodyParentName: body?.parent?.name,
        faceParentName: face?.parent?.name,
        bodyPart: body?.userData?.notelingsRobotPart,
        facePart: face?.userData?.notelingsRobotPart,
        faceOrientation: face?.userData?.notelingsFaceOrientation,
        bodyPosition: body?.position,
        facePosition: face?.position,
        faceRotation: face?.rotation,
        glowPart: glow?.userData?.notelingsRobotPart,
        glowVisible: glow?.visible,
      }
    })
  })
  for (const parts of robotParts) {
    expect(parts.robotParent).toMatch(/^agent-robot-/)
    expect(parts.bodyParentName).toBe(parts.robotParent)
    expect(parts.faceParentName).toBe(parts.robotParent)
    expect(parts.bodyPart).toBe('body')
    expect(parts.facePart).toBe('face')
    expect(parts.faceOrientation).toBe('heading-aligned')
    expect(parts.bodyPosition?.x).toBe(0)
    expect(parts.bodyPosition?.z).toBe(0)
    expect(parts.facePosition?.x).toBeCloseTo(0, 2)
    expect((parts.facePosition?.y ?? 0) - (parts.bodyPosition?.y ?? 0)).toBeCloseTo(0.42, 2)
    expect(parts.facePosition?.z).toBeGreaterThan(0.38)
    expect(parts.facePosition?.z).toBeCloseTo(0.42, 2)
    expect(parts.faceRotation?.y ?? 0).toBeCloseTo(0, 5)
    // The red sentinel glow exists but is hidden while idle.
    expect(parts.glowPart).toBe('glow')
    expect(parts.glowVisible).toBe(false)
  }

  // Static white background contract behind the transparent WebGL canvas.
  const backgroundState = await page.evaluate(() => {
    const background = document.querySelector('[data-background="static-white"]')
    return {
      present: Boolean(background),
      color: background ? getComputedStyle(background).backgroundColor : null,
      videoCount: document.querySelectorAll('video').length,
      ambientGlowCount: document.querySelectorAll('.ambient-glow').length,
    }
  })
  expect(backgroundState).toEqual({
    present: true,
    color: 'rgb(255, 255, 255)',
    videoCount: 0,
    ambientGlowCount: 0,
  })

  const cornerPixel = await page.evaluate(() => {
    const renderer = (window as unknown as {
      __NOTELINGS_RENDERER__?: {
        getContext?: () => {
          readPixels: (x: number, y: number, w: number, h: number, format: number, type: number, pixels: Uint8Array) => void
          RGBA: number
          UNSIGNED_BYTE: number
        }
      }
    }).__NOTELINGS_RENDERER__
    const gl = renderer?.getContext?.()
    if (!gl) return null
    const buf = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    return Array.from(buf)
  })
  // The viewport corner is outside the office: alpha 0 means the white background shows through.
  expect(cornerPixel?.[3]).toBe(0)

  expect(errors).toEqual([])

  await page.screenshot({ path: 'test-results/office-m4-baseline.png', fullPage: true, animations: 'disabled' })
})

test('Milestone 4 dispatches categorized notes to two robots and completes them', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  // Deterministic mocked LLM: roadmap → Work/whiteboard, contracts → Admin/printer.
  await page.route('**/api/categorize', (route) => {
    const body = route.request().postDataJSON() as { content?: string }
    const content = body?.content ?? ''
    const work = content.toLowerCase().includes('roadmap')
    route.fulfill({
      json: work
        ? { id: 'note-e2e-work', category: 'Work', tags: ['roadmap'], degraded: false }
        : { id: 'note-e2e-admin', category: 'Admin', tags: ['print'], degraded: false },
    })
  })

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()
  const input = page.getByRole('textbox', { name: 'Type a new note' })
  const submit = page.getByRole('button', { name: 'Submit note' })

  await input.fill('plan the Q3 roadmap')
  await submit.click()
  await expect(page.getByText(/Note saved as Work and agent dispatched!/)).toBeVisible({ timeout: 15_000 })

  await input.fill('print the vendor contracts')
  await submit.click()
  await expect(page.getByText(/Note saved as Admin and agent dispatched!/)).toBeVisible({ timeout: 15_000 })

  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask?: { destination: string; content: string } | null }> }
    }).__NOTELINGS_AGENTS__
    if (!runtime) return false
    const assigned = Object.values(runtime.agents).filter((agent) => agent.currentTask !== null)
    return assigned.length === 2 && assigned.every((agent) => agent.status === 'walking' || agent.status === 'processing')
  }, { timeout: 15_000, polling: 100 })

  const assignments = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { currentTask?: { destination: string; content: string } | null }> }
    }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {})
      .map((agent) => agent.currentTask)
      .filter((task): task is { destination: string; content: string } => task !== null)
      .map((task) => ({ destination: task.destination, content: task.content }))
      .sort((a, b) => a.destination.localeCompare(b.destination))
  })
  expect(assignments).toEqual([
    { destination: 'printer', content: 'print the vendor contracts' },
    { destination: 'whiteboard', content: 'plan the Q3 roadmap' },
  ])

  // The physical delivery completes when a robot reaches its destination and
  // processes → idle, which emits a store completion event → success toast.
  // Blue gets the first FIFO task (Work/whiteboard), Green the second (Admin/printer).
  // Waits run concurrently so each toast is caught the moment it appears,
  // regardless of which robot finishes first (toasts auto-dismiss after 4s).
  await Promise.all([
    page.getByText('Success: Blue Agent filed your note in Work.').waitFor({ state: 'visible', timeout: 60_000 }),
    page.getByText('Success: Green Agent filed your note in Admin.').waitFor({ state: 'visible', timeout: 60_000 }),
  ])

  try {
    await page.waitForFunction(() => {
      const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask: unknown }> } }).__NOTELINGS_AGENTS__
      return Boolean(runtime && runtime.taskQueueLength === 0 && Object.values(runtime.agents).every((agent) => agent.status === 'idle' && agent.currentTask === null))
    }, { timeout: 20_000, polling: 100 })
  } catch (error) {
    let diagnostic = 'page unavailable'
    if (!page.isClosed()) {
      diagnostic = JSON.stringify(await page.evaluate(() => {
        const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: unknown }).__NOTELINGS_AGENTS__
        return { runtime }
      }))
    }
    throw new Error(`${String(error)}\nM4 diagnostic: ${diagnostic}`)
  }

  const completed = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, {
        lastCompletedAt?: number | null
        processingStartedAt?: number | null
        lastCompletedDestination?: string | null
      }> }
    }).__NOTELINGS_AGENTS__
    return runtime?.agents ?? {}
  })
  const completedDestinations = Object.values(completed)
    .map((agent) => agent.lastCompletedDestination)
    .filter((destination): destination is string => destination !== null)
    .sort()
  expect(completedDestinations).toEqual(['printer', 'whiteboard'])
  for (const agent of Object.values(completed)) {
    if (agent.lastCompletedDestination) {
      expect(agent.processingStartedAt).toEqual(expect.any(Number))
      expect(agent.lastCompletedAt).toEqual(expect.any(Number))
      expect((agent.lastCompletedAt ?? 0) - (agent.processingStartedAt ?? 0)).toBeGreaterThanOrEqual(2000)
    }
  }
  const arrivalTargets = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { lastArrivedTarget?: [number, number] | null }> }
    }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {}).map((agent) => agent.lastArrivedTarget)
  })
  expect(arrivalTargets).toEqual(expect.arrayContaining([[29, 4], [30, 13]]))
  expect(errors).toEqual([])
})

test('Milestone 4 degraded path: LLM failure saves, flags red sentinel, and still dispatches', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.route('**/api/categorize', (route) =>
    route.fulfill({ status: 500, json: { error: 'boom' } }),
  )

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  const input = page.getByRole('textbox', { name: 'Type a new note' })
  await input.fill('a note that cannot be categorized')
  await page.getByRole('button', { name: 'Submit note' }).click()

  await expect(page.getByText(/Could not reach the categorizer/)).toBeVisible({ timeout: 15_000 })

  // The note still lands in the queue as Uncategorized → corkboard.
  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { status: string; currentTask?: { destination: string; category: string } | null }> }
    }).__NOTELINGS_AGENTS__
    if (!runtime) return false
    const assigned = Object.values(runtime.agents).filter((agent) => agent.currentTask !== null)
    return assigned.length === 1 && assigned[0].currentTask?.destination === 'corkboard'
      && assigned[0].currentTask?.category === 'Uncategorized'
  }, { timeout: 10_000, polling: 100 })

  // Red sentinel enters error with its glow visible.
  await page.waitForFunction(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { agents: Record<string, { status: string }> } }).__NOTELINGS_AGENTS__
    return runtime?.agents?.red?.status === 'error'
  }, { timeout: 10_000, polling: 100 })

  const glowVisible = await page.evaluate(() => {
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    const robot = find(scene, 'agent-robot-red')
    return robot?.children?.find((child) => child.name === 'robot-glow')?.visible ?? false
  })
  expect(glowVisible).toBe(true)

  // The sentinel auto-recovers; the note is still delivered to the corkboard.
  await page.waitForFunction(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { agents: Record<string, { status: string }> } }).__NOTELINGS_AGENTS__
    return runtime?.agents?.red?.status === 'idle'
  }, { timeout: 15_000, polling: 100 })

  await page.waitForFunction(() => {
    const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; lastArrivedTarget?: [number, number] | null }> } }).__NOTELINGS_AGENTS__
    return Boolean(runtime && runtime.taskQueueLength === 0
      && Object.values(runtime.agents).some((agent) => (agent.lastArrivedTarget?.[0] ?? -1) === 27 && (agent.lastArrivedTarget?.[1] ?? -1) === 4))
  }, { timeout: 60_000, polling: 100 })
  // Even the degraded delivery ends with the completion confirmation once the
  // note physically reaches the corkboard (Blue is the first available agent).
  await expect(page.getByText(/Success: (Blue|Green) Agent filed your note in Uncategorized\./)).toBeVisible({ timeout: 30_000 })
  // The mocked 500 is deliberate in this test; any OTHER console/page error fails.
  expect(errors.filter((error) => !error.includes('status of 500'))).toEqual([])
})
