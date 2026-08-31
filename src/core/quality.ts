export type QualityTier = 'ultra' | 'high' | 'balanced' | 'low'

export interface QualityProfile {
  tier: QualityTier
  particles: number
  stars: number
  dpr: [number, number]
  webgpuAvailable: boolean
}

export function selectQuality(): QualityProfile {
  const isCompact = window.matchMedia('(max-width: 700px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const cores = navigator.hardwareConcurrency ?? 4
  const webgpuAvailable = 'gpu' in navigator

  if (reducedMotion || (isCompact && cores <= 4)) {
    return { tier: 'low', particles: 34000, stars: 900, dpr: [1, 1.25], webgpuAvailable }
  }
  if (isCompact) {
    return { tier: 'balanced', particles: 56000, stars: 1400, dpr: [1, 1.5], webgpuAvailable }
  }
  if (webgpuAvailable && cores >= 8) {
    return { tier: 'ultra', particles: 150000, stars: 2600, dpr: [1, 1.75], webgpuAvailable }
  }
  return { tier: 'high', particles: 98000, stars: 2100, dpr: [1, 1.6], webgpuAvailable }
}
