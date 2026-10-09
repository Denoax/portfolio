// Authored transition progress, never external-network telemetry. No entry checkpoint.
export interface ResourceProgress {
  time: number
  age: number
  paused: boolean
  transitionAge: number
  rateFrom: number
  rate: number
  waveAmplitude: number
  waveVelocity: number
  wavePhase: number
  bounce: number
}
export const RESOURCE_DURATION = 3.2
export const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u))
  return t * t * (3 - 2 * t)
}
export function createResourceProgress(): ResourceProgress {
  return {
    time: 0,
    age: 0,
    paused: false,
    transitionAge: 1,
    rateFrom: 1,
    rate: 1,
    waveAmplitude: 0,
    waveVelocity: 0,
    wavePhase: 0,
    bounce: 0,
  }
}
export function resourceAction(s: ResourceProgress): ResourceProgress {
  return { ...s, paused: !s.paused, transitionAge: 0, rateFrom: s.rate }
}
export function advanceResource(
  s: ResourceProgress,
  seconds: number,
  reduced: boolean,
): ResourceProgress {
  if (!Number.isFinite(seconds) || seconds <= 0) return s
  if (seconds > 1 / 120 + 1e-9) {
    let next = s,
      remaining = Math.min(seconds, 30)
    while (remaining > 1e-9) {
      const dt = Math.min(remaining, 1 / 120)
      next = advanceResource(next, dt, reduced)
      remaining -= dt
    }
    return next
  }
  const next = { ...s },
    dt = seconds
  next.age += dt
  next.wavePhase += dt
  next.transitionAge += dt
  const target = next.paused ? 0 : 1
  next.rate = reduced
    ? target
    : next.rateFrom +
      (target - next.rateFrom) *
        smooth(next.transitionAge / (next.paused ? 0.28 : 0.3))
  next.time = Math.min(
    reduced ? 0.35 : RESOURCE_DURATION,
    next.time + dt * next.rate,
  )
  next.bounce =
    next.paused && !reduced && next.transitionAge < 0.28
      ? Math.sin((next.transitionAge / 0.28) * Math.PI * 2) *
        Math.exp(-next.transitionAge * 10)
      : 0
  const amplitude = next.paused
    ? 1
    : next.time >= (reduced ? 0.35 : RESOURCE_DURATION)
      ? 0.2
      : 0
  if (reduced) {
    next.waveAmplitude = amplitude
    next.waveVelocity = 0
  } else {
    const omega = 18,
      offset = next.waveAmplitude - amplitude,
      a = next.waveVelocity + omega * offset,
      e = Math.exp(-omega * dt)
    next.waveAmplitude = amplitude + (offset + a * dt) * e
    next.waveVelocity = (next.waveVelocity - omega * a * dt) * e
  }
  return next
}
const stops = [
  [0, 0],
  [0.16, 0.08],
  [0.8, 0.24],
  [1.05, 0.25],
  [1.35, 0.44],
  [2.1, 0.72],
  [2.45, 0.76],
  [3, 0.96],
  [3.2, 0.99],
] as const
export function resourceFraction(time: number, reduced: boolean) {
  const t = reduced ? (time / 0.35) * RESOURCE_DURATION : time
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0])
      return (
        stops[i - 1][1] +
        (stops[i][1] - stops[i - 1][1]) *
          smooth((t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]))
      )
  }
  return 0.99
}
// Six clipped rows form opposing halves of ONE selected image. Smooth endpoints
// and a bounded localized accent converge without reversing the approach.
export function resourceSlice(time: number, index: number, reduced: boolean) {
  const side = index % 2 ? 1 : -1,
    row = Math.floor(index / 2),
    approach = 1 - smooth((time - 0.16) / 2.29),
    settle = 1 - smooth((time - 2.45) / 0.55)
  const accent =
    smooth((time - 1.05) / 0.12) * (1 - smooth((time - 1.2) / 0.15))
  return {
    x: reduced
      ? 0
      : side * (approach * 190 + ((row % 3) - 1) * 11 * settle + accent * 14),
    y: reduced
      ? 0
      : ((row % 3) - 1) *
        12 *
        Math.sin(Math.PI * smooth((time - 0.16) / 2.29)) *
        settle,
    opacity: reduced ? smooth(time / 0.16) : smooth(time / 0.16),
  }
}
