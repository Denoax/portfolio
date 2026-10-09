export interface PanelPoint {
  x: number
  y: number
}
// Map the CSS rectangle onto the scene's projected four corners. A bounding
// rectangle loses perspective, so both custom content and hit surfaces use this.
export function panelTransform(
  points: readonly PanelPoint[],
  width: number,
  height: number,
) {
  const [p0, p1, p2, p3] = points
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y
  const denominator = dx1 * dy2 - dx2 * dy1
  const g =
    Math.abs(denominator) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / denominator
  const h =
    Math.abs(denominator) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / denominator
  const a = p1.x - p0.x + g * p1.x,
    b = p3.x - p0.x + h * p3.x
  const d = p1.y - p0.y + g * p1.y,
    e = p3.y - p0.y + h * p3.y
  return `matrix3d(${[a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, 1, 0, p0.x, p0.y, 0, 1].join(',')})`
}
