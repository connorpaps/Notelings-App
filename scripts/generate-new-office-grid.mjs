/**
 * Generates components/office/newOfficeGridData.ts from the 3D Note Office GLB.
 *
 * Rasterizes wall/glass/furniture geometry (per-material y-bands) into the
 * 42×42 @ 0.25 m navigation grid, inflates by the robot body radius (0.30,
 * the full physical center clearance — the runtime sweep uses clearance 0),
 *
 * Run: node scripts/generate-new-office-grid.mjs
 * Regenerate whenever the GLB changes; commit the emitted file.
 *
 * Coordinate conventions (must match components/office/newOfficeLayout.ts and
 * pathfinding.ts):
 *   world = model - CX on x (CX = -5.041) and model - CZ on z (CZ = 4.9383)
 *   cell center c -> world x = (c - 21) * 0.25   (gridCellToWorld)
 *   world x -> cell c = round(x / 0.25 + 21)     (worldToGridCell, anchors)
 *   cell c covers world [0.25c - 5.375, 0.25c - 5.125)  (raster coverage)
 */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// --- Node shims for GLTFLoader's browser-only image path (geometry only) ---
globalThis.self = globalThis
class FakeImage {
  constructor() {
    this.width = 1
    this.height = 1
    this._src = ''
  }
  set src(v) {
    this._src = v
    setTimeout(() => this.onload?.(), 0)
  }
  get src() {
    return this._src
  }
}
globalThis.Image = FakeImage
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 })

// --- Grid constants (must match components/office/newOfficeLayout.ts) ---
const CELL = 0.25
const N = 42
const HALF = N / 2 // 21
const CX = -5.041 // model bbox center x (scene recenter = -CX)
const CZ = 4.9383 // model bbox center z (scene recenter = -CZ)
// The baked map owns the FULL physical center clearance: the robot body radius
// (0.30). A free cell's center is therefore >= 0.30 m from every obstacle, so
// the runtime path-safety sweep runs with clearance 0 (NEW_OFFICE_CLEARANCE) —
// the map is already center-safe; the sweep only rejects true corner clips.
// DO NOT double-count clearance here AND in the runtime sweep.
const CLEARANCE = 0.3
const THICK = 0.05 // conservative wall thickness margin for thin triangles

// Material → y-band (model space) = the robot BODY band only. The floor
// (max y ≈ -0.01), the baseboard (max y ≈ 0.109) and low 0.14 m tables sit
// below the band and are deliberately ignored (robots float/slide above them).
// Glass partitions span y 0.03..1.76 plus 0.16 m lintels at y 1.83..1.98
// (walk-under, ignored).
const BANDS = {
  Glass: [0.2, 2.2],
  default: [0.2, 1.6],
}

// Desk-top props and tiny decor never block navigation: they sit ON furniture
// (already blocked) or are small enough that the robot passes beside them.
const SKIP_MATERIALS = new Set([
  'hidden_material',
  'Monitor_01',
  'Monitor_01_Decals',
  'Monitor_screen',
  'Monitor.002',
  'Poster_office_3',
  'Poster_cert',
  'Poster_cert.001',
  'Poster_cert.002',
  'Paper',
  'printer_Buttons_Black',
  'printer_Button_ONOFF',
  'printer_White',
  'printer_Grey',
  'Handle_material',
  'Fronds',
  'Stalks',
  '01_-_Default',
  'Coffee',
  'Metal',
  'floor', // desk-top floor bits (the real floor is 'floor.001', below the band)
])

/**
 * Intentional access pockets + doorways, applied AFTER inflation so they can
 * never be re-blocked by neighboring furniture. Rectangles in MODEL
 * coordinates (office spans x -10.09..0, z -0.06..10.03). Measured from the
 * GLB geometry; see the M4 office-swap plan for the destination table.
 */
const CARVE_ZONES = [
  // Manager's office channel (Work destination = bookshelf at (-5.32, 9.23)).
  // The robot enters the glass room through the main z=6.99 partition doorway
  // (cols 37-40, the only real gap), then routes EAST of the interior wall and
  // around its natural back-end gap to the staging pocket east of the shelf.
  // Never carve the interior wall itself — only its doorway and back gap.
  { name: 'room-south-link', x0: -2.45, z0: 6.15, x1: -0.4, z1: 6.8 },
  { name: 'room-doorway', x0: -1.5, z0: 6.93, x1: -0.65, z1: 7.25 },
  { name: 'work-corridor', x0: -1.7, z0: 7.5, x1: -0.9, z1: 9.7 },
  { name: 'work-wall-back', x0: -2.75, z0: 9.5, x1: -2.05, z1: 10.05 },
  { name: 'work-staging', x0: -4.85, z0: 9.05, x1: -3.0, z1: 9.95 },
  { name: 'work-front-door-link', x0: -5.25, z0: 6.55, x1: -4.2, z1: 7.5 },

  // Admin cabinets front (cabinets at (-1.2, 0.19)).
  { name: 'admin-staging', x0: -2.6, z0: 0.75, x1: -0.4, z1: 1.55 },

  // Hallway bookshelf front (IDEAS/Uncategorized shelf at (-9.88, 5.3)).
  { name: 'ideas-staging', x0: -9.6, z0: 4.7, x1: -8.0, z1: 6.0 },

  // Archive trash bin pocket (bin at (-3.68, 1.79)).
  { name: 'archive-pocket', x0: -4.6, z0: 1.1, x1: -2.9, z1: 2.3 },
]

const clampCell = (v) => Math.max(0, Math.min(N - 1, v))

/** Anchor cell (round, matches runtime worldToGridCell). */
const anchorCell = (mx, mz) => [
  clampCell(Math.round((mx - CX) / CELL + HALF)),
  clampCell(Math.round((mz - CZ) / CELL + HALF)),
]

/** Raster coverage bounds (ceil/floor over the cell-span formula). */
const colFrom = (mx) => clampCell(Math.ceil((mx - CX + 5.125) / CELL))
const colTo = (mx) => clampCell(Math.floor((mx - CX + 5.375) / CELL))
const rowFrom = (mz) => clampCell(Math.ceil((mz - CZ + 5.125) / CELL))
const rowTo = (mz) => clampCell(Math.floor((mz - CZ + 5.375) / CELL))

const cellKey = (c, r) => `${c},${r}`

function matNameOf(mesh) {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return m?.name ?? '?'
}

const glbPath = process.argv[2] ?? path.resolve('public/models/3D_Note_Office_2/3d_note_office.glb')
const loader = new GLTFLoader()

loader.parse(fs.readFileSync(glbPath).buffer, '', (gltf) => {
  const scene = gltf.scene
  scene.updateMatrixWorld(true)

  // ---- 1. Rasterize raw blocked cells (model space) ----
  const raw = new Set()
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const matName = matNameOf(o)
    if (SKIP_MATERIALS.has(matName)) return
    const [bandMin, bandMax] = BANDS[matName] ?? BANDS.default
    let geo = o.geometry
    if (geo.index) geo = geo.toNonIndexed()
    const pos = geo.attributes.position
    if (!pos) return
    const m = o.matrixWorld
    const v = new THREE.Vector3()
    const pts = new Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m)
      pts[i] = [v.x, v.y, v.z]
    }
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const [ax, ay, az] = pts[i]
      const [bx, by, bz] = pts[i + 1]
      const [cx, cy, cz] = pts[i + 2]
      if (Math.max(ay, by, cy) < bandMin || Math.min(ay, by, cy) > bandMax) continue
      const minTx = Math.min(ax, bx, cx) - THICK
      const maxTx = Math.max(ax, bx, cx) + THICK
      const minTz = Math.min(az, bz, cz) - THICK
      const maxTz = Math.max(az, bz, cz) + THICK
      const c0 = colFrom(minTx)
      const c1 = colTo(maxTx)
      const r0 = rowFrom(minTz)
      const r1 = rowTo(maxTz)
      for (let cc = c0; cc <= c1; cc++) {
        for (let rr = r0; rr <= r1; rr++) {
          raw.add(cellKey(cc, rr))
        }
      }
    }
  })

  // ---- 2. Inflate by robot clearance (same algorithm as pathfinding.inflateBlockedCells) ----
  const half = CELL / 2
  const blockedCenters = [...raw].map((key) => {
    const [c, r] = key.split(',').map(Number)
    return { x: (c - HALF) * CELL, z: (r - HALF) * CELL }
  })
  const inflated = new Set(raw)
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N; r++) {
      const x = (c - HALF) * CELL
      const z = (r - HALF) * CELL
      if (blockedCenters.some((rect) => {
        const dx = Math.max(Math.abs(x - rect.x) - half, 0)
        const dz = Math.max(Math.abs(z - rect.z) - half, 0)
        return Math.hypot(dx, dz) <= CLEARANCE
      })) {
        inflated.add(cellKey(c, r))
      }
    }
  }

  // ---- 3. Apply carve zones AFTER inflation (pockets can never be re-blocked) ----
  for (const zone of CARVE_ZONES) {
    const c0 = colFrom(zone.x0)
    const c1 = colTo(zone.x1)
    const r0 = rowFrom(zone.z0)
    const r1 = rowTo(zone.z1)
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        inflated.delete(cellKey(c, r))
      }
    }
  }

  // ---- 4. ASCII map (printed row 0 = grid row 41 = back; last = grid row 0 = front) ----
  const rows = []
  for (let r = N - 1; r >= 0; r--) {
    let line = ''
    for (let c = 0; c < N; c++) line += inflated.has(cellKey(c, r)) ? '#' : '.'
    rows.push(line)
  }

  // ---- 5. Doorway gap report along known wall lines ----
  const wallLines = [
    { axis: 'z', coord: 0, label: 'FRONT WALL z≈0' },
    { axis: 'z', coord: 9.9, label: 'BACK WALL z≈9.9' },
    { axis: 'x', coord: -10.05, label: 'LEFT WALL x≈-10' },
    { axis: 'x', coord: 0, label: 'RIGHT WALL x≈0' },
    { axis: 'z', coord: 6.99, label: 'GLASS z≈6.99 (manager room front)' },
    { axis: 'z', coord: 1.75, label: 'GLASS z≈1.75' },
    { axis: 'x', coord: -5.43, label: 'GLASS x≈-5.43 (manager room side)' },
    { axis: 'x', coord: -6.35, label: 'GLASS x≈-6.35' },
  ]
  const runsOn = (blocked) => {
    const out = []
    for (const wall of wallLines) {
      const free = []
      for (let i = 0; i < N; i++) {
        const c = wall.axis === 'z' ? i : Math.round((wall.coord - CX) / CELL + HALF)
        const r = wall.axis === 'z' ? Math.round((wall.coord - CZ) / CELL + HALF) : i
        if (c < 0 || c >= N || r < 0 || r >= N) continue
        if (!blocked.has(cellKey(c, r))) free.push(wall.axis === 'z' ? c : r)
      }
      const runs = []
      let runStart = null
      let prev = null
      for (const coord of free) {
        if (runStart === null) runStart = coord
        else if (prev !== null && coord - prev > 1) {
          runs.push([runStart, prev])
          runStart = coord
        }
        prev = coord
      }
      if (runStart !== null) runs.push([runStart, prev])
      const report = runs
        .filter(([a, b]) => b - a + 1 >= 2)
        .map(([a, b]) => `${wall.axis === 'z' ? 'col' : 'row'} ${a}-${b} (${((b - a + 1) * CELL).toFixed(2)} m)`)
      out.push(wall.label + ' → ' + (report.length ? report.join(' | ') : 'NO free run ≥ 0.5 m'))
    }
    return out
  }
  console.log('=== DOORWAY GAP REPORT — FINAL (carved + inflated) ===')
  for (const line of runsOn(inflated)) console.log(line)

  // ---- 6. Anchor report ----
  const anchors = {
    workBookshelf: [-5.32, 9.23],
    adminCabinets: [-1.2, 0.19],
    hallwayBookshelf: [-9.88, 5.3],
    trashBin: [-3.68, 1.79],
    receptionDesk: [-0.93, 4.88],
  }
  const nearestFree = (c, r) => {
    for (let radius = 0; radius <= N; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
          const cc = c + dc
          const rr = r + dr
          if (cc < 0 || cc >= N || rr < 0 || rr >= N) continue
          if (!inflated.has(cellKey(cc, rr))) return [cc, rr]
        }
      }
    }
    return null
  }
  console.log('\n=== ANCHOR REPORT (model coords → cell → nearest free cell) ===')
  for (const [name, [ax, az]] of Object.entries(anchors)) {
    const [c, r] = anchorCell(ax, az)
    const free = !inflated.has(cellKey(c, r))
    const nearest = nearestFree(c, r)
    console.log(
      `${name} (${ax}, ${az}) → cell (${c}, ${r}) ${free ? 'FREE' : 'BLOCKED'} → nearest free ${nearest ? `(${nearest[0]}, ${nearest[1]})` : 'NONE'}`,
    )
  }

  // ---- 7. Emit the data module ----
  const cellsArray = [...inflated].sort((a, b) => {
    const [ca, ra] = a.split(',').map(Number)
    const [cb, rb] = b.split(',').map(Number)
    return ra - rb || ca - cb
  })
  const blockedLines = []
  for (let i = 0; i < cellsArray.length; i += 12) {
    blockedLines.push('  ' + cellsArray.slice(i, i + 12).map((k) => `'${k}'`).join(', '))
  }
  const output = `// GENERATED by scripts/generate-new-office-grid.mjs — do not edit by hand.
// Regenerate after any change to public/models/3D_Note_Office_2/3d_note_office.glb:
//   node scripts/generate-new-office-grid.mjs
/**
 * Blocked cells for the 3D Note Office (42×42 @ 0.25 m, world origin (0,0)).
 * Rasterized from the GLB geometry (walls, glass partitions, furniture in the
 * per-material y-bands), inflated by the robot body radius (0.30 — the full
 * physical center clearance, so the runtime sweep runs with clearance 0), then
 * carved with the intentional access pockets from CARVE_ZONES in the generator.
 * Doorways are open because the GLB has no door leaves. Keys are "col,row":
 * row 41 = back (z≈5.0), row 0 = front (z≈-5.25); col 0 = left (x≈-5.25).
 */
export const NEW_OFFICE_BLOCKED_CELLS: ReadonlySet<string> = new Set([
${blockedLines.join(',\n')},
])

/** ASCII visualization of the final blocked map (# blocked, . free). */
export const NEW_OFFICE_ASCII_MAP: readonly string[] = [
${rows.map((line) => `  '${line}'`).join(',\n')},
]
`
  const outPath = path.resolve('components/office/newOfficeGridData.ts')
  fs.writeFileSync(outPath, output)
  console.log(`\nWrote ${outPath} (${cellsArray.length} blocked cells, ${rows.length} map rows)`)
}, (err) => {
  console.error('PARSE ERROR', err)
  process.exit(1)
})
