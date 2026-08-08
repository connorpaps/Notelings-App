import { test, expect } from '@playwright/test'
import { LOCKED_DEFAULT_ITEMS } from '../components/office/officeBuilderDefault'

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
