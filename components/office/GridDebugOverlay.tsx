'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GridTransform } from './pathfinding'
import { gridCellToWorld } from './pathfinding'
import { NEW_OFFICE_FLOOR } from './newOfficeLayout'
import { applyEdits, cellKeyAtWorld, collectWalkableCells, paintEdit } from './gridEditor'
import { useGridEditorStore } from './gridEditorStore'

// Painted tiles are thin so they read as floor markings, not floating blocks.
// The lift (3 mm) keeps them clear of the floor slab so they never z-fight it.
const DEBUG_TILE_HEIGHT = 0.008
const DEBUG_TILE_LIFT = 0.003
const DEBUG_CELL_SCALE = 0.92

type GridDebugOverlayProps = {
  blocked: ReadonlySet<string>
  grid: GridTransform
}

/**
 * Interactive walkable-area debug overlay.
 *
 * Red tiles are the FREE cells of the nav map (baked blocked + manual edits),
 * painted flat on the GLB's real floor surface and clipped to the floor slab's
 * footprint. While ENABLE_GRID_DEBUG is on, the overlay doubles as the Nav
 * Grid Editor: click or drag over the floor to toggle the red square of a
 * cell — removing it marks the cell blocked (e.g. a couch the bake missed),
 * adding it marks the cell walkable. Decisions are stored as deltas in the
 * grid editor store (localStorage) and never touch the baked map until the
 * exported result is locked in via scripts/lock-in-grid.mjs.
 */
export default function GridDebugOverlay({ blocked, grid }: GridDebugOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dragTargetFree = useRef<boolean | null>(null)
  const lastPaintedKey = useRef<string | null>(null)

  const edits = useGridEditorStore((state) => state.edits)
  const setEdits = useGridEditorStore((state) => state.setEdits)

  // Lazy-load persisted edits after mount (see gridEditorStore — the server
  // pre-render must match the client's first render).
  useEffect(() => {
    useGridEditorStore.getState().hydrate()
  }, [])

  const cols = grid.cols ?? 42
  const rows = grid.rows ?? 42

  const mergedBlocked = useMemo(() => applyEdits(blocked, edits), [blocked, edits])

  // Fixed-size instance list (cols×rows); non-walkable cells get a null entry
  // and are hidden with a zero-scale matrix, so painting never rebuilds buffers.
  const walkableKeys = useMemo(() => {
    const painted = new Set(collectWalkableCells(mergedBlocked, grid))
    const arr: Array<string | null> = new Array(cols * rows).fill(null)
    for (const key of painted) {
      const [col, row] = key.split(',').map(Number)
      arr[row * cols + col] = key
    }
    return arr
  }, [mergedBlocked, grid, cols, rows])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
    const matrix = new THREE.Matrix4()
    walkableKeys.forEach((key, index) => {
      if (!key) {
        mesh.setMatrixAt(index, hidden)
        return
      }
      const [col, row] = key.split(',').map(Number)
      const [x, z] = gridCellToWorld([col, row], grid)
      matrix.makeTranslation(x, NEW_OFFICE_FLOOR.topY + DEBUG_TILE_LIFT + DEBUG_TILE_HEIGHT / 2, z)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [walkableKeys, grid])

  const [hoverKey, setHoverKey] = useState<string | null>(null)

  useEffect(() => {
    ;(window as unknown as { __NOTELINGS_GRID_EDITOR__?: Record<string, unknown> }).__NOTELINGS_GRID_EDITOR__ = {
      editCount: Object.keys(edits).length,
      walkableCount: walkableKeys.filter((key) => key !== null).length,
    }
  }, [edits, walkableKeys])

  const paint = (key: string | null, free: boolean) => {
    if (!key) return
    lastPaintedKey.current = key
    setEdits((current) => paintEdit(blocked, current, key, free))
  }

  const handlePointer = (x: number, z: number) => {
    const key = cellKeyAtWorld(x, z, grid)
    setHoverKey((current) => (current === key ? current : key))
    if (dragTargetFree.current !== null && key && key !== lastPaintedKey.current) {
      paint(key, dragTargetFree.current)
    }
  }

  const hoverColRow = hoverKey?.split(',').map(Number) ?? [-1, -1]
  const [hoverX, hoverZ] = hoverKey ? gridCellToWorld([hoverColRow[0], hoverColRow[1]], grid) : [0, 0]
  // Green = clicking paints a red square (cell becomes walkable); yellow =
  // clicking erases one (cell becomes blocked).
  const hoverIsFree = hoverKey ? !mergedBlocked.has(hoverKey) : false

  const walkableCount = walkableKeys.filter((key) => key !== null).length

  return (
    <group
      name="grid-debug"
      userData={{ notelingsGridDebug: true, walkableCellCount: walkableCount, editCount: Object.keys(edits).length }}
    >
      <instancedMesh
        ref={meshRef}
        name="walkable-cell-overlay"
        args={[undefined, undefined, cols * rows]}
        frustumCulled={false}
      >
        <boxGeometry args={[grid.scale[0] * DEBUG_CELL_SCALE, DEBUG_TILE_HEIGHT, grid.scale[1] * DEBUG_CELL_SCALE]} />
        <meshBasicMaterial color="#ff3030" transparent opacity={0.5} depthTest depthWrite={false} />
      </instancedMesh>

      {/* Invisible full-grid plane: receives pointer input so any cell (painted
          or not) can be toggled. Sits on the floor slab — no visual impact. */}
      <mesh
        name="grid-editor-plane"
        position={[0, NEW_OFFICE_FLOOR.topY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const key = cellKeyAtWorld(event.point.x, event.point.z, grid)
          if (!key) return
          // Paint blocked cells free (add a red square) and free cells blocked
          // (erase it). Clicking the same cell again reverts to the baked map.
          dragTargetFree.current = mergedBlocked.has(key)
          paint(key, dragTargetFree.current)
        }}
        onPointerMove={(event) => handlePointer(event.point.x, event.point.z)}
        onPointerUp={() => {
          dragTargetFree.current = null
          lastPaintedKey.current = null
        }}
        onPointerLeave={() => {
          dragTargetFree.current = null
          lastPaintedKey.current = null
          setHoverKey(null)
        }}
      >
        <planeGeometry args={[cols * grid.scale[0], rows * grid.scale[1]]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh
        name="grid-editor-hover"
        visible={hoverKey !== null}
        position={[hoverX, NEW_OFFICE_FLOOR.topY + 0.02, hoverZ]}
        frustumCulled={false}
      >
        <boxGeometry args={[grid.scale[0], 0.02, grid.scale[1]]} />
        <meshBasicMaterial
          color={hoverIsFree ? '#facc15' : '#4ade80'}
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
