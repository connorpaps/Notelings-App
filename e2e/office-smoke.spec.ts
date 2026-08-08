import { test, expect, type Page } from '@playwright/test'
import { LOCKED_DEFAULT_ITEMS } from '../components/office/officeBuilderDefault'
import { findPath, gridCellToWorld, type GridCell } from '../components/office/pathfinding'
import { AGENT_GRID_TRANSFORM, buildAgentBlockedCells } from '../components/office/agentGrid'

const EXPECTED_IDS = LOCKED_DEFAULT_ITEMS.map((item) => item.id)
const MODEL_IDS = LOCKED_DEFAULT_ITEMS.filter((item) => item.kind === 'model').map((item) => item.id)

test('static office diorama renders with locked camera and persists no builder state', async ({ page }) => {
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

  await page.waitForFunction(
    (ids) => {
      type Obj = { name?: string; children?: Obj[]; isMesh?: boolean }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const find = (root: Obj, name: string): Obj | undefined => {
        if (root.name === name) return root
        for (const child of root.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const meshCount = (root: Obj): number =>
        (root.isMesh ? 1 : 0) + (root.children ?? []).reduce((count, child) => count + meshCount(child), 0)
      return ids.every((id) => {
        const item = find(scene, id)
        return Boolean(item && meshCount(item) > 0)
      })
    },
    EXPECTED_IDS,
    { timeout: 60_000, polling: 500 },
  )

  const audit = await page.evaluate((expectedIds) => {
    type SceneObject = {
      name?: string
      children?: SceneObject[]
      castShadow?: boolean
      intensity?: number
      shadow?: {
        mapSize?: { x?: number; y?: number }
        camera?: { left?: number; right?: number; top?: number; bottom?: number }
      }
    }
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
    const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
      if (root?.name === name) return root
      for (const child of root?.children ?? []) {
        const match = find(child, name)
        if (match) return match
      }
      return undefined
    }
    const importedModelMeshesConfigured = expectedIds.every((id) => {
      const root = find(scene, id)
      if (!root) return false
      const meshes: SceneObject[] = []
      const collectMeshes = (node: SceneObject) => {
        if ((node as SceneObject & { isMesh?: boolean }).isMesh) meshes.push(node)
        for (const child of node.children ?? []) collectMeshes(child)
      }
      collectMeshes(root)
      return meshes.length > 0 && meshes.every((mesh) => {
        const materials = Array.isArray((mesh as SceneObject & { material?: unknown }).material)
          ? (mesh as SceneObject & { material: Array<{ type?: string; userData?: { notelingsLightingConfigured?: boolean; notelingsHasMap?: boolean } }> }).material
          : [(mesh as SceneObject & { material?: { type?: string; userData?: { notelingsLightingConfigured?: boolean; notelingsHasMap?: boolean } } }).material]
        return Boolean(
          (mesh as SceneObject & { castShadow?: boolean; receiveShadow?: boolean }).castShadow &&
          (mesh as SceneObject & { castShadow?: boolean; receiveShadow?: boolean }).receiveShadow &&
          materials.every((material) => material && material.type !== 'MeshBasicMaterial' && material.userData?.notelingsLightingConfigured && material.userData?.notelingsHasMap),
        )
      })
    })
    const renderer = (window as unknown as {
      __NOTELINGS_RENDERER__?: { toneMapping?: number; toneMappingExposure?: number; getPixelRatio?: () => number }
    }).__NOTELINGS_RENDERER__
    const camera = (window as unknown as {
      __NOTELINGS_CAMERA__?: {
        position?: { x?: number; y?: number; z?: number }
        zoom?: number
        near?: number
        far?: number
        quaternion?: { x?: number; y?: number; z?: number; w?: number }
      }
    }).__NOTELINGS_CAMERA__
    const cameraProfile = (window as unknown as {
      __NOTELINGS_CAMERA_PROFILE__?: {
        position?: [number, number, number]
        target?: [number, number, number]
        zoom?: number
        near?: number
        far?: number
        controls?: boolean
        frameloop?: 'demand'
      }
    }).__NOTELINGS_CAMERA_PROFILE__
    const renderProfile = (window as unknown as {
      __NOTELINGS_RENDER_PROFILE__?: {
        frameloop?: 'demand'
        shadows?: boolean
        shadowMapSize?: [number, number]
        postprocessing?: boolean
        toneMappingMode?: number | null
        toneMappingExposure?: number
        bloom?: { luminanceThreshold?: number; intensity?: number }
        ssao?: { samples?: number; rings?: number; intensity?: number }
      }
    }).__NOTELINGS_RENDER_PROFILE__
    return {
      lockedScenePresent: Boolean(find(scene, 'locked-office-scene')),
      builderScenePresent: Boolean(find(scene, 'office-builder-scene')),
      transformControlsPresent: Boolean(find(scene, 'TransformControls')),
      importedModelMeshesConfigured,
      rendererToneMappingDuringComposer: renderer?.toneMapping ?? -1,
      rendererToneMappingExposure: renderer?.toneMappingExposure ?? -1,
      ambientIntensity: find(scene, 'office-ambient')?.intensity ?? -1,
      keyIntensity: find(scene, 'office-key')?.intensity ?? -1,
      rendererPixelRatio: renderer?.getPixelRatio?.() ?? -1,
      actualCamera: {
        position: [camera?.position?.x ?? -1, camera?.position?.y ?? -1, camera?.position?.z ?? -1],
        zoom: camera?.zoom ?? -1,
        near: camera?.near ?? -1,
        far: camera?.far ?? -1,
        direction: (() => {
          const position = camera?.position
          const quaternion = camera?.quaternion
          if (!position || !quaternion) return [-1, -1, -1]
          const px = position.x ?? Number.NaN
          const py = position.y ?? Number.NaN
          const pz = position.z ?? Number.NaN
          const qx = quaternion.x ?? Number.NaN
          const qy = quaternion.y ?? Number.NaN
          const qz = quaternion.z ?? Number.NaN
          const qw = quaternion.w ?? Number.NaN
          const targetDirection = [0 - px, 1.5 - py, 0 - pz]
          const targetLength = Math.hypot(...targetDirection)
          const expected = targetDirection.map((value) => value / targetLength)
          const ix = qy * -1 - qz * 0
          const iy = qz * 0 - qx * -1
          const iz = qw * -1 + qx * 0 - qy * 0
          const iw = -qz * -1
          const actual = [
            ix * qw + iw * -qx + iy * -qz - iz * -qy,
            iy * qw + iw * -qy + iz * -qx - ix * -qz,
            iz * qw + iw * -qz + ix * -qy - iy * -qx,
          ]
          return actual.map((value, index) => Math.abs(value - expected[index]))
        })(),
      },
      cameraProfile,
      renderProfile,
      builderStorage: window.localStorage.getItem('notelings-office-builder-v4'),
      builderExportStorage: window.localStorage.getItem('notelings-office-builder-json-v1'),
      shadowEnabled: find(scene, 'office-key')?.castShadow ?? false,
      shadowMapSize: [find(scene, 'office-key')?.shadow?.mapSize?.x ?? -1, find(scene, 'office-key')?.shadow?.mapSize?.y ?? -1],
      shadowBounds: [
        find(scene, 'office-key')?.shadow?.camera?.left ?? 0,
        find(scene, 'office-key')?.shadow?.camera?.right ?? 0,
        find(scene, 'office-key')?.shadow?.camera?.top ?? 0,
        find(scene, 'office-key')?.shadow?.camera?.bottom ?? 0,
      ],
    }
  }, MODEL_IDS)

  expect(audit.lockedScenePresent).toBe(true)
  expect(audit.builderScenePresent).toBe(false)
  expect(audit.transformControlsPresent).toBe(false)
  expect(audit.importedModelMeshesConfigured).toBe(true)
  expect(audit.rendererPixelRatio).toEqual(expect.any(Number))
  expect(audit.shadowEnabled).toBe(true)
  expect(audit.ambientIntensity).toBe(0.5)
  expect(audit.keyIntensity).toBe(3)
  expect(audit.shadowMapSize).toEqual([4096, 4096])
  expect(audit.shadowBounds).toEqual([-30, 30, 30, -30])
  expect(audit.builderStorage).toBe('preexisting-builder-snapshot')
  expect(audit.builderExportStorage).toBe('preexisting-builder-export')
  expect(audit.actualCamera.position).toEqual([24, 22, 24])
  expect(audit.actualCamera.zoom).toBe(38)
  expect(audit.actualCamera.near).toBe(-100)
  expect(audit.actualCamera.far).toBe(300)
  expect(audit.actualCamera.direction.every((error: number) => error < 0.000001)).toBe(true)
  expect(audit.cameraProfile).toEqual({
    position: [24, 22, 24],
    target: [0, 1.5, 0],
    zoom: 38,
    near: -100,
    far: 300,
    controls: false,
    frameloop: 'demand',
  })
  expect(audit.renderProfile).toEqual({
    frameloop: 'demand',
    shadows: true,
    shadowMapSize: [4096, 4096],
    postprocessing: true,
    toneMappingMode: null,
    toneMappingExposure: 1.2,
    bloom: { luminanceThreshold: 1, intensity: 0.2 },
    ssao: { samples: 32, rings: 4, intensity: 2 },
  })
  expect(errors).toEqual([])

  await page.screenshot({ path: 'test-results/office-static-diorama.png', fullPage: true })

  // Regression coverage: browser refresh remounts the R3F tree and can expose
  // demand-mode effects that were not explicitly invalidated after material setup.
  await page.reload()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(
    (ids) => {
      type Obj = {
        name?: string
        children?: Obj[]
        isMesh?: boolean
        material?: { userData?: { notelingsHasMap?: boolean } } | Array<{ userData?: { notelingsHasMap?: boolean } }>
      }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const find = (root: Obj, name: string): Obj | undefined => {
        if (root.name === name) return root
        for (const child of root.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const allMeshesHaveMaps = (root: Obj): boolean => {
        if (root.isMesh) {
          const materials = Array.isArray(root.material) ? root.material : [root.material]
          if (!materials.length || materials.some((material) => !material?.userData?.notelingsHasMap)) return false
        }
        return (root.children ?? []).every(allMeshesHaveMaps)
      }
      return ids.every((id) => {
        const item = find(scene, id)
        return Boolean(item && allMeshesHaveMaps(item))
      })
    },
    MODEL_IDS,
    { timeout: 60_000, polling: 500 },
  )
  expect(errors).toEqual([])
})

/** Orthographic world → viewport pixels using the live camera matrix + zoom. */
async function worldToScreen(page: Page, x: number, y: number, z: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([wx, wy, wz]) => {
    const cam = (
      window as unknown as {
        __NOTELINGS_CAMERA__?: { matrixWorldInverse?: { elements: number[] }; zoom?: number }
      }
    ).__NOTELINGS_CAMERA__
    const canvas = document.querySelector('canvas')
    if (!cam?.matrixWorldInverse || !canvas) throw new Error('camera/canvas missing')
    const rect = canvas.getBoundingClientRect()
    const m = cam.matrixWorldInverse.elements
    const vx = m[0] * wx + m[4] * wy + m[8] * wz + m[12]
    const vy = m[1] * wx + m[5] * wy + m[9] * wz + m[13]
    const zoom = cam.zoom ?? 1
    const ndcX = vx / (rect.width / (2 * zoom))
    const ndcY = vy / (rect.height / (2 * zoom))
    return {
      x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
      y: rect.top + (1 - (ndcY * 0.5 + 0.5)) * rect.height,
    }
  }, [x, y, z])
}

/** True when consecutive path steps change direction (the robot must turn). */
function pathHasTurn(path: GridCell[]): boolean {
  if (path.length < 3) return false
  const step = (a: GridCell, b: GridCell): [number, number] => [b[0] - a[0], b[1] - a[1]]
  const first = step(path[0], path[1])
  for (let i = 2; i < path.length; i += 1) {
    const next = step(path[i - 1], path[i])
    if (next[0] !== first[0] || next[1] !== first[1]) return true
  }
  return false
}

/** A reachable free cell a few cells away from the robot start (deterministic).
 *  Ring search by Manhattan distance; prefers paths that contain a turn so the
 *  walk visibly exercises the heading rotation, not a straight slide. */
function pickTargetCell(start: GridCell, blocked: ReadonlySet<string>): GridCell {
  for (let d = 3; d <= 12; d += 1) {
    const turning: GridCell[] = []
    const straight: GridCell[] = []
    for (let dc = -d; dc <= d; dc += 1) {
      for (let dr = -d; dr <= d; dr += 1) {
        if (Math.abs(dc) + Math.abs(dr) !== d) continue
        const candidate: GridCell = [start[0] + dc, start[1] + dr]
        if (blocked.has(`${candidate[0]},${candidate[1]}`)) continue
        const path = findPath(start, candidate, { blocked })
        if (!path) continue
        ;(pathHasTurn(path) ? turning : straight).push(candidate)
      }
    }
    if (turning.length > 0) return turning[0]
    if (straight.length > 0) return straight[0]
  }
  throw new Error('no reachable free target near agent start')
}

test('agent robot renders flush with a live LCD face and click-to-move walks an A* path', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Robot exists with a capsule body + LCD face, sits FLUSH on the floor (the
  // capsule's geometry bottom touches y=0 exactly), and the idle face canvas
  // actually drew glyph pixels on a light screen (not blank/gray).
  await page.waitForFunction(
    () => {
      type Obj = {
        name?: string
        children?: Obj[]
        isMesh?: boolean
        position?: { x: number; y: number; z: number }
        geometry?: { type?: string; computeBoundingBox?: () => void; boundingBox?: { min?: { y?: number } } }
        material?: { map?: { image?: HTMLCanvasElement | undefined } }
      }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const find = (root: Obj, name: string): Obj | undefined => {
        if (root.name === name) return root
        for (const child of root.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const robot = find(scene, 'agent-robot')
      if (!robot) return false
      const capsule = (robot.children ?? []).find((c) => c.isMesh && c.geometry?.type === 'CapsuleGeometry')
      const face = (robot.children ?? []).find((c) => c.isMesh && c.geometry?.type === 'PlaneGeometry')
      const agent = (window as unknown as {
        __NOTELINGS_AGENT__?: { state?: string; startCell?: number[] }
      }).__NOTELINGS_AGENT__
      if (!capsule || !face || agent?.state !== 'idle' || !Array.isArray(agent?.startCell)) return false

      // Flush-y: robot group sits on the floor AND the capsule's bounding-box
      // bottom maps to world y=0 — not hovering, not sunk. (Geometry parameters
      // are version-dependent, so derive from the real computed bounding box.)
      const geo = capsule.geometry
      if (!geo) return false
      geo.computeBoundingBox?.()
      const bottomLocal = geo.boundingBox?.min?.y ?? 1
      // The capsule mesh carries only a y-offset (no rotation), so local→world
      // y is position.y + bounding-box min.
      const bottomWorld = (capsule.position?.y ?? 0) + bottomLocal
      if (Math.abs(robot.position?.y ?? 1) > 1e-6 || Math.abs(bottomWorld) > 1e-6) return false

      // The face material must carry a real 256px canvas texture.
      const canvas = face.material?.map?.image
      if (!canvas || canvas.width !== 256) return false

      // Rendered-pixel proof: glyphs are drawn INSIDE the screen area (outside
      // the dark bezel border): count dark pixels in the inner region.
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      const pad = Math.round(256 * 0.07)
      const { data } = ctx.getImageData(pad, pad, 256 - pad * 2, 256 - pad * 2)
      let dark = 0
      let light = 0
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (luma < 110) dark += 1
        else if (luma > 200) light += 1
      }
      return dark > 60 && light > dark
    },
    { timeout: 30_000, polling: 500 },
  )

  const startCell = await page.evaluate(
    () =>
      (window as unknown as { __NOTELINGS_AGENT__?: { startCell?: [number, number] } }).__NOTELINGS_AGENT__
        ?.startCell,
  )
  if (!startCell) throw new Error('agent start cell not exposed')

  // The blocked set must come from the SAME transform-aware computation the
  // scene uses, so the click target is truly free in the aligned grid.
  const blocked = buildAgentBlockedCells()
  const target = pickTargetCell(startCell, blocked)
  const [tx, tz] = gridCellToWorld(target, AGENT_GRID_TRANSFORM)
  const TOLERANCE = 0.15

  // Snapshot the idle face canvas so we can prove the expression swaps to
  // WALKING (O O) while moving, then back to IDLE (^ ^) on arrival.
  const faceSignature = async () =>
    page.evaluate(() => {
      type Obj = {
        name?: string
        children?: Obj[]
        isMesh?: boolean
        geometry?: { type?: string }
        material?: { map?: { image?: HTMLCanvasElement | undefined } }
      }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      const find = (root: Obj | undefined, name: string): Obj | undefined => {
        if (root?.name === name) return root
        for (const child of root?.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const face = find(scene, 'agent-robot')?.children?.find(
        (c) => c.isMesh && c.geometry?.type === 'PlaneGeometry',
      )
      const canvas = face?.material?.map?.image
      return canvas ? canvas.toDataURL() : ''
    })
  const idleSignature = await faceSignature()
  if (!idleSignature) throw new Error('idle face texture missing')

  // Click the target cell's projected screen position (up to 3 jitter retries
  // in case the ray is occluded by a no-handler object that swallows the hit).
  const { x, y } = await worldToScreen(page, tx, 0, tz)
  let walkingSignature = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.click(x + attempt * 10, y + attempt * 10)
    await page.waitForTimeout(400)
    const state = await page.evaluate(
      () => (window as unknown as { __NOTELINGS_AGENT__?: { state?: string } }).__NOTELINGS_AGENT__?.state,
    )
    if (state === 'walking') {
      walkingSignature = await faceSignature()
      break
    }
  }
  if (!walkingSignature) throw new Error('robot never entered walking state')

  // The LCD swapped to the WALKING expression while in motion.
  expect(walkingSignature).not.toBe(idleSignature)

  // Watch the whole walk at high frequency: the robot must TURN to face its
  // waypoints at least once (heading leaves 0 — pathHasTurn guarantees a turn
  // exists) and end up at the target cell before returning to idle.
  await page.evaluate(() => {
    ;(window as unknown as { __NOTELINGS_TURN_SEEN__?: boolean }).__NOTELINGS_TURN_SEEN__ = false
  })
  await page.waitForFunction(
    ({ tx, tz, tolerance }) => {
      type Obj = {
        name?: string
        children?: Obj[]
        rotation?: { y?: number }
        position?: { x: number; z: number }
      }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      const find = (root: Obj | undefined, name: string): Obj | undefined => {
        if (root?.name === name) return root
        for (const child of root?.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const robot = find(scene, 'agent-robot')
      const agent = (window as unknown as { __NOTELINGS_AGENT__?: { state?: string } }).__NOTELINGS_AGENT__
      const win = window as unknown as { __NOTELINGS_TURN_SEEN__?: boolean }
      // Accumulate: record the moment the robot ever turns away from heading 0.
      if (robot?.rotation && Math.abs(robot.rotation.y ?? 0) > 0.05) {
        win.__NOTELINGS_TURN_SEEN__ = true
      }
      if (!robot?.position || agent?.state !== 'idle') return false
      const atTarget =
        Math.abs(robot.position.x - tx) < tolerance && Math.abs(robot.position.z - tz) < tolerance
      return atTarget && Boolean(win.__NOTELINGS_TURN_SEEN__)
    },
    { tx, tz, tolerance: TOLERANCE },
    { timeout: 30_000, polling: 50 },
  )
  const arrivedSignature = await faceSignature()
  expect(arrivedSignature).toBe(idleSignature)

  expect(errors).toEqual([])
  await page.screenshot({ path: 'test-results/office-agent-walk.png', fullPage: true })
})
