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

  const expected = PLACEMENTS.map((p) => p.id)

  // Poll until every placement group is mounted with at least one mesh (the
  // OBJ/MTL loaders hydrate each Suspense node asynchronously). The mesh check
  // also catches the shared-URL-useLoader trap: a cached object reparented
  // under a second <primitive> disappears from the first (three.js single-
  // parent rule), leaving the group mounted but empty.
  // Poll until every expected placement group is mounted AND holds >=1 mesh
  await page.waitForFunction(
    (ids) => {
      type Obj = { name?: string; type?: string; children?: Obj[]; isMesh?: boolean }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const countMeshes = (o: Obj): number => {
        let n = o.isMesh ? 1 : 0
        for (const c of o.children ?? []) n += countMeshes(c)
        return n
      }
      const findGroup = (o: Obj, name: string): Obj | undefined => {
        if (o.name === name && o.type === 'Group') return o
        for (const c of o.children ?? []) {
          const hit = findGroup(c, name)
          if (hit) return hit
        }
        return undefined
      }
      return ids.every((id) => {
        const g = findGroup(scene, id)
        return !!g && countMeshes(g) > 0
      })
    },
    expected,
    { timeout: 30_000, polling: 500 },
  )

  // Final audit for a precise failure message if the poll ever times out
  const audit = await page.evaluate(() => {
    type Obj = { name?: string; type?: string; children?: Obj[]; isMesh?: boolean }
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
    if (!scene) return null
    const perGroup = new Map<string, number>()
    const walk = (obj: Obj) => {
      if (obj.name && obj.type === 'Group') perGroup.set(obj.name, 0)
      obj.children?.forEach((c) => walk(c))
    }
    const countMeshes = (obj: Obj): number => {
      let n = obj.isMesh ? 1 : 0
      obj.children?.forEach((c) => (n += countMeshes(c)))
      return n
    }
    walk(scene)
    const findGroup = (o: Obj, name: string): Obj | undefined => {
      if (o.name === name && o.type === 'Group') return o
      for (const c of o.children ?? []) {
        const hit = findGroup(c, name)
        if (hit) return hit
      }
      return undefined
    }
    for (const [name] of perGroup) {
      const g = findGroup(scene, name)
      if (g) perGroup.set(name, countMeshes(g))
    }
    return Object.fromEntries(perGroup)
  })

  expect(audit, 'scene handle missing').not.toBeNull()
  const missing = expected.filter((id) => !(id in (audit as Record<string, number>)))
  expect(missing, `models never mounted: ${missing.join(', ')}`).toEqual([])
  const empty = expected.filter((id) => (audit as Record<string, number>)[id] === 0)
  expect(empty, `mounted but with zero meshes: ${empty.join(', ')}`).toEqual([])

  // No console or page errors (three.js deprecation warnings are fine — they
  // surface as 'warning' type, not 'error')
  expect(errors).toEqual([])

  // Screenshot must contain actual rendered content, not a blank canvas
  // (blank captures were ~8.5KB; a real scene is ~100KB+)
  await page.screenshot({ path: 'test-results/office-m1.png', fullPage: true })
  const fs = await import('node:fs')
  const shot = fs.readFileSync('test-results/office-m1.png')
  expect(shot.length, 'screenshot looks blank').toBeGreaterThan(50_000)
})
