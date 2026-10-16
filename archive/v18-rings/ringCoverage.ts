// Dimensionless coverage owns every family over the same six-octave cycle.
// No mode/ring-ID exceptions or input-driven geometry construction.
export const ringRadius = (base: number, zoom: number) =>
  2 ** (((((Math.log2(base) + zoom + 5) % 6) + 6) % 6) - 5)
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export function primaryCoverage(radius: number, count: number, glyph: number) {
  const spacing = (2 * Math.PI * radius) / count
  return 1 - smooth(1.6, 2.4, spacing / (glyph * 0.62))
}
export function fillerCoverage(radius: number, nearest: number, glyph: number) {
  return (
    smooth(1.1, 1.7, nearest / glyph) *
    (0.24 + 0.76 * (1 - smooth(0.07, 0.13, nearest / Math.max(radius, 0.001))))
  )
}
