// Analytic rate integration preserves position through live edits at any cadence.
export function advanceAutoRate(current: number, target: number, dt: number) {
  const seconds = Math.max(0, dt)
  const decay = Math.exp(-seconds / 0.15)
  return {
    rate: target + (current - target) * decay,
    seconds: target * seconds + (current - target) * 0.15 * (1 - decay),
  }
}
