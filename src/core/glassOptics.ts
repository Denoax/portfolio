export interface GlassOptics {
  radius: number
  bevel: number
  magnification: number
  bend: number
  fringe: number
  roughness: number
}
export function glassOptics(
  width: number,
  height: number,
  radius: number,
  pane: boolean,
  nested = false,
): GlassOptics {
  const fittedRadius = Math.max(0, Math.min(radius, width / 2, height / 2))
  return {
    radius: fittedRadius,
    bevel: Math.max(1, Math.min(pane ? 28 : 9, fittedRadius * 0.85)),
    magnification: pane ? 1.095 : nested ? 1.025 : 1.018,
    bend: pane ? 0.19 : 0.15,
    fringe: pane ? 0.25 : 0.12,
    roughness: pane ? 0.45 : 0.2,
  }
}
// Identical rounded lens map for GPU backdrop and native substrate. The
// bounded rim derivative stays below the affine derivative, avoiding folds.
export function glassDisplacement(
  x: number,
  y: number,
  width: number,
  height: number,
  profile: GlassOptics,
) {
  const lx = x - width / 2,
    ly = y - height / 2
  const qx = Math.abs(lx) - width / 2 + profile.radius
  const qy = Math.abs(ly) - height / 2 + profile.radius
  const distance =
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    profile.radius
  const rim = Math.max(0, Math.min(1, 1 + distance / profile.bevel))
  const shift = profile.bevel * profile.bend * rim * rim * (3 - 2 * rim)
  let nx = 0,
    ny = 0
  if (qx > 0 && qy > 0) {
    const length = Math.hypot(qx, qy)
    nx = (qx / length) * Math.sign(lx)
    ny = (qy / length) * Math.sign(ly)
  } else if (qx > qy) nx = Math.sign(lx)
  else ny = Math.sign(ly)
  return {
    x: lx / profile.magnification - lx - nx * shift,
    y: ly / profile.magnification - ly - ny * shift,
  }
}
