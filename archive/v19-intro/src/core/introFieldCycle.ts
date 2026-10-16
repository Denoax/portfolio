// An authored six-octave visual cycle, driven by the displayed logical zoom.
// The geometry recedes, changes travel direction under darkness, then approaches.
// Logical BigInt input and Reset retain their original unbounded owner.
export function introFieldCycle(displayedZoom: number) {
  const phase = ((-displayedZoom % 6) + 6) % 6
  const distance = Math.min(phase, 6 - phase)
  const t = Math.min(1, Math.max(0, (distance - 1.25) / 1.15))
  const curtain = t * t * (3 - 2 * t)
  return {
    phase,
    artworkZoom: -3 * Math.sin((Math.PI * phase) / 6) ** 2,
    opacity: 1 - curtain,
    curtain,
  }
}
