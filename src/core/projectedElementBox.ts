export type PlaneMatrix = [number, number, number, number, number, number, number, number, number]
interface Bounds {
  left: number
  top: number
}

// Recover the fractional child origin from its painted bounds. offsetLeft/Top
// are integer CSS pixels, which is enough to identify the extreme corners but
// not enough to register a thin lens/perimeter against a projected button.
export function fitProjectedBox(
  matrix: PlaneMatrix,
  width: number,
  height: number,
  bounds: Bounds,
  approximateX: number,
  approximateY: number,
): PlaneMatrix {
  const [a, b, c, d, e, f, g, h, i] = matrix
  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  const points = corners.map(([cx, cy]) => {
    const x = approximateX + cx,
      y = approximateY + cy,
      w = g * x + h * y + i
    return [(a * x + b * y + c) / w, (d * x + e * y + f) / w]
  })
  const leftCorner = points.reduce((best, point, index) => point[0] < points[best][0] ? index : best, 0)
  const topCorner = points.reduce((best, point, index) => point[1] < points[best][1] ? index : best, 0)
  const [cx, cy] = corners[leftCorner], [dx, dy] = corners[topCorner]
  const aa = a - bounds.left * g,
    ab = b - bounds.left * h,
    ba = d - bounds.top * g,
    bb = e - bounds.top * h
  const ac = bounds.left * (i + g * cx + h * cy) - a * cx - b * cy - c
  const bc = bounds.top * (i + g * dx + h * dy) - d * dx - e * dy - f
  const determinant = aa * bb - ab * ba
  const x = Math.abs(determinant) < 1e-10 ? approximateX : (ac * bb - ab * bc) / determinant
  const y = Math.abs(determinant) < 1e-10 ? approximateY : (aa * bc - ac * ba) / determinant
  return [a, b, a * x + b * y + c, d, e, d * x + e * y + f, g, h, g * x + h * y + i]
}

// The menu text owns an explicit screen-space homography. Its real child
// buttons must use that same plane, including perspective and fractional size.
// Ordinary panes and the protected world keep their existing rectangle path.
export function projectedActionBox(
  element: HTMLElement,
  style = getComputedStyle(element),
  bounds = element.getBoundingClientRect(),
) {
  if (!element.matches('.menu-actions > .ui-action')) return null
  const owner = element.closest<HTMLElement>('.menu-project')
  if (!owner || !owner.style.transform || owner.style.transform === 'none') return null
  const borderBox = style.boxSizing === 'border-box'
  const width = parseFloat(style.width) + (borderBox ? 0 :
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth))
  const height = parseFloat(style.height) + (borderBox ? 0 :
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth))
  if (!(width > 0 && height > 0)) return null
  let x = element.offsetLeft, y = element.offsetTop
  let parent = element.offsetParent as HTMLElement | null
  while (parent && parent !== owner) {
    x += parent.offsetLeft
    y += parent.offsetTop
    parent = parent.offsetParent as HTMLElement | null
  }
  const m = new DOMMatrixReadOnly(owner.style.transform)
  const matrix: PlaneMatrix = [m.m11, m.m21, m.m41, m.m12, m.m22, m.m42, m.m14, m.m24, m.m44]
  return { width, height, matrix: fitProjectedBox(matrix, width, height, bounds, x, y) }
}
