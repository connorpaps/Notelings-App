import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { OFFICE_ASSET_MANIFEST } from './officeAssetManifest'
import { getBuilderAssets } from './OfficeBuilderContext'
import { PLACEMENTS, WALLS } from './officeLayout'

const ROOT = join(process.cwd(), 'public')

function referencedMaterialNames(objPath: string): string[] {
  return [...new Set(
    readFileSync(join(ROOT, objPath), 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*usemtl\s+(.+)\s*$/i)
        return match ? [match[1].trim()] : []
      }),
  )]
}

function declaredMaterialNames(mtlPath: string): string[] {
  return [...new Set(
    readFileSync(join(ROOT, mtlPath), 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*newmtl\s+(.+)\s*$/i)
        return match ? [match[1].trim()] : []
      }),
  )]
}

function referencedTexturePaths(mtlPath: string): string[] {
  return readFileSync(join(ROOT, mtlPath), 'utf8')
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*map_Kd\s+(.+)\s*$/i)
      return match ? [match[1].trim()] : []
    })
}

describe('officeAssetManifest', () => {
  it('covers every OBJ/MTL pair with stable unique IDs', () => {
    expect(OFFICE_ASSET_MANIFEST).toHaveLength(162)
    expect(new Set(OFFICE_ASSET_MANIFEST.map((asset) => asset.id)).size).toBe(162)
    expect(new Set(OFFICE_ASSET_MANIFEST.map((asset) => asset.obj)).size).toBe(162)
    expect(new Set(OFFICE_ASSET_MANIFEST.map((asset) => asset.mtl)).size).toBe(162)
  })

  it('points every manifest entry at real paired files', () => {
    OFFICE_ASSET_MANIFEST.forEach((asset) => {
      expect(existsSync(join(ROOT, asset.obj))).toBe(true)
      expect(existsSync(join(ROOT, asset.mtl))).toBe(true)
      expect(asset.mtl.replace(/\.mtl$/i, '.obj')).toBe(asset.obj)
    })
  })

  it('maps every OBJ material name to its matching MTL and real palette texture', () => {
    OFFICE_ASSET_MANIFEST.forEach((asset) => {
      const declared = declaredMaterialNames(asset.mtl)
      referencedMaterialNames(asset.obj).forEach((name) => expect(declared).toContain(name))
      referencedTexturePaths(asset.mtl).forEach((texture) => expect(existsSync(join(ROOT, dirname(asset.mtl), texture))).toBe(true))
    })
  })

  it('keeps existing placement-backed asset pairs unchanged and exposes the full catalog', () => {
    const manifestPairs = new Set(OFFICE_ASSET_MANIFEST.map((asset) => `${asset.obj}|${asset.mtl}`))
    PLACEMENTS.forEach((placement) => {
      expect(manifestPairs.has(`${placement.obj}|${placement.mtl}`)).toBe(true)
    })

    const assets = getBuilderAssets()
    expect(assets.filter((asset) => asset.kind === 'model')).toHaveLength(162)
    expect(assets).toHaveLength(162 + 2 + WALLS.length)
    OFFICE_ASSET_MANIFEST.forEach((entry) => {
      expect(assets.some((asset) => asset.obj === entry.obj && asset.mtl === entry.mtl)).toBe(true)
    })
  })

  it('uses the intended broad categories for structural and decorative assets', () => {
    const asset = (suffix: string) => OFFICE_ASSET_MANIFEST.find((entry) => entry.obj.endsWith(suffix))
    expect(asset('/Office_Misc_Door_01.obj')?.category).toBe('Architecture')
    expect(asset('/Office_Misc_Door_02.obj')?.category).toBe('Architecture')
    expect(asset('/Office_Misc_Cabinet_01.obj')?.category).toBe('Architecture')
    expect(asset('/Office_Misc_Wall_Clock_02.obj')?.category).toBe('Wall Decor')
    expect(asset('/Office_Misc_Plant_03.obj')?.category).toBe('Plants')
    expect(asset('/Office_Misc_Trashcan_Big_05.obj')?.category).toBe('Utilities')
    expect(asset('/Office_Cubicle_Dark_05.obj')?.category).toBe('Cubicles')
    expect(asset('/Office_Table_Brown_3x1_02.obj')?.category).toBe('Tables')
  })
})
