import { test, expect } from '@playwright/test'

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
  scale?: { x?: number; y?: number; z?: number }
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
  // Phase 2: the board fetch is mocked so the baseline is deterministic
  // (empty kanban) regardless of the live database. Note the glob must also
  // match the bare /api/notes (no trailing slash) used by the GET fetch.
  await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  const welcome = page.getByRole('dialog', { name: 'Spatial Second Brain' })
  await expect(welcome).toBeVisible()
  await expect(welcome).toHaveAttribute('aria-modal', 'true')
  const demoEntry = welcome.getByRole('button', { name: 'Enter demo workspace' })
  await expect(demoEntry).toBeVisible()
  await expect(demoEntry).toBeFocused()
  await expect(page.locator('body')).not.toContainText('THESIS: the office is the stage')
  await expect(page.locator('meta[name="notelings-direction-contract"]')).toHaveAttribute('content', /THESIS: the office is the stage/)
  // M4 UI replaces the M3 task console entirely.
  await expect(page.getByRole('button', { name: 'Send to Whiteboard' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Initialize Agents' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Type a new note' })).toBeVisible()
  await page.getByRole('button', { name: 'Initialize Agents' }).click()
  await expect(page.getByRole('button', { name: 'Initialize Agents' })).toHaveCount(0)

  // Phase 2 control center: the Spatial Board (3 columns) + terminal dock.
  await expect(page.getByRole('heading', { name: /Spatial Board/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Pending' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'In Transit' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Filed' })).toBeVisible()
  await expect(page.locator('[data-terminal-log]')).toBeVisible()
  // M3/M4 dock controls: tag explorer search + New Note / Ask AI mode toggle.
  await expect(page.getByRole('button', { name: 'Explore tags' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask AI' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New Note' })).toHaveAttribute('aria-pressed', 'true')
  // Note mode remains the default: the M4 UI must not steal the M4 input.
  await expect(page.getByRole('textbox', { name: 'Type a new note' })).toBeVisible()

  // The new GLB office scene mounts once the 18 MB model finishes loading.
  // Wait for the full mesh count: AgentLayer alone is ~21 meshes (3 robots +
  // a few office props), while the GLB adds ~696 — so a count > 100 proves
  // the model itself mounted, not just the agent layer.
  await page.waitForFunction(() => {
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
    const office = find(scene, 'new-office-scene')
    return Boolean(office && count(office) > 100)
  }, { timeout: 60_000, polling: 500 })

  const audit = await page.evaluate(() => {
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
    // The GLB's loader materials are plain MeshStandardMaterial/MeshBasicMaterial
    // (no legacy notelingsLightingConfigured userData), so audit the scene
    // directly: it must contain meshes with standard materials and shadows.
    const office = find(scene, 'new-office-scene')
    const meshes: SceneObject[] = []
    const collect = (node: SceneObject | undefined) => {
      if (!node) return
      if (node.isMesh) meshes.push(node)
      for (const child of node.children ?? []) collect(child)
    }
    collect(office)
    const hasStandardMaterial = meshes.some((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      return materials.some((material) => (material as { type?: string } | undefined)?.type === 'MeshStandardMaterial')
    })
    return {
      newOfficeScenePresent: Boolean(office),
      officeMeshCount: meshes.length,
      officeHasStandardMaterial: hasStandardMaterial,
      officeHasCastShadow: meshes.some((mesh) => mesh.castShadow),
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
  })

  expect(audit.newOfficeScenePresent).toBe(true)
  // The GLB adds ~696 meshes (the 3 robots alone are only ~15), so a large
  // count proves the model actually rendered — not just the agent layer.
  expect(audit.officeMeshCount).toBeGreaterThan(100)
  expect(audit.officeHasStandardMaterial).toBe(true)
  expect(audit.officeHasCastShadow).toBe(true)
  expect(audit.lockedScenePresent).toBe(false)
  expect(audit.builderScenePresent).toBe(false)
  // Nav Grid Editor is hidden by default now (toggled from the header controls).
  expect(audit.gridDebugPresent).toBe(false)
  expect(audit.rendererPixelRatio).toBe(1)
  expect(audit.rendererToneMappingExposure).toBe(1.2)
  expect(audit.ambientIntensity).toBe(0.5)
  expect(audit.keyIntensity).toBe(3)
  expect(audit.camera).toEqual([24, 22, 24, 86, -100, 300])
  expect(audit.shadowEnabled).toBe(true)
  const renderProfile = audit.renderProfile as { quality?: string; postprocessing?: boolean; shadowMapSize?: unknown; shadowCascade?: number; ssao?: { samples?: number; rings?: number } }
  const highQuality = renderProfile.quality === 'high'
  expect(audit.shadowMapSize).toEqual(highQuality ? [4096, 4096] : [2048, 2048])
  expect(audit.shadowBounds).toEqual(highQuality ? [-30, 30, 30, -30] : [-14, 14, 14, -14])
  expect(audit.builderStorage).toBe('preexisting-builder-snapshot')
  expect(audit.builderExportStorage).toBe('preexisting-builder-export')
  expect(audit.cameraProfile).toEqual({ position: [24, 22, 24], target: [0, 1, 0], zoom: 86, near: -100, far: 300, controls: false, frameloop: 'always' })
  expect(renderProfile.quality).toMatch(/^(high|balanced)$/)
  expect(renderProfile.postprocessing).toBe(renderProfile.quality === 'high')
  expect(renderProfile.shadowMapSize).toEqual(renderProfile.quality === 'high' ? [4096, 4096] : [2048, 2048])
  expect(renderProfile.shadowCascade).toBe(renderProfile.quality === 'high' ? 30 : 14)
  expect(renderProfile.ssao).toMatchObject(renderProfile.quality === 'high' ? { radius: 2.4, intensity: 2, samples: 32, rings: 4, bias: 0.3, luminanceInfluence: 0.65 } : { radius: 2.4, intensity: 2, samples: 16, rings: 2, bias: 0.3, luminanceInfluence: 0.65 })

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
      const note = robot?.children?.find((child) => child.name === 'robot-note')
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
        notePart: note?.userData?.notelingsRobotPart,
        noteVisible: note?.visible,
        robotScale: robot?.scale,
        smoothPath: robot?.userData?.notelingsSmoothPath,
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
    // Robot roots are intentionally scaled to 72% for the larger GLB framing.
    expect(parts.robotScale).toEqual({ x: 0.72, y: 0.72, z: 0.72 })
    expect(parts.smoothPath).toBe(false)
    expect(parts.facePosition?.z).toBeGreaterThan(0.34)
    expect(parts.facePosition?.z).toBeCloseTo(0.36, 2)
    expect(parts.faceRotation?.y ?? 0).toBeCloseTo(0, 5)
    // The red sentinel glow exists but is hidden while idle.
    expect(parts.glowPart).toBe('glow')
    expect(parts.glowVisible).toBe(false)
    // The note card exists on every robot and is hidden while idle.
    expect(parts.notePart).toBe('note')
    expect(parts.noteVisible).toBe(false)
  }

  // Light paper background contract: no image/video is mounted behind the
  // transparent office; the neutral ambient glow remains available.
  const backgroundState = await page.evaluate(() => {
    const background = document.querySelector('[data-background="light-paper"]')
    const ambientGlow = document.querySelector('.ambient-glow')
    return {
      present: Boolean(background),
      lightWorld: Boolean(document.querySelector('main.light-world')),
      imageCount: document.querySelectorAll('img').length,
      videoCount: document.querySelectorAll('video').length,
      ambientGlow: ambientGlow ? {
        blendMode: getComputedStyle(ambientGlow).mixBlendMode,
        animation: getComputedStyle(ambientGlow).animationName,
      } : null,
    }
  })
  expect(backgroundState).toEqual({
    present: true,
    lightWorld: true,
    imageCount: 0,
    videoCount: 0,
    ambientGlow: { blendMode: 'screen', animation: 'ambient-drift' },
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

test('AI-off capture uses optional tags and the Manual/Needs sorting state', async ({ page }) => {
  test.setTimeout(90_000)
  type ManualBody = { content?: string; category?: string; tags?: string[]; submission_id?: string }
  let manualBody: ManualBody | null = null
  let categorizeCalls = 0

  await page.route('**/api/categorize', (route) => {
    categorizeCalls += 1
    return route.abort()
  })
  await page.route('**/api/notes', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    const body = route.request().postDataJSON() as ManualBody
    manualBody = body
    return route.fulfill({ json: { id: 'note-e2e-manual', category: 'Manual', tags: body.tags ?? [], degraded: false } })
  })
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: { ok: true } }))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  await page.getByRole('button', { name: 'Turn AI off for manual capture' }).click()
  await expect(page.getByRole('button', { name: 'Turn AI on' })).toBeVisible()
  await expect(page.locator('#manual-category')).toHaveCount(0)
  await expect(page.getByLabel('Manual tags (optional)')).toBeVisible()

  await page.getByLabel('Manual tags (optional)').fill('Grocery')
  await page.getByRole('textbox', { name: 'Type a new note' }).fill('buy groceries')
  await page.getByRole('button', { name: 'Submit note' }).click()

  await expect(page.getByText('Manual note saved — agent dispatched to Needs sorting.')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => manualBody).toMatchObject({
    content: 'buy groceries',
    tags: ['Grocery'],
    submission_id: expect.any(String),
  })
  const capturedManualBody = manualBody as ManualBody | null
  expect(capturedManualBody?.category).toBeUndefined()
  expect(categorizeCalls).toBe(0)

  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { currentTask?: { destination: string; category: string } | null }> }
    }).__NOTELINGS_AGENTS__
    const assigned = Object.values(runtime?.agents ?? {}).find((agent) => agent.currentTask !== null)
    return assigned?.currentTask?.destination === 'corkboard' && assigned.currentTask.category === 'Manual'
  }, { timeout: 15_000, polling: 100 })
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
  // Phase 2: the board fetch returns the two notes as pending; status PATCHes
  // echo the requested status so the sync hook never touches the real DB.
  const notesMock = (route: { request: () => { method: () => string; postDataJSON: () => unknown } ; fulfill: (options: { json?: unknown }) => Promise<void> }) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: [
          { id: 'note-e2e-work', content: 'plan the Q3 roadmap', category: 'Work', tags: ['roadmap'], status: 'pending', created_at: '2026-08-09T00:00:00Z' },
          { id: 'note-e2e-admin', content: 'print the vendor contracts', category: 'Admin', tags: ['print'], status: 'pending', created_at: '2026-08-09T00:00:01Z' },
        ],
      })
    } else if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { status?: string }
      route.fulfill({
        json: { id: 'mock', content: 'mock', category: 'Work', tags: [], status: body.status ?? 'pending', created_at: '2026-08-09T00:00:00Z' },
      })
    } else {
      route.fulfill({ json: { ok: true } })
    }
  }
  await page.route('**/api/notes', notesMock)
  await page.route('**/api/notes/**', notesMock)

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()
  const input = page.getByRole('textbox', { name: 'Type a new note' })
  const submit = page.getByRole('button', { name: 'Submit note' })

  // The mocked notes land on the Spatial Board in Pending.
  await expect(page.getByText('plan the Q3 roadmap', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('print the vendor contracts', { exact: true })).toBeVisible()

  await input.fill('plan the Q3 roadmap')
  await submit.click()
  await expect(page.getByText(/Note saved as Work and agent dispatched!/)).toBeVisible({ timeout: 15_000 })

  await input.fill('print the vendor contracts')
  await submit.click()
  await expect(page.getByText(/Note saved as Admin and agent dispatched!/)).toBeVisible({ timeout: 15_000 })

  try {
    await page.waitForFunction(() => {
      const runtime = (window as unknown as {
        __NOTELINGS_AGENTS__?: { taskQueueLength: number; agents: Record<string, { status: string; currentTask?: { destination: string; content: string } | null }> }
      }).__NOTELINGS_AGENTS__
      if (!runtime) return false
      const assigned = Object.values(runtime.agents).filter((agent) => agent.currentTask !== null)
      return assigned.length === 2 && assigned.every((agent) => agent.status === 'walking' || agent.status === 'processing')
    }, { timeout: 15_000, polling: 100 })
  } catch (error) {
    const diagnostic = page.isClosed()
      ? 'page unavailable'
      : JSON.stringify(await page.evaluate(() => {
        const runtime = (window as unknown as { __NOTELINGS_AGENTS__?: unknown }).__NOTELINGS_AGENTS__
        return { runtime }
      }))
    throw new Error(`${String(error)}\\nM4 assignment diagnostic: ${diagnostic}`)
  }

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

  // Phase 2 terminal: the store logs the lifecycle as the robots work.
  const terminal = page.locator('[data-terminal-log]')
  await expect(terminal).toContainText(/Blue Agent dispatched: "plan the Q3 roadmap"/, { timeout: 20_000 })
  await expect(terminal).toContainText(/Blue Agent filed "plan the Q3 roadmap" in Work\./, { timeout: 60_000 })
  await expect(terminal).toContainText(/Green Agent filed "print the vendor contracts" in Admin\./, { timeout: 60_000 })

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
      // E2E fast mode uses a 250ms processing beat; production remains 2s.
      expect((agent.lastCompletedAt ?? 0) - (agent.processingStartedAt ?? 0)).toBeGreaterThanOrEqual(250)
    }
  }
  const arrivalTargets = await page.evaluate(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { lastArrivedTarget?: [number, number] | null }> }
    }).__NOTELINGS_AGENTS__
    return Object.values(runtime?.agents ?? {}).map((agent) => agent.lastArrivedTarget)
  })
  // New-office staging cells: whiteboard → Manager's Bookshelf (22,37),
  // printer → Filing Cabinets (34,4).
  expect(arrivalTargets).toEqual(expect.arrayContaining([[22, 37], [34, 4]]))
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
  // Deterministic empty board; the degraded note is local-only (no DB row).
  await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))

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
      // New-office staging: corkboard → Hallway Bookshelf (3,21).
      && Object.values(runtime.agents).some((agent) => (agent.lastArrivedTarget?.[0] ?? -1) === 3 && (agent.lastArrivedTarget?.[1] ?? -1) === 21))
  }, { timeout: 60_000, polling: 100 })
  // Even the degraded delivery ends with the completion confirmation once the
  // note physically reaches the corkboard (Blue is the first available agent).
  await expect(page.getByText(/Success: (Blue|Green) Agent filed your note in Uncategorized\./)).toBeVisible({ timeout: 30_000 })
  // The mocked 500 is deliberate in this test; any OTHER console/page error fails.
  expect(errors.filter((error) => !error.includes('status of 500'))).toEqual([])
})

test('Milestone 2 agentic archive: a robot carries the note to the trash', async ({ page }) => {
  // Two long SwiftShader walks (destination → trash) need a generous budget.
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.route('**/api/categorize', (route) =>
    route.fulfill({ json: { id: 'note-e2e-archive', category: 'Work', tags: ['old'], degraded: false } }),
  )
  await page.route('**/api/notes', (route) =>
    route.fulfill({
      json: [
        { id: 'note-e2e-archive', content: 'an old idea to retire', category: 'Work', tags: ['old'], status: 'filed', created_at: '2026-08-01T00:00:00Z' },
      ],
    }),
  )
  await page.route('**/api/notes/**', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { status?: string }
      route.fulfill({
        json: { id: 'note-e2e-archive', content: 'an old idea to retire', category: 'Work', tags: ['old'], status: body.status ?? 'filed', created_at: '2026-08-01T00:00:00Z' },
      })
    } else {
      route.fulfill({ json: { ok: true } })
    }
  })

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  // The mocked note sits in Filed with an Archive action.
  await expect(page.getByText('an old idea to retire', { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Archive note' }).click()

  // The store issues the two-leg archive task to the first available robot.
  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { currentTask?: { kind?: string; noteId?: string } | null; targetKind?: string | null }> }
    }).__NOTELINGS_AGENTS__
    return Boolean(runtime && runtime.agents.blue?.currentTask?.kind === 'archive')
  }, { timeout: 15_000, polling: 100 })

  // Leg 1: robot walks to the note's destination (Work whiteboard).
  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { targetKind?: string | null }> }
    }).__NOTELINGS_AGENTS__
    return runtime?.agents.blue?.targetKind === 'archive'
  }, { timeout: 30_000, polling: 100 })

  // Leg 2: after the pickup beat, the robot heads to the trash staging cell.
  await page.waitForFunction(() => {
    const runtime = (window as unknown as {
      __NOTELINGS_AGENTS__?: { agents: Record<string, { targetKind?: string | null }> }
    }).__NOTELINGS_AGENTS__
    return runtime?.agents.blue?.targetKind === 'archive-final'
  }, { timeout: 150_000, polling: 100 })

  // Disposal: archive toast + terminal line confirm the note reached the trash.
  await expect(page.getByText(/Note archived — (Blue|Green) Agent filed it in the trash\./)).toBeVisible({ timeout: 90_000 })
  const terminal = page.locator('[data-terminal-log]')
  await expect(terminal).toContainText(/archived "an old idea to retire"/, { timeout: 30_000 })

  expect(errors).toEqual([])
})
