import { describe, expect, it } from 'vitest'
import { getBuilderAssets, getInitialBuilderItems } from './OfficeBuilderContext'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'

const modelCount = LOCKED_DEFAULT_ITEMS.filter((item) => item.kind === 'model').length
const wallCount = LOCKED_DEFAULT_ITEMS.filter((item) => item.kind === 'wall').length

describe('locked builder default', () => {
  it('contains the complete approved export without the editor-only divider', () => {
    expect(LOCKED_DEFAULT_ITEMS).toHaveLength(60)
    expect(modelCount).toBe(49)
    expect(wallCount).toBe(10)
    expect(LOCKED_DEFAULT_ITEMS.filter((item) => item.kind === 'floor')).toHaveLength(1)
    expect(LOCKED_DEFAULT_ITEMS.some((item) => item.id === 'central-t-divider')).toBe(false)
  })

  it('keeps unique IDs and resolvable asset references for every item', () => {
    const assets = getBuilderAssets()
    const ids = LOCKED_DEFAULT_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of LOCKED_DEFAULT_ITEMS) {
      const asset = assets.find((candidate) => candidate.id === item.assetId)
      expect(asset, `${item.id} asset should resolve`).toBeDefined()
      expect(asset?.kind).toBe(item.kind)
    }
  })

  it('keeps the exact exported transforms for representative edited items', () => {
    const byId = new Map(LOCKED_DEFAULT_ITEMS.map((item) => [item.id, item]))
    expect(byId.get('office-floor')?.transform).toEqual({
      position: [-2.3394196359495605, 0, -1.441740372008582],
      rotation: [0, 0, 0],
      scale: [0.95, 1, 0.8],
    })
    expect(byId.get('wall:wall-negative-z-0f92839c')?.transform.scale).toEqual([0.3, 1, 1.0002])
    expect(byId.get('wall-left-lower')?.transform.rotation).toEqual([0, 1.5, 0])
    expect(byId.get('asset:misc-electronics-o-cc6ade45')?.assetId).toBe('asset:misc-electronics-office-misc-tv-wall-03')
  })

  it('returns deep-enough copies for reset and future edits', () => {
    const first = getInitialBuilderItems()
    const second = getInitialBuilderItems()
    first[0].transform.position[0] = 999
    const firstWall = first.find((item) => item.kind === 'wall')
    if (firstWall?.wall) firstWall.wall.cell[0] = 99
    expect(second[0].transform.position[0]).not.toBe(999)
    expect(LOCKED_DEFAULT_ITEMS[0].transform.position[0]).not.toBe(999)
    expect(LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'wall')?.wall?.cell[0]).toBe(0)
  })
})
