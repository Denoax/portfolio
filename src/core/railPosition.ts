// Measured major centers define the displayed fractional project location.
export function railPosition(coordinate: number, centers: readonly number[]) {
  if (centers.length < 2 || !Number.isFinite(coordinate)) return centers[0] ?? 0
  const position = Math.max(0, Math.min(centers.length - 1, coordinate))
  const index = Math.floor(position)
  return (
    centers[index] +
    (position - index) *
      ((centers[index + 1] ?? centers[index]) - centers[index])
  )
}
