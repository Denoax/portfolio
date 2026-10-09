import { clamp, smoothstep } from './math'
import { waveHeight } from './ocean'
import type { JourneyFrame, Vec3 } from './journey'
// One monotone timing map owns every visual envelope, camera and reverse exit.
// Phase is the stable spatial recipe; progress is the native v6 scroll allocation.
export const DESCENT_TIMING = {
  hold: 0.08,
  lightStart: 0.38,
  flashRebase: 0.45,
  lightEnd: 0.52,
  atmosphere: 0.7,
  cloudRebase: 0.76,
  highWater: 0.84,
  mediumWater: 0.875,
  nearWater: 0.9,
  crossing: 0.935,
} as const
const phaseKeys = [
  [0, 0],
  [0.08, 0.055],
  [0.38, 0.235],
  [0.45, 0.275],
  [0.52, 0.315],
  [0.7, 0.565],
  [0.76, 0.64],
  [0.84, 0.72],
  [0.875, 0.78],
  [0.9, 0.84],
  [0.935, 0.9],
  [0.965, 0.94],
  [1, 1],
] as const
export function descentPhase(progress: number) {
  let i = 0
  while (i < phaseKeys.length - 2 && progress > phaseKeys[i + 1][0]) i++
  const slope = (j: number) => {
    const d = (k: number) =>
      (phaseKeys[k + 1][1] - phaseKeys[k][1]) /
      (phaseKeys[k + 1][0] - phaseKeys[k][0])
    if (j === 0) return d(0)
    if (j === phaseKeys.length - 1) return d(j - 1)
    return 2 / (1 / d(j - 1) + 1 / d(j))
  }
  const [a, ya] = phaseKeys[i],
    [b, yb] = phaseKeys[i + 1],
    u = clamp((progress - a) / (b - a)),
    span = b - a
  return (
    (2 * u ** 3 - 3 * u ** 2 + 1) * ya +
    (u ** 3 - 2 * u ** 2 + u) * span * slope(i) +
    (-2 * u ** 3 + 3 * u ** 2) * yb +
    (u ** 3 - u ** 2) * span * slope(i + 1)
  )
}
export function descentProgress(phase: number) {
  let low = 0,
    high = 1
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (descentPhase(mid) < phase) low = mid
    else high = mid
  }
  return (low + high) / 2
}
export const FLASH_REBASE = DESCENT_TIMING.flashRebase
const PHASE_FLASH_REBASE = 0.275
export const CLOUD_COVER = {
  enter: 0.71,
  start: 0.735,
  end: 0.79,
  exit: 0.825,
} as const
export function cloudCover(progress: number) {
  return (
    smoothstep(
      (progress - CLOUD_COVER.enter) / (CLOUD_COVER.start - CLOUD_COVER.enter),
    ) *
    (1 -
      smoothstep(
        (progress - CLOUD_COVER.end) / (CLOUD_COVER.exit - CLOUD_COVER.end),
      ))
  )
}
export const CLOUD_REBASE = DESCENT_TIMING.cloudRebase
const PHASE_CLOUD_REBASE = 0.64
export const descentSamples = [
  ['A0', 0],
  ['A1', 0.3],
  ['A2', 0.45],
  ['A3', 0.54],
  ['A4', 0.64],
  ['A5', 0.76],
  ['A6', 0.875],
  ['A7', 0.935],
  ['A8', 1],
] as const
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const envelope = (p: number, start: number, peak: number, end: number) =>
  p < peak
    ? smoothstep((p - start) / (peak - start))
    : 1 - smoothstep((p - peak) / (end - peak))
type Key = { at: number; value: Vec3; tangent?: Vec3 }
// Cubic Hermite interpolation uses the same tangent on both sides of every
// interior key. End holds are deliberate; ordinary waypoints do not stop.
function path(keys: Key[], p: number): Vec3 {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1].at) i++
  const a = keys[i],
    b = keys[i + 1],
    span = b.at - a.at,
    u = clamp((p - a.at) / span)
  const tangent = (j: number, axis: number) => {
    if (keys[j].tangent) return keys[j].tangent![axis]
    if (j === 0 || j === keys.length - 1) return 0
    return (
      (keys[j + 1].value[axis] - keys[j - 1].value[axis]) /
      (keys[j + 1].at - keys[j - 1].at)
    )
  }
  return a.value.map(
    (v, k) =>
      (2 * u * u * u - 3 * u * u + 1) * v +
      (u * u * u - 2 * u * u + u) * span * tangent(i, k) +
      (-2 * u * u * u + 3 * u * u) * b.value[k] +
      (u * u * u - u * u) * span * tangent(i + 1, k),
  ) as Vec3
}
const heights = [
  [0.58, 140],
  [0.6, 105],
  [0.64, 70],
  [0.69, 50],
  [0.72, 32],
  [0.78, 12],
  [0.84, 3.6],
  [0.9, -0.3],
  [0.94, -2.8],
  [1, -7.2],
] as const
// Monotone Hermite slopes prevent an altitude overshoot or an accidental climb.
export function descentHeight(progress: number) {
  const p = descentPhase(progress)
  let i = 0
  while (i < heights.length - 2 && p > heights[i + 1][0]) i++
  const slope = (j: number) => {
    if (j === heights.length - 1) return 0
    const next =
      (heights[j + 1][1] - heights[j][1]) / (heights[j + 1][0] - heights[j][0])
    if (j === 0) return next
    const prev =
      (heights[j][1] - heights[j - 1][1]) / (heights[j][0] - heights[j - 1][0])
    return 2 / (1 / prev + 1 / next)
  }
  const [a, ya] = heights[i],
    [b, yb] = heights[i + 1],
    u = clamp((p - a) / (b - a)),
    span = b - a
  return (
    (2 * u ** 3 - 3 * u ** 2 + 1) * ya +
    (u ** 3 - 2 * u ** 2 + u) * span * slope(i) +
    (-2 * u ** 3 + 3 * u ** 2) * yb +
    (u ** 3 - u ** 2) * span * slope(i + 1)
  )
}
export function evaluateDescent(
  p: number,
  mobile: boolean,
  short: boolean,
  time: number,
  centers: JourneyFrame['worldCenters'],
): JourneyFrame {
  const progress = clamp(p)
  p = descentPhase(progress)
  const core: Vec3 = [mobile ? 0.7 : 4, mobile && short ? 5.2 : 3.8, 0]
  const endZ = mobile ? 16.8 : 13.8,
    endY = mobile ? 1.5 : 1.8
  const frame: JourneyFrame = {
    shot:
      p < 0.1
        ? 'S01'
        : p < 0.275
          ? 'S02'
          : p < 0.46
            ? 'S03'
            : p < 0.7
              ? 'S04'
              : p < 0.93
                ? 'S05'
                : 'S06',
    local: progress,
    worldCenters: centers,
    oceanCenter: [0, -5, 0],
    position: [0, 0, 0],
    target: [0, 0, 0],
    up: [0, 1, 0],
    galaxy: p < PHASE_FLASH_REBASE ? 1 : 0,
    planet: p >= PHASE_FLASH_REBASE ? 1 - smoothstep((p - 0.565) / 0.025) : 0,
    flash: envelope(
      progress,
      DESCENT_TIMING.lightStart,
      FLASH_REBASE,
      DESCENT_TIMING.lightEnd,
    ),
    solar: p < PHASE_FLASH_REBASE ? 0 : 1 - smoothstep((p - 0.45) / 0.07),
    sky: smoothstep((p - 0.56) / 0.055),
    clouds:
      smoothstep((p - 0.565) / 0.035) * (1 - smoothstep((p - 0.705) / 0.025)),
    cloudCover: cloudCover(progress),
    cloudOrigin: p < PHASE_CLOUD_REBASE ? [0, 0, 0] : [0, 9, endZ],
    cloudScale: p < PHASE_CLOUD_REBASE ? 0.01 : 1,
    surface:
      p < PHASE_CLOUD_REBASE ? 0 : smoothstep((p - PHASE_CLOUD_REBASE) / 0.025),
    surfaceY: 9,
    surfaceZ: 0,
    altitude: 0,
    depth: 0,
    submerged: 0,
    pelagic: smoothstep((p - 0.95) / 0.035),
    pointer:
      p < 0.08
        ? 1 - smoothstep(p / 0.08)
        : p > 0.985
          ? smoothstep((p - 0.985) / 0.015)
          : 0,
    worlds: { ocean: 1, router: 0, kona: 0, kattis: 0, aafc: 0 },
  }
  if (p < PHASE_FLASH_REBASE) {
    const start: Vec3 = [0, mobile ? 9.2 : 5.8, mobile ? 18 : 12]
    const aim: Vec3 = [mobile ? 0.4 : 1.5, 1, 0]
    // Enter a finite luminous core before the scale transfer. Near particles
    // stay bounded; the volumetric radiance owns the closest part of the shot.
    frame.position = path(
      [
        { at: 0.055, value: start },
        { at: 0.15, value: [core[0] * 0.4, core[1] + 2.5, mobile ? 12 : 8.4] },
        { at: 0.21, value: [core[0] * 0.85, core[1] + 1.2, 4.4] },
        { at: 0.235, value: [core[0], core[1] + 0.35, 1.6] },
        { at: 0.255, value: [core[0], core[1] + 0.12, 0.7] },
        { at: PHASE_FLASH_REBASE, value: [core[0], core[1], 0.05] },
      ],
      p,
    )
    frame.target = path(
      [
        { at: 0.055, value: aim },
        { at: 0.17, value: core },
        { at: PHASE_FLASH_REBASE, value: [core[0], core[1], -2] },
      ],
      p,
    )
    return frame
  }
  if (p < 0.58) {
    frame.position = path(
      [
        {
          at: PHASE_FLASH_REBASE,
          value: [mobile ? 4.5 : 11, mobile ? 9 : 6, mobile ? 56 : 46],
        },
        { at: 0.36, value: [mobile ? 3.2 : 8, 8, mobile ? 43 : 34] },
        { at: 0.46, value: [mobile ? 1.6 : 4, 9, mobile ? 26 : 21] },
        { at: 0.52, value: [0.8, 6.5, 9] },
        { at: 0.58, value: [0, 1.4, 0], tangent: [0, -17.5, 0] },
        // Ghost key supplies the derivative of the following radial descent.
        { at: 0.6, value: [0, 1.05, 0] },
      ],
      p,
    )
    frame.target = path(
      [
        { at: PHASE_FLASH_REBASE, value: [mobile ? 1.7 : 6, 0, 0] },
        { at: 0.4, value: [mobile ? 0.6 : 2, -2, 0] },
        { at: 0.5, value: [0, -0.25, 0] },
        { at: 0.58, value: [0, 0, 0] },
        { at: 0.6, value: [0, -1, 0] },
      ],
      p,
    )
    const up = (smoothstep((p - 0.49) / 0.07) * Math.PI) / 2
    frame.up = [0, Math.cos(up), -Math.sin(up)]
    return frame
  }
  const height =
    descentHeight(progress) +
    (mobile ? smoothstep((p - 0.94) / 0.06) * -0.3 : 0)
  frame.altitude = height
  frame.up = [0, 0, -1]
  if (p < PHASE_CLOUD_REBASE) {
    frame.position = [0, height * 0.01, 0]
    frame.target = [0, -1, 0]
    return frame
  }
  frame.position = [0, 9 + height, endZ]
  const pitch = smoothstep((p - 0.925) / 0.075)
  const endAngle = Math.atan2(endZ, endY - (mobile ? -0.8 : -0.5))
  const angle = pitch * endAngle
  frame.target = [
    0,
    frame.position[1] - (Math.cos(angle) * endZ) / Math.sin(endAngle),
    endZ - (Math.sin(angle) * endZ) / Math.sin(endAngle),
  ]
  frame.up = [0, Math.sin(angle), -Math.cos(angle)]
  const signed = height - waveHeight(0, endZ, time)
  frame.depth = Math.max(0, -signed)
  frame.submerged = 1 - smoothstep((signed + 0.22) / 0.44)
  frame.surface *= 1 - 0.65 * smoothstep((p - 0.96) / 0.04)
  return frame
}
