import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Fixture: 4 active notes + 1 archived (must be excluded). Expected graph:
// 4 tag hubs (react, hooks, finance, roadmap) + 4 note nodes = 8 nodes,
// links = 2 (g1) + 2 (g2) + 1 (g3) + 0 (g5) = 5 links.
const NOTES = [
  { id: 'note-g1', content: 'learn react hooks', category: 'Work', tags: ['react', 'hooks'], status: 'filed', created_at: '2026-08-02T00:00:00Z' },
  { id: 'note-g2', content: 'budget Q3 launch', category: 'Admin', tags: ['finance', 'roadmap'], status: 'filed', created_at: '2026-08-01T00:00:00Z' },
  { id: 'note-g3', content: 'roadmap retro', category: 'Work', tags: ['roadmap'], status: 'pending', created_at: '2026-08-01T01:00:00Z' },
  { id: 'note-g4', content: 'archived thing', category: 'Uncategorized', tags: ['old'], status: 'archived', created_at: '2026-08-01T02:00:00Z' },
  { id: 'note-g5', content: 'untagged lonely', category: 'Admin', tags: [], status: 'filed', created_at: '2026-08-01T03:00:00Z' },
]

// A clickable note dot: on-screen, clear of the header and of the right
// side-peek rail, so the mouse click lands on the canvas node. Polls until
// the canvas has mounted and the frozen layout has been drawn at least once
// (positions are snapshotted inside the node renderer).
async function pickNoteNode(page: Page): Promise<{ x: number; y: number }> {
  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    const screen = await page.evaluate(() => {
      const handle = (window as unknown as { __NOTELINGS_GRAPH__?: { nodePositions(): Array<{ id: string; x: number; y: number }>; nodeScreenPosition(id: string): { x: number; y: number } | null } }).__NOTELINGS_GRAPH__
      const positions = handle?.nodePositions() ?? []
      const width = window.innerWidth
      // Prefer a note dot with no other node within ~24px (a tag label could
      // otherwise sit on top of the click target).
      const candidates = positions.filter((n) => n.id.startsWith('note:'))
      for (const note of candidates) {
        const s = handle!.nodeScreenPosition(note.id)
        if (!s) continue
        if (s.x > width - 430 || s.y < 90) continue
        const crowded = positions.some((other) => {
          if (other.id === note.id) return false
          const o = handle!.nodeScreenPosition(other.id)
          return o ? Math.hypot(o.x - s.x, o.y - s.y) < 24 : false
        })
        if (!crowded) return { x: s.x, y: s.y }
      }
      return null
    })
    if (screen) return screen
    await page.waitForTimeout(500)
  }
  throw new Error('no clickable note node within 25s')
}

test('Milestone 5 knowledge graph: bipartite hubs, frozen layout, side-peek edit + archive', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  let patchRequests = 0
  await page.route('**/api/notes', (route) => route.fulfill({ json: NOTES }))
  // The side-peek PATCH echoes the updated note back (server contract).
  await page.route('**/api/notes/**', (route) => {
    if (route.request().method() === 'PATCH') {
      patchRequests += 1
      route.fulfill({
        json: {
          id: 'note-g1',
          content: 'learn react hooks',
          category: 'Work',
          tags: ['react', 'hooks', 'redux'],
          status: 'filed',
          created_at: '2026-08-02T00:00:00Z',
          updated_at: '2026-08-02T01:00:00Z',
        },
      })
      return
    }
    route.fulfill({ json: [] })
  })

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  // Open via the dock button (second entry point: header 'Graph' button).
  await page.getByRole('button', { name: 'Open knowledge graph' }).click()
  const overlay = page.getByRole('dialog', { name: 'Knowledge graph' })
  await expect(overlay).toBeVisible({ timeout: 15_000 })

  // Bipartite counts: archived note excluded; 4 hubs + 4 satellites; 5 edges.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = (window as unknown as { __NOTELINGS_GRAPH__?: { nodeCount: number; linkCount: number } }).__NOTELINGS_GRAPH__
          return g ? { n: g.nodeCount, l: g.linkCount } : { n: 0, l: 0 }
        }),
      { timeout: 20_000 },
    )
    .toEqual({ n: 8, l: 5 })

  // Wait until the canvas has mounted and drawn the settled layout at least
  // once (positions are snapshotted inside the node renderer).
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { __NOTELINGS_GRAPH__?: { nodePositions(): Array<{ id: string; x: number; y: number }> } }).__NOTELINGS_GRAPH__?.nodePositions().length ?? 0),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0)

  // The layout is FROZEN: two samples 700ms apart are identical (the d3-force
  // simulation ran its warmupTicks and stopped — zero background CPU).
  const sample = () => page.evaluate(() => (window as unknown as { __NOTELINGS_GRAPH__?: { nodePositions(): Array<{ id: string; x: number; y: number }> } }).__NOTELINGS_GRAPH__?.nodePositions() ?? [])
  const before = await sample()
  await page.waitForTimeout(700)
  const after = await sample()
  expect(after).toEqual(before)

  // Click a note dot → the side-peek slides open (read view).
  const target = await pickNoteNode(page)
  await page.mouse.click(target.x, target.y)
  const panel = page.getByRole('dialog', { name: 'Note side panel' })
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByText('learn react hooks', { exact: true })).toBeVisible()

  // Edit tags in the panel → the graph recomputes (new 'redux' hub, +1 edge).
  await panel.getByRole('button', { name: 'Edit' }).click()
  await panel.getByLabel('Tags (comma separated)').fill('react, hooks, redux')
  await panel.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => patchRequests).toBe(1)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = (window as unknown as { __NOTELINGS_GRAPH__?: { nodeCount: number; linkCount: number } }).__NOTELINGS_GRAPH__
          return g ? { n: g.nodeCount, l: g.linkCount } : { n: 0, l: 0 }
        }),
      { timeout: 10_000 },
    )
    .toEqual({ n: 9, l: 6 })
  await expect(page.locator('[data-sonner-toast] [data-title]', { hasText: 'Note updated.' })).toBeVisible()

  // Archive from the panel → agentic walk request + panel closes; the graph
  // itself is left running (the full robot walk is covered by the office spec).
  await panel.getByRole('button', { name: 'Archive' }).click()
  await expect(page.locator('[data-sonner-toast] [data-title]', { hasText: 'Archiving…' })).toBeVisible({ timeout: 10_000 })
  await expect(panel).toHaveCount(0)

  // Escape closes the overlay.
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)

  expect(errors).toEqual([])
})
