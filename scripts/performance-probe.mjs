import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)

function valueFor(flag, fallback) {
  const index = args.indexOf(flag)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

function numberFor(flag, fallback) {
  const value = Number(valueFor(flag, String(fallback)))
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${flag}: ${value}`)
  return value
}

const label = valueFor('--label', '')
if (!label) throw new Error('--label is required')

const url = valueFor('--url', 'http://localhost:3000')
const deviceScaleFactor = numberFor('--device-scale-factor', 1)
const durationMs = numberFor('--duration-ms', 5000)
const viewportText = valueFor('--viewport', '1440x900')
const viewportMatch = /^(\d+)x(\d+)$/.exec(viewportText)
if (!viewportMatch) throw new Error(`Invalid --viewport: ${viewportText}`)
const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) }
const headed = args.includes('--headed')
const outputDir = path.resolve('docs/.performance-artifacts')
const outputBase = path.join(outputDir, label)

await fs.mkdir(outputDir, { recursive: true })

const errors = []
const browser = await chromium.launch({
  headless: !headed,
  args: headed ? [] : ['--use-gl=angle', '--use-angle=swiftshader'],
})
const context = await browser.newContext({ viewport, deviceScaleFactor })
const page = await context.newPage()
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`page: ${String(error)}`))

const navigationStartedAt = performance.now()
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 })
await page.waitForFunction(() => {
  const scene = globalThis.__NOTELINGS_SCENE__
  if (!scene) return false
  let meshCount = 0
  scene.traverse((object) => {
    if (object.isMesh) meshCount += 1
  })
  return meshCount > 100
}, undefined, { timeout: 90_000, polling: 250 })
const sceneReadyMs = performance.now() - navigationStartedAt

const metrics = await page.evaluate(async (sampleDurationMs) => {
  const renderer = globalThis.__NOTELINGS_RENDERER__
  const scene = globalThis.__NOTELINGS_SCENE__
  const canvas = document.querySelector('canvas')
  if (!renderer || !scene || !canvas) throw new Error('Notelings render handles are unavailable')

  const frameIntervals = []
  const callsPerFrame = []
  const trianglesPerFrame = []
  const startedAt = performance.now()
  let previousFrameAt = null
  const previousAutoReset = renderer.info.autoReset
  renderer.info.autoReset = false
  renderer.info.reset()
  await new Promise((resolve) => {
    const sample = (now) => {
      if (previousFrameAt !== null) {
        frameIntervals.push(now - previousFrameAt)
        callsPerFrame.push(renderer.info.render.calls)
        trianglesPerFrame.push(renderer.info.render.triangles)
        renderer.info.reset()
      }
      previousFrameAt = now
      if (now - startedAt >= sampleDurationMs) resolve()
      else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  renderer.info.autoReset = previousAutoReset

  const sortedIntervals = [...frameIntervals].sort((a, b) => a - b)
  const percentile = (items, ratio) => items[Math.min(items.length - 1, Math.floor(items.length * ratio))] ?? 0
  const average = (items) => items.length > 0 ? items.reduce((sum, item) => sum + item, 0) / items.length : 0
  const elapsedMs = frameIntervals.reduce((sum, interval) => sum + interval, 0)
  const info = renderer.info
  const rect = canvas.getBoundingClientRect()
  let meshCount = 0
  let shadowCasters = 0
  let triangleCount = 0
  scene.traverse((object) => {
    if (!object.isMesh) return
    meshCount += 1
    if (object.castShadow) shadowCasters += 1
    const position = object.geometry?.attributes?.position
    if (!position) return
    triangleCount += object.geometry.index ? object.geometry.index.count / 3 : position.count / 3
  })

  return {
    canvas: {
      cssWidth: Math.round(rect.width),
      cssHeight: Math.round(rect.height),
      width: canvas.width,
      height: canvas.height,
    },
    renderer: {
      pixelRatio: renderer.getPixelRatio(),
      fps: elapsedMs > 0 ? frameIntervals.length / (elapsedMs / 1000) : 0,
      p95FrameMs: percentile(sortedIntervals, 0.95),
      framesOver16_7ms: frameIntervals.filter((interval) => interval > 16.7).length,
      frameCount: frameIntervals.length,
      callsPerFrame: average(callsPerFrame),
      trianglesPerFrame: average(trianglesPerFrame),
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    },
    profile: globalThis.__NOTELINGS_RENDER_PROFILE__ ?? null,
    scene: {
      meshes: meshCount,
      shadowCasters,
      triangles: Math.round(triangleCount),
    },
  }
}, durationMs)

await page.screenshot({ path: `${outputBase}-full.png`, fullPage: true, animations: 'disabled' })
await page.locator('canvas').screenshot({ path: `${outputBase}-canvas.png`, animations: 'disabled' })

const result = {
  label,
  url,
  viewport: { ...viewport, deviceScaleFactor },
  sceneReadyMs: Math.round(sceneReadyMs),
  errors,
  ...metrics,
}
await fs.writeFile(`${outputBase}.json`, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
await browser.close()
