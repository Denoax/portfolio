const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value))
  return x * x * (3 - 2 * x)
}

// The displayed physical gap owns both paint and exposed corners. A bridge
// grows from zero area inside the existing tile bodies; at contact it covers
// their corner cutouts before any internal radius is flattened.
export function navConnection(
  gap: number,
  height: number,
  radius: number,
  span: number,
) {
  if (
    ![gap, height, radius, span].every(Number.isFinite) ||
    height <= 0 ||
    span <= 0
  )
    return { path: '', corner: Math.max(0, radius || 0), coverage: 0 }
  const r = Math.max(0, Math.min(radius, height / 2))
  const coverage = 1 - smooth(Math.max(0, gap) / (span * 0.22))
  const corner = r * smooth(gap + 1)
  if (coverage === 0) return { path: '', corner, coverage }
  const overlap = r * coverage + 0.35 * coverage
  const left = -gap - overlap,
    right = overlap,
    middle = -gap / 2
  const top = height * 0.5 * (1 - coverage)
  const pinch = height * 0.5 * (1 - coverage * coverage)
  const control = (right - left) * 0.2
  const path = `M${left} ${top} C${left + control} ${top} ${middle - control} ${pinch} ${middle} ${pinch} C${middle + control} ${pinch} ${right - control} ${top} ${right} ${top} L${right} ${height - top} C${right - control} ${height - top} ${middle + control} ${height - pinch} ${middle} ${height - pinch} C${middle - control} ${height - pinch} ${left + control} ${height - top} ${left} ${height - top} Z`
  return { path, corner, coverage }
}
