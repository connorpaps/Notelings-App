import { describe, expect, it } from 'vitest'
import {
  OFFICE_RENDER_PROFILES,
  resolveOfficeRenderQuality,
  type BrowserRenderCapabilities,
} from './renderProfile'

const desktop: BrowserRenderCapabilities = {
  coarsePointer: false,
  hardwareConcurrency: 12,
  deviceMemory: 16,
}

const constrained: BrowserRenderCapabilities = {
  coarsePointer: true,
  hardwareConcurrency: 4,
  deviceMemory: 4,
}

describe('office render profiles', () => {
  it('keeps the high desktop visual baseline at DPR 1', () => {
    expect(OFFICE_RENDER_PROFILES.high).toMatchObject({
      quality: 'high',
      dpr: 1,
      frameloop: 'always',
      shadows: true,
      shadowMapSize: [4096, 4096],
      shadowCascade: 30,
      postprocessing: true,
      toneMappingMode: null,
      toneMappingExposure: 1.2,
      bloom: { luminanceThreshold: 1, intensity: 0.2 },
      ssao: { samples: 32, rings: 4, intensity: 2 },
    })
  })

  it('keeps Bloom and exposure while reducing balanced shadow and SSAO cost', () => {
    expect(OFFICE_RENDER_PROFILES.balanced).toMatchObject({
      quality: 'balanced',
      dpr: 1,
      shadows: true,
      shadowMapSize: [2048, 2048],
      shadowCascade: 14,
      postprocessing: true,
      toneMappingExposure: 1.2,
      bloom: OFFICE_RENDER_PROFILES.high.bloom,
      ssao: {
        radius: 2.4,
        intensity: 2,
        samples: 16,
        rings: 2,
        bias: 0.3,
        luminanceInfluence: 0.65,
      },
    })
  })

  it('selects high for a capable desktop', () => {
    expect(resolveOfficeRenderQuality(desktop)).toBe('high')
    expect(resolveOfficeRenderQuality(desktop, 'high')).toBe('high')
    expect(resolveOfficeRenderQuality(desktop, 'balanced')).toBe('balanced')
  })

  it('selects balanced for constrained capabilities', () => {
    expect(resolveOfficeRenderQuality(constrained)).toBe('balanced')
    expect(resolveOfficeRenderQuality({ coarsePointer: true })).toBe('balanced')
    expect(resolveOfficeRenderQuality({ coarsePointer: false, hardwareConcurrency: 4 })).toBe('balanced')
    expect(resolveOfficeRenderQuality({ coarsePointer: false, deviceMemory: 4 })).toBe('balanced')
  })

  it('uses high when optional capability signals are unavailable', () => {
    expect(resolveOfficeRenderQuality({ coarsePointer: false })).toBe('high')
    expect(resolveOfficeRenderQuality(desktop, 'auto')).toBe('high')
    expect(resolveOfficeRenderQuality(desktop, 'unknown' as never)).toBe('high')
  })
})
