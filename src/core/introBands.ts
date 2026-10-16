// One scale lattice owns the lettering; whitespace keeps its angular slots.
// Physical roles repeat after a complete period; travel itself remains unbounded.
export const INTRO_PHRASE = 'MANI MARAMI MILANI SELECT A PROJECT '
export const INTRO_GLYPHS = [...new Set(Array.from(INTRO_PHRASE))]
export const INTRO_MOTIFS = 2
export const INTRO_GLYPHS_PER_BAND = Array.from(INTRO_PHRASE).length * INTRO_MOTIFS
export const INTRO_LOG_GAP = 0.25
export const INTRO_ATLAS = Object.freeze({ columns: 4, rows: 4, cell: 256, fontPx: 192 })
export const INTRO_SECTION = Object.freeze({
  minCount: 16, minInkCss: 3, fullInkCss: 5, recyclePadding: 0.08, outerFadeOctaves: 0.75,
  initialLog: -4, spinBase: 0.010, spinStep: 0.001,
})
export const INTRO_FORMATION = Object.freeze({
  assemblyStart: 6, assemblyEnd: 18, sparseDensity: 0.18, revealWidth: 0.10,
  maxOffsetSlots: 0.24, strokeStart: 0.30, strokeEnd: 0.75,
})

// Persistent logical identity; release shuffle has its own independent seed.
export function introGlyphFormationSeed(logicalId: number) {
  const mix = (value: number) => {
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
    return (value ^ (value >>> 16)) >>> 0
  }
  return {
    rank: mix(logicalId + 1) / 2 ** 32,
    offsetSlots: (mix(logicalId + 104729) / 2 ** 32 * 2 - 1) * INTRO_FORMATION.maxOffsetSlots,
  }
}


export function introBandLayout(
  width: number,
  height: number,
  advance: number,
  inkHeight: number,
  cell: number,
) {
  const minimum = Math.min(width, height)
  const pitch = (Math.PI * 2) / INTRO_GLYPHS_PER_BAND
  // Actual font advance, not atlas-cell width, determines optical tracking.
  const quadFactor = (pitch * 0.8 * cell) / advance
  const inkFactor = (quadFactor * inkHeight) / cell
  const corner = Math.hypot(width / 2, height * 0.525) / minimum
  // Include the complete rotated quad and maximum existing ripple displacement.
  const outerSupportLog = Math.log2((corner + 0.12) / (1 - quadFactor / Math.SQRT2 - 0.06)) + 0.02
  // Populate the complete depth period at the same spacing, including its seam.
  // Recycle only outside visible support; a partial final interval leaves a
  // conspicuous empty annulus as it travels through the viewport.
  const lower = Math.log2(INTRO_SECTION.minInkCss / (minimum * inkFactor)) - 0.02
  const count = Math.max(INTRO_SECTION.minCount,
    Math.ceil((outerSupportLog - lower + INTRO_SECTION.recyclePadding) / INTRO_LOG_GAP))
  const depthPeriod = count * INTRO_LOG_GAP
  const sectionSpan = (count - 1) * INTRO_LOG_GAP
  // BigInt travel retains an integer logical period, mapped linearly to depth.
  const period = Math.ceil(depthPeriod)
  const upper = lower + depthPeriod
  const initialOffset = INTRO_SECTION.initialLog - lower
  return { lower, upper, period, depthPeriod, initialOffset, outerSupportLog,
    sectionSpan, count,
    glyphsPerBand: INTRO_GLYPHS_PER_BAND, pitch, advance, inkHeight, quadFactor,
    corner, innerInkPixels: 2 ** lower * minimum * inkFactor }
}

export function introBandRadius(role: number, zoom: number, lower: number, period: number) {
  return 2 ** (lower + (((role * INTRO_LOG_GAP + zoom) % period) + period) % period)
}

export function introSectionProjection(logicalZoom: number, layout: ReturnType<typeof introBandLayout>) {
  return layout.initialOffset + logicalZoom * layout.depthPeriod / layout.period
}
