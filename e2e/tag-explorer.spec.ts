import { test, expect } from '@playwright/test'

test('Milestone 3 tag explorer: unique tags from Supabase filter a masonry note grid', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  // Unique tag list from the server route (service role)…
  await page.route('**/api/tags', (route) =>
    route.fulfill({ json: { tags: ['budget', 'roadmap'] } }),
  )
  // …and the store mirror (what the masonry grid filters) via the notes fetch.
  await page.route('**/api/notes', (route) =>
    route.fulfill({
      json: [
        { id: 'note-tag-1', content: 'plan the Q3 roadmap', category: 'Work', tags: ['roadmap'], status: 'filed', created_at: '2026-08-01T00:00:00Z' },
        { id: 'note-tag-2', content: 'budget the launch party', category: 'Admin', tags: ['budget'], status: 'filed', created_at: '2026-08-01T00:00:01Z' },
      ],
    }),
  )
  await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Initialize Agents' }).click()

  await page.getByRole('button', { name: 'Explore tags' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tag Explorer' })
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByRole('button', { name: /#roadmap/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /#budget/ })).toBeVisible()

  // Clicking a tag shows the masonry grid of matching notes from the store.
  await dialog.getByRole('button', { name: /#roadmap/ }).click()
  await expect(dialog.getByText('plan the Q3 roadmap', { exact: true })).toBeVisible()
  await expect(dialog.getByText('budget the launch party', { exact: true })).toHaveCount(0)

  // 'All tags' deselects and hides the grid again.
  await dialog.getByRole('button', { name: 'All tags' }).click()
  await expect(dialog.getByText('plan the Q3 roadmap', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(dialog).toHaveCount(0)

  expect(errors).toEqual([])
})
