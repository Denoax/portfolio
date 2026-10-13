import { clamp } from './math'

// Position and physical pointer proximity are independent inputs. The compact
// cosine kernel has a zero derivative at its support edge and reverses cleanly.
export function fineTickWeight(position: number, coordinate: number) {
  const distance = Math.abs(position - coordinate) * 4
  return distance < 3 ? (1 + Math.cos((Math.PI * distance) / 3)) / 2 : 0
}
export function fineTickWidth(
  position: number,
  coordinate: number,
  pointerDistance: number,
  positionEnvelope = 1,
) {
  const positionWidth =
    10 + 12 * fineTickWeight(position, coordinate) * clamp(positionEnvelope)
  const hoverWidth = 10 + 22 * Math.max(0, 1 - Math.abs(pointerDistance) / 75)
  return Math.max(positionWidth, hoverWidth)
}
