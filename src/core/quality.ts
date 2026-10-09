export type QualityTier = 'high' | 'balanced' | 'low'
export interface QualityProfile {
  tier: QualityTier
  cloudSteps: number
  cloudResolution: number
  waveSegments: number
  particles: number
  stars: number
  dpr: [number, number]
  webgpuAvailable: boolean
}
export function selectQuality(
  requested: 'auto' | 'balanced' | 'high' = 'auto',
): QualityProfile {
  const compact = window.matchMedia('(max-width: 700px)').matches
  const low = (navigator.hardwareConcurrency ?? 4) <= 4
  const tier =
    requested === 'auto'
      ? low
        ? 'low'
        : compact
          ? 'balanced'
          : 'high'
      : requested
  return {
    tier,
    cloudSteps: tier === 'high' ? 40 : tier === 'balanced' ? 28 : 20,
    cloudResolution: tier === 'low' ? 0.35 : 0.5,
    waveSegments: tier === 'high' ? 240 : tier === 'balanced' ? 160 : 96,
    particles: tier === 'high' ? 80000 : tier === 'balanced' ? 40000 : 15000,
    stars: compact ? 700 : 1400,
    dpr: [1, tier === 'high' ? 1.5 : tier === 'balanced' ? 1.25 : 1],
    webgpuAvailable: 'gpu' in navigator,
  }
}

export function lowerQuality(current: QualityProfile): QualityProfile {
  if (current.tier === 'low') return current
  const tier = current.tier === 'high' ? 'balanced' : 'low'
  return {
    ...current,
    tier,
    cloudSteps: tier === 'balanced' ? 28 : 20,
    cloudResolution: tier === 'low' ? 0.35 : 0.5,
    waveSegments: tier === 'balanced' ? 160 : 96,
    particles: tier === 'balanced' ? 40000 : 15000,
    stars: Math.min(current.stars, 700),
    dpr: [1, tier === 'balanced' ? 1.25 : 1],
  }
}
