import { clamp, smoothstep } from './math'
import { evaluateDescent } from './descent'
export { waveHeight } from './ocean'

export type Vec3 = [number, number, number]
export type WorldId = 'ocean' | 'router' | 'kona' | 'kattis' | 'aafc'
export type ShotId =
  | 'S01'
  | 'S02'
  | 'S03'
  | 'S04'
  | 'S05'
  | 'S06'
  | 'S07'
  | 'S08'
  | 'S09'
  | 'S10'
  | 'S11'
  | 'S12'
  | 'S13'
export interface JourneyFrame {
  shot: ShotId
  local: number
  position: Vec3
  up: Vec3
  flash: number
  solar: number
  sky: number
  altitude: number
  cloudOrigin: Vec3
  cloudScale: number
  target: Vec3
  worldCenters: Record<WorldId, Vec3>
  oceanCenter: Vec3
  galaxy: number
  planet: number
  clouds: number
  cloudCover: number
  surface: number
  surfaceZ: number
  depth: number
  surfaceY: number
  submerged: number
  pelagic: number
  pointer: number
  worlds: Record<WorldId, number>
}
export const WORLD_CENTERS: Record<WorldId, Vec3> = {
  ocean: [0, -5, 0],
  router: [32, 1, -20],
  kona: [65, 2, -12],
  kattis: [96, -2, -27],
  aafc: [128, -5, -4],
}
// Portrait travel is a rising diagonal constellation, composed for a narrow
// frustum. Destinations share this map with the camera, so no overlay fakes it.
const PORTRAIT_CENTERS: Record<WorldId, Vec3> = {
  ocean: [0, -5, 0],
  router: [8, 10, -20],
  kona: [16, 25, -12],
  kattis: [24, 40, -27],
  aafc: [32, 55, -4],
}
export const worldCenters = (mobile: boolean) =>
  mobile ? PORTRAIT_CENTERS : WORLD_CENTERS
export const shotSamples = [
  ['S01', 0],
  ['S02', 0.29],
  ['S03', 0.445],
  ['S04', 0.615],
  ['S05', 0.742],
  ['S06', 1],
] as const
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
]
// V8 retains the original descent evaluator and cannot enter archived departure
// or later-world camera branches, even through malformed/debug input.
export function evaluateJourney(
  state: number,
  mobile = false,
  short = false,
  time = 0,
): JourneyFrame {
  return evaluateDescent(
    Number.isFinite(state) ? clamp(state, 0, 1) : 0,
    mobile,
    short,
    time,
    worldCenters(mobile),
  )
}
export function contentPresence(index: number, state: number) {
  return index === 0
    ? 1 - smoothstep(state / 0.12)
    : smoothstep((state - 0.94) / 0.04)
}
