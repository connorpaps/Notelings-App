export type OfficeRenderQuality = 'high' | 'balanced'
export type OfficeRenderQualityOverride = OfficeRenderQuality | 'auto' | undefined

export type BrowserRenderCapabilities = {
  coarsePointer: boolean
  hardwareConcurrency?: number
  deviceMemory?: number
}

type SsaoProfile = {
  radius: number
  intensity: number
  samples: number
  rings: number
  bias: number
  luminanceInfluence: number
}

type BloomProfile = {
  luminanceThreshold: number
  intensity: number
}

export type OfficeRenderProfile = {
  quality: OfficeRenderQuality
  dpr: 1
  frameloop: 'always'
  shadows: true
  shadowMapSize: readonly [number, number]
  shadowCascade: number
  postprocessing: true
  toneMappingMode: null
  toneMappingExposure: number
  bloom: BloomProfile
  ssao: SsaoProfile
}

const HIGH_BLOOM = {
  luminanceThreshold: 1,
  intensity: 0.2,
} as const

const HIGH_SSAO = {
  radius: 2.4,
  intensity: 2,
  samples: 32,
  rings: 4,
  bias: 0.3,
  luminanceInfluence: 0.65,
} as const

const BALANCED_SSAO = {
  ...HIGH_SSAO,
  samples: 16,
  rings: 2,
} as const

export const OFFICE_RENDER_PROFILES = {
  high: {
    quality: 'high',
    dpr: 1,
    frameloop: 'always',
    shadows: true,
    shadowMapSize: [4096, 4096],
    shadowCascade: 30,
    postprocessing: true,
    toneMappingMode: null,
    toneMappingExposure: 1.2,
    bloom: HIGH_BLOOM,
    ssao: HIGH_SSAO,
  },
  balanced: {
    quality: 'balanced',
    dpr: 1,
    frameloop: 'always',
    shadows: true,
    shadowMapSize: [2048, 2048],
    shadowCascade: 14,
    postprocessing: true,
    toneMappingMode: null,
    toneMappingExposure: 1.2,
    bloom: HIGH_BLOOM,
    ssao: BALANCED_SSAO,
  },
} as const satisfies Record<OfficeRenderQuality, OfficeRenderProfile>

export function resolveOfficeRenderQuality(
  capabilities: BrowserRenderCapabilities,
  override: OfficeRenderQualityOverride = 'auto',
): OfficeRenderQuality {
  if (override === 'high' || override === 'balanced') return override
  if (capabilities.coarsePointer) return 'balanced'
  if ((capabilities.hardwareConcurrency ?? Number.POSITIVE_INFINITY) <= 4) return 'balanced'
  if ((capabilities.deviceMemory ?? Number.POSITIVE_INFINITY) <= 4) return 'balanced'
  return 'high'
}

export function getBrowserRenderCapabilities(): BrowserRenderCapabilities {
  if (typeof window === 'undefined') {
    return { coarsePointer: false }
  }

  const navigatorWithMemory = window.navigator as Navigator & { deviceMemory?: number }
  const hardwareConcurrency = navigatorWithMemory.hardwareConcurrency
  const deviceMemory = navigatorWithMemory.deviceMemory

  return {
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    hardwareConcurrency: hardwareConcurrency > 0 ? hardwareConcurrency : undefined,
    deviceMemory: deviceMemory !== undefined && deviceMemory > 0 ? deviceMemory : undefined,
  }
}
