import { expect, test } from '@playwright/test'

test('demo path keeps browser API traffic inside the demo namespace', async ({ page }) => {
  const apiPaths: string[] = []
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.includes('/api')) apiPaths.push(pathname)
  })

  await page.route('**/demo/api/notes', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    return route.fulfill({
      json: { id: 'demo-e2e-note', category: 'Manual', tags: ['demo'], degraded: false },
    })
  })
  await page.route('**/demo/api/notes/**', (route) => route.fulfill({ json: { ok: true } }))
  await page.route('**/demo/api/tags', (route) => route.fulfill({ json: { tags: [] } }))

  await page.goto('/demo')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()
  await page.getByRole('button', { name: 'Turn AI off for manual capture' }).click()
  await page.getByLabel('Manual tags (optional)').fill('demo')
  await page.getByRole('textbox', { name: 'Type a new note' }).fill('unified demo path note')
  await page.getByRole('button', { name: 'Submit note' }).click()
  await expect(page.getByText('Manual note saved — agent dispatched to Needs sorting.', { exact: true })).toBeVisible({ timeout: 15_000 })

  expect(apiPaths.some((path) => path === '/demo/api/notes')).toBe(true)
  expect(apiPaths.filter((path) => path.startsWith('/api/'))).toEqual([])
})

test('root and demo preserve the same office visual contract', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))

  await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))
  await page.route('**/demo/api/notes', (route) => route.fulfill({ json: [] }))
  await page.route('**/demo/api/notes/**', (route) => route.fulfill({ json: [] }))

  const captures: Record<string, {
    camera: unknown
    renderProfile: unknown
    canvas: { width: number; height: number; cssWidth: number; cssHeight: number }
    officeMeshCount: number
    cornerAlpha: number
  }> = {}

  for (const path of ['/', '/demo']) {
    await page.goto(path)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
    await page.waitForFunction(() => {
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: { traverse?: (visit: (object: { isMesh?: boolean }) => void) => void } }).__NOTELINGS_SCENE__
      if (!scene?.traverse) return false
      let meshCount = 0
      scene.traverse((object) => {
        if (object.isMesh) meshCount += 1
      })
      return meshCount > 100
    }, undefined, { timeout: 60_000, polling: 250 })
    await page.getByRole('button', { name: 'Initialize Agents' }).click()

    captures[path] = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const rect = canvas?.getBoundingClientRect()
      const renderer = (window as unknown as {
        __NOTELINGS_RENDERER__?: { getContext?: () => WebGLRenderingContext }
      }).__NOTELINGS_RENDERER__
      const gl = renderer?.getContext?.()
      const pixel = new Uint8Array(4)
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: { traverse?: (visit: (object: { isMesh?: boolean }) => void) => void } }).__NOTELINGS_SCENE__
      let officeMeshCount = 0
      scene?.traverse?.((object) => {
        if (object.isMesh) officeMeshCount += 1
      })
      return {
        camera: (window as unknown as { __NOTELINGS_CAMERA_PROFILE__?: unknown }).__NOTELINGS_CAMERA_PROFILE__,
        renderProfile: (window as unknown as { __NOTELINGS_RENDER_PROFILE__?: unknown }).__NOTELINGS_RENDER_PROFILE__,
        canvas: {
          width: canvas?.width ?? -1,
          height: canvas?.height ?? -1,
          cssWidth: Math.round(rect?.width ?? 0),
          cssHeight: Math.round(rect?.height ?? 0),
        },
        officeMeshCount,
        cornerAlpha: pixel[3],
      }
    })
    await page.screenshot({ path: `test-results/unified-${path === '/' ? 'root' : 'demo'}-desktop.png`, fullPage: true, animations: 'disabled' })
  }

  expect(captures['/'].camera).toEqual(captures['/demo'].camera)
  expect(captures['/'].renderProfile).toEqual(captures['/demo'].renderProfile)
  expect(captures['/'].canvas).toEqual(captures['/demo'].canvas)
  expect(captures['/'].officeMeshCount).toBeGreaterThan(100)
  expect(captures['/demo'].officeMeshCount).toBe(captures['/'].officeMeshCount)
  expect(captures['/'].cornerAlpha).toBe(0)
  expect(captures['/demo'].cornerAlpha).toBe(0)
  expect(errors).toEqual([])
})
