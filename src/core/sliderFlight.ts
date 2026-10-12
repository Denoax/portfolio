export interface SliderPoint {
  x: number
  y: number
}
export interface SliderFlight {
  start: SliderPoint
  target: number
  duration: number
  vx: number
  vy: number
}
export const sliderValue = (position: number, min: number, max: number) =>
  Math.round(min + Math.max(0, Math.min(1, position)) * (max - min))
const GRAVITY = 16

// Independent ballistic implementation inferred from the inspected creator
// frames. Coordinates are fractions of the actual rail, not screen constants.
export function predictSliderFlight(
  anchor: SliderPoint,
  release: SliderPoint,
): SliderFlight {
  const start = {
    // Signed endpoint displacement is release energy, not a legal value.
    x: Math.max(-0.6, Math.min(1.6, release.x)),
    y: Math.max(-0.6, Math.min(0.6, release.y)),
  }
  const vy = -18 * start.y
  const discriminant = vy * vy - 2 * GRAVITY * start.y
  const duration = Math.max(
    0.12,
    Math.min(
      0.48,
      discriminant >= 0 ? (-vy + Math.sqrt(discriminant)) / GRAVITY : 0.12,
    ),
  )
  const target = Math.max(
    0,
    Math.min(1, start.x - 18 * (start.x - anchor.x) * duration),
  )
  // Recompute velocities after bounds so the dots and handle land exactly at
  // the real value, including a clamped endpoint; they never predict off-rail.
  return {
    start,
    target,
    duration,
    vx: (target - start.x) / duration,
    vy: (-start.y - (GRAVITY * duration * duration) / 2) / duration,
  }
}
export function sliderFlightPoint(
  flight: SliderFlight,
  fraction: number,
): SliderPoint {
  const t = Math.max(0, Math.min(1, fraction)) * flight.duration
  return {
    x: flight.start.x + flight.vx * t,
    y: flight.start.y + flight.vy * t + (GRAVITY * t * t) / 2,
  }
}
