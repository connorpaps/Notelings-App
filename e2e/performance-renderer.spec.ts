import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type SceneHandle = {
  children?: SceneHandle[]
  isMesh?: boolean
  name?: string
}

const label = process.env.PERF_LABEL ?? 'capture'
const outputDir = path.resolve('docs/.performance-artifacts')

function outputPath(name: string) {
  fs.mkdirSync(outputDir, { recursive: true })
  return path.join(outputDir, `${label}-${name}.png`)
}

async function waitForOffice(page: Page) {
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 })
  await page.waitForFunction(() => {
    const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneHandle }).__NOTELINGS_SCENE__
    if (!scene) return false
    let meshCount = 0
    const visit = (node: SceneHandle) => {
      if (node.isMesh) meshCount += 1
      for (const child of node.children ?? []) visit(child)
    }
    visit(scene)
    return meshCount > 100
  }, undefined, { timeout: 90_000, polling: 250 })
}

async function capturePage(page: Page, name: string) {
  await page.screenshot({ path: outputPath(`${name}-full`), fullPage: true, animations: 'disabled' })
  await page.locator('canvas').screenshot({ path: outputPath(`${name}-canvas`), animations: 'disabled' })
}

async function assertRendererContract(page: Page) {
  const expectedQuality = process.env.NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY ?? 'high'
  const audit = await page.evaluate(() => {
    const renderer = (window as unknown as {
      __NOTELINGS_RENDERER__?: { getPixelRatio?: () => number }
    }).__NOTELINGS_RENDERER__
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      pixelRatio: renderer?.getPixelRatio?.() ?? -1,
      canvas: {
        width: canvas?.width ?? -1,
        height: canvas?.height ?? -1,
        cssWidth: Math.round(rect?.width ?? 0),
        cssHeight: Math.round(rect?.height ?? 0),
      },
      profile: (window as unknown as { __NOTELINGS_RENDER_PROFILE__?: Record<string, unknown> }).__NOTELINGS_RENDER_PROFILE__,
    }
  })

  expect(audit.pixelRatio).toBe(1)
  expect(audit.canvas.width).toBeLessThanOrEqual(audit.canvas.cssWidth)
  expect(audit.canvas.height).toBeLessThanOrEqual(audit.canvas.cssHeight)
  expect(audit.profile).toMatchObject({
    quality: expectedQuality,
    dpr: 1,
    frameloop: 'always',
    shadows: true,
    postprocessing: true,
    toneMappingExposure: 1.2,
    bloom: { luminanceThreshold: 1, intensity: 0.2 },
  })
  if (expectedQuality === 'balanced') {
    expect(audit.profile).toMatchObject({
      shadowMapSize: [2048, 2048],
      shadowCascade: 14,
      ssao: { samples: 16, rings: 2 },
    })
  } else {
    expect(audit.profile).toMatchObject({
      shadowMapSize: [4096, 4096],
      shadowCascade: 30,
      ssao: { samples: 32, rings: 4 },
    })
  }
}

test.describe('renderer visual capture', () => {
  test('captures initialized desktop office', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))
    await page.goto('/')
    await waitForOffice(page)
    await page.getByRole('button', { name: 'Initialize Agents' }).click()
    await expect(page.getByRole('textbox', { name: 'Type a new note' })).toBeVisible()
    await assertRendererContract(page)
    await capturePage(page, 'desktop-idle')
    expect(errors).toEqual([])
  })

  test('caps the WebGL backbuffer on a DPR-2 desktop context', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://localhost:3000',
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))
    await page.goto('/')
    await waitForOffice(page)
    await assertRendererContract(page)
    expect(errors).toEqual([])
    await context.close()
  })

  test('captures active note delivery', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route('**/api/categorize', (route) => route.fulfill({
      json: { id: 'perf-note', category: 'Work', tags: ['performance'], degraded: false },
    }))
    await page.route('**/api/notes', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] })
      return route.fulfill({ json: { id: 'perf-note', category: 'Work', tags: ['performance'], status: 'pending' } })
    })
    await page.route('**/api/notes/**', (route) => route.fulfill({ json: { ok: true } }))
    await page.goto('/')
    await waitForOffice(page)
    await page.getByRole('button', { name: 'Initialize Agents' }).click()
    const input = page.getByRole('textbox', { name: 'Type a new note' })
    await input.fill('measure the office performance')
    await page.getByRole('button', { name: 'Submit note' }).click()
    await page.waitForFunction(() => {
      const runtime = (window as unknown as {
        __NOTELINGS_AGENTS__?: { agents: Record<string, { status: string; currentTask: unknown }> }
      }).__NOTELINGS_AGENTS__
      return Object.values(runtime?.agents ?? {}).some((agent) =>
        agent.currentTask !== null && (agent.status === 'walking' || agent.status === 'processing'),
      )
    }, undefined, { timeout: 15_000, polling: 100 })
    await capturePage(page, 'desktop-delivery')
    expect(errors).toEqual([])
  })

  test('captures initialized mobile office', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route('**/api/notes', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/notes/**', (route) => route.fulfill({ json: [] }))
    await page.goto('/')
    await waitForOffice(page)
    await page.getByRole('button', { name: 'Initialize Agents' }).click()
    await assertRendererContract(page)
    await capturePage(page, 'mobile-idle')
    expect(errors).toEqual([])
    await context.close()
  })
})
