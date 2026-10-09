import { clamp, smoothstep } from './math'
// The retained 72s tour spends >1 second crossing mandatory cloud cover.
export function tourState(time: number) {
  return smoothstep(clamp(time))
}
export function tourTime(state: number) {
  let low = 0,
    high = 1
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (tourState(mid) < clamp(state)) low = mid
    else high = mid
  }
  return (low + high) / 2
}
