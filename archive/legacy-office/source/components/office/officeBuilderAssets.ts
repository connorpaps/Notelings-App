'use client'

import { OFFICE_ASSET_MANIFEST } from './officeAssetManifest'
import { OFFICE_CENTER, PLACEMENTS, WALLS, type ModelPlacement, type WallSegment } from './officeLayout'

export type BuilderCategory =
  | 'Seating'
  | 'Cubicles'
  | 'Tables'
  | 'Electronics'
  | 'Coffee'
  | 'Plants'
  | 'Utilities'
  | 'Wall Decor'
  | 'Architecture'

export type BuilderTransform = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type BuilderAsset = {
  id: string
  name: string
  category: BuilderCategory
  obj: string
  mtl: string
  sourcePlacementId?: string
  defaultMount?: ModelPlacement['mount']
  kind: 'model' | 'divider' | 'wall' | 'floor'
  wall?: WallSegment
}

export type BuilderItem = {
  id: string
  assetId: string
  name: string
  category: BuilderCategory
  kind: BuilderAsset['kind']
  transform: BuilderTransform
  sourcePlacementId?: string
  wallSide?: ModelPlacement['wallSide']
  wallOffset?: number
  wall?: WallSegment
}

function categoryForPlacement(placement: ModelPlacement): BuilderCategory {
  const path = `${placement.obj}/${placement.mtl}`.toLowerCase()
  if (path.includes('/chairs/')) return 'Seating'
  if (path.includes('/cubicles/')) return 'Cubicles'
  if (path.includes('/tables/')) return 'Tables'
  if (path.includes('/electronics/')) return 'Electronics'
  if (path.includes('/coffee/')) return 'Coffee'
  if (path.includes('plant')) return 'Plants'
  if (path.includes('/fragments/') || path.includes('door') || path.includes('cabinet')) return 'Architecture'
  if (placement.mount === 'wall') return 'Wall Decor'
  return 'Utilities'
}

const DIVIDER_ASSET: BuilderAsset = {
  id: 'procedural-central-t-divider',
  name: 'Central T divider',
  category: 'Architecture',
  obj: '',
  mtl: '',
  sourcePlacementId: 'central-t-divider',
  kind: 'divider',
}

const FLOOR_ASSET: BuilderAsset = {
  id: 'procedural-office-floor',
  name: 'Office floor',
  category: 'Architecture',
  obj: '',
  mtl: '',
  sourcePlacementId: 'office-floor',
  kind: 'floor',
}

function wallAsset(wall: WallSegment): BuilderAsset {
  return {
    id: `wall:${wall.id}`,
    name: wall.id.replace('wall-', '').replaceAll('-', ' '),
    category: 'Architecture',
    obj: '',
    mtl: '',
    sourcePlacementId: wall.id,
    kind: 'wall',
    wall,
  }
}

export function getBuilderAssets(): BuilderAsset[] {
  const byAsset = new Map<string, BuilderAsset>()
  for (const placement of PLACEMENTS) {
    const id = `${placement.obj}|${placement.mtl}`
    if (!byAsset.has(id)) {
      byAsset.set(id, {
        id,
        name: placement.name,
        category: categoryForPlacement(placement),
        obj: placement.obj,
        mtl: placement.mtl,
        sourcePlacementId: placement.id,
        defaultMount: placement.mount,
        kind: 'model',
      })
    }
  }

  for (const entry of OFFICE_ASSET_MANIFEST) {
    const pairId = `${entry.obj}|${entry.mtl}`
    if (byAsset.has(pairId)) continue
    byAsset.set(pairId, {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      obj: entry.obj,
      mtl: entry.mtl,
      kind: 'model',
    })
  }

  return [...byAsset.values(), DIVIDER_ASSET, FLOOR_ASSET, ...WALLS.map(wallAsset)]
}

export { OFFICE_CENTER }
