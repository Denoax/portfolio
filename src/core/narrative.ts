import { evaluateJourney } from './journey'
export const narrative = {
  target: 0,
  progress: 0,
  state: 0,
  velocity: 0,
  active: 0,
  reducedMotion: false,
  fallback: false,
  elapsed: 0,
  frame: evaluateJourney(0),
}

export { clamp, smoothstep } from './math'
