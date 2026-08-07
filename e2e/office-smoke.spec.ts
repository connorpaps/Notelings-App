import { test, expect } from '@playwright/test'
import { PLACEMENTS } from '../components/office/officeLayout'

test('3D office renders with every model mounted and zero errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Give the OBJ/MTL loaders time to hydrate every Suspense node
  await page.waitForTimeout(8_000)

  // Scene-graph audit: every named placement group must be mounted
  const mounted = await page.evaluate(() => {
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: { children?: Array<{ name?: string; type?: string; children?: unknown[] }> } }).__NOTELINGS_SCENE__
    if (!scene) return []
    const names: string[] = []
    const walk = (obj: { name?: string; type?: string; children?: unknown[] }) => {
      if (obj.name && obj.type === 'Group') names.push(obj.name)
      obj.children?.forEach((c) => walk(c as Parameters<typeof walk>[0]))
    }
    walk(scene)
    return names
  })

  const expected = PLACEMENTS.map((p) => p.id)
  const missing = expected.filter((id) => !mounted.includes(id))
  expect(missing, `models never mounted: ${missing.join(', ')}`).toEqual([])

  // No console or page errors (three.js deprecation warnings are fine — they
  // surface as 'warning' type, not 'error')
  expect(errors).toEqual([])

  await page.screenshot({ path: 'test-results/office-m1.png', fullPage: true })
})
