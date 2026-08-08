import { describe, expect, it } from 'vitest'
import { OFFICE_ASSET_FOOTPRINTS } from './officeAssetFootprints'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { getBuilderAssets } from './officeBuilderAssets'

describe('officeAssetFootprints', () => {
  it('covers every OBJ in the pack with positive finite bounds', () => {
    expect(Object.keys(OFFICE_ASSET_FOOTPRINTS)).toHaveLength(162)
    for (const [obj, { width, depth }] of Object.entries(OFFICE_ASSET_FOOTPRINTS)) {
      expect(obj.startsWith('/models/3D_Office_Obj_Assets/')).toBe(true)
      expect(Number.isFinite(width)).toBe(true)
      expect(Number.isFinite(depth)).toBe(true)
      expect(width).toBeGreaterThan(0)
      expect(depth).toBeGreaterThan(0)
    }
  })

  it('keeps known reference footprints stable', () => {
    const A = '/models/3D_Office_Obj_Assets'
    expect(OFFICE_ASSET_FOOTPRINTS[`${A}/Tables/Office_Table_White_2x1_01.obj`]).toEqual({ width: 3.2, depth: 1.2 })
    expect(OFFICE_ASSET_FOOTPRINTS[`${A}/Chairs/Office_Couch_White_01.obj`]).toEqual({ width: 2.7, depth: 1.4 })
    expect(OFFICE_ASSET_FOOTPRINTS[`${A}/Cubicles/Office_Cubicle_White_05.obj`]).toEqual({ width: 3.2, depth: 3.2 })
    expect(OFFICE_ASSET_FOOTPRINTS[`${A}/Misc/Office_Misc_Plant_01.obj`]).toEqual({ width: 0.5, depth: 0.5 })
  })

  it('resolves a footprint for every model item in the locked baseline', () => {
    const assets = getBuilderAssets()
    const byAsset = new Map(assets.map((asset) => [asset.id, asset]))
    for (const item of LOCKED_DEFAULT_ITEMS) {
      if (item.kind !== 'model') continue
      const asset = byAsset.get(item.assetId)
      expect(asset?.obj, `${item.id} resolves an obj`).toBeTruthy()
      expect(OFFICE_ASSET_FOOTPRINTS[asset!.obj], `${item.id} footprint exists`).toBeDefined()
    }
  })
})
