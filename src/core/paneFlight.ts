export interface Point2 {
  x: number
  y: number
}
export interface FlightRect {
  x: number
  y: number
  width: number
  height: number
}
export interface TileFlight {
  rect: FlightRect
  anchor: Point2
  opening: boolean
  progress: number
  duration: number
  viewportWidth?: number
}
const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}
export function tileSeed(index: number) {
  const fract = (n: number) => n - Math.floor(n)
  return {
    x: fract(Math.sin((index + 1) * 127.1) * 43758.5453),
    y: fract(Math.sin((index + 1) * 311.7) * 22578.1459),
  }
}
// CPU retarget sampling and the instanced shader use this same trajectory.
// Actual tile positions/velocities survive interruption; no seed is restarted.
export function paneTilePoint(
  flight: TileFlight,
  uv: Point2,
  seed: Point2,
  from: Point2,
  velocity: Point2,
): Point2 {
  const t = Math.max(0, Math.min(1, flight.progress)),
    r = flight.rect
  const target = { x: r.x + uv.x * r.width, y: r.y + uv.y * r.height }
  const viewport = flight.viewportWidth ?? 1e6,
    fanWidth = Math.min(r.width * 1.32, viewport * 0.92)
  const fanCenter = Math.max(
    fanWidth / 2 + 8,
    Math.min(viewport - fanWidth / 2 - 8, flight.anchor.x),
  )
  const fan = {
    x:
      fanCenter +
      (uv.x - 0.5) * fanWidth * (1 - uv.y * 0.1) +
      (seed.x - 0.5) * 18,
    y:
      flight.anchor.y +
      18 +
      (0.08 + uv.y * 0.92) *
        (1 - Math.abs((uv.x - 0.5) * 2) * 0.85) *
        Math.min(r.height * 0.42, 205) +
      (seed.y - 0.5) * 28,
  }
  let x: number, y: number
  if (flight.opening) {
    const fanMix = smooth(t / 0.28),
      settle = smooth((t - (0.22 + uv.y * 0.43 + seed.y * 0.08)) / 0.2)
    x = (from.x + (fan.x - from.x) * fanMix) * (1 - settle) + target.x * settle
    y = (from.y + (fan.y - from.y) * fanMix) * (1 - settle) + target.y * settle
  } else {
    const burst = smooth(t / 0.36),
      retract = smooth((t - 0.34) / 0.66)
    x =
      (from.x +
        (fan.x - from.x) * burst +
        (seed.x - 0.5) * r.width * 0.32 * Math.sin(Math.PI * t)) *
        (1 - retract) +
      flight.anchor.x * retract
    y =
      (from.y +
        (fan.y - from.y) * burst +
        (seed.y - 0.5) * 50 * Math.sin(Math.PI * t)) *
        (1 - retract) +
      flight.anchor.y * retract
  }
  const momentum = t * flight.duration * Math.pow(1 - t, 2)
  return { x: x + velocity.x * momentum, y: y + velocity.y * momentum }
}
export function paneNativeFront(progress: number, opening: boolean, from = 0) {
  return opening
    ? from + (1 - from) * Math.max(0, Math.min(1, (progress - 0.5) / 0.43))
    : 0
}
export function paneFlightOpacity(
  progress: number,
  opening: boolean,
  from: number,
) {
  return opening
    ? from + (1 - from) * smooth(progress / 0.05)
    : from * (1 - smooth((progress - 0.9) / 0.1))
}
