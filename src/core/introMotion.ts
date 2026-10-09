import { advanceZoom, boundedZoom } from './introZoom'
import type { MenuPresentation } from './menuReel'

// Both input and Reset are requests. Only the active intro frame owner advances
// the displayed state; interruptions therefore start at the visible position.
export function stepIntroZoom(
  intro: MenuPresentation['intro'],
  seconds: number,
) {
  if (intro.zoomReset) {
    intro.zoomReset = false
    intro.zoomDelta = 0
    intro.resetActive = true
    intro.resetDistance = ((-boundedZoom(intro.zoom) + 9) % 6) - 3
  }
  if (intro.resetActive && intro.zoomDelta !== 0) intro.resetActive = false
  const distance = intro.resetActive ? intro.resetDistance : intro.zoomDelta
  const omega = intro.resetActive ? 18 : 14
  const error = -distance
  const c = intro.zoomVelocity + omega * error
  const decay = Math.exp(-omega * seconds)
  const step = distance + (error + c * seconds) * decay
  intro.zoomVelocity = (intro.zoomVelocity - omega * c * seconds) * decay
  intro.zoom = advanceZoom(intro.zoom, step)
  if (intro.resetActive) {
    intro.resetDistance -= step
    if (
      Math.abs(intro.resetDistance) < 1e-5 &&
      Math.abs(intro.zoomVelocity) < 1e-4
    ) {
      intro.zoom = { octave: 0n, phase: 0 }
      intro.resetActive = false
      intro.resetDistance = 0
      intro.zoomVelocity = 0
    }
  } else intro.zoomDelta -= step
}
export function hintOpacity(age: number) {
  const smooth = (x: number) => {
    x = Math.max(0, Math.min(1, x))
    return x * x * (3 - 2 * x)
  }
  if (age < 0.45) return 0
  if (age < 1.65) return smooth((age - 0.45) / 1.2)
  if (age < 3.85) return 1
  return 1 - smooth((age - 3.85) / 1.8)
}
