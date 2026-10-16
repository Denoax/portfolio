import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Exercise the production layout, projection, geometry and transport. This does
// not recreate the shader's reveal curve or treat model checks as visual proof.
const out = process.env.OUT || 'showcase/intro-motion-followup/model'
const hashes = {}, modules = new Map()
async function load(path) {
  path = resolve(path)
  if (modules.has(path)) return modules.get(path)
  const input = await readFile(path, 'utf8')
  hashes[path.replace(resolve('.') + '/', '')] = createHash('sha256').update(input).digest('hex')
  let code = ts.transpileModule(input, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText
  for (const match of [...code.matchAll(/from\s+(['"])([^'"]+)\1/g)]) {
    const child = match[2] === 'three'
      ? pathToFileURL(resolve('node_modules/three/build/three.module.js')).href
      : await load(resolve(dirname(path), match[2] + '.ts'))
    code = code.replace(match[0], `from ${JSON.stringify(child)}`)
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  modules.set(path, url)
  return url
}
const bands = await import(await load('src/core/introBands.ts'))
const coordinates = await import(await load('src/core/introZoom.ts'))
const motion = await import(await load('src/core/introMotion.ts'))
const ripple = await import(await load('src/core/introRipples.ts'))
const { INTRO_SECTION: section, INTRO_PHRASE, INTRO_GLYPHS, INTRO_GLYPHS_PER_BAND,
  INTRO_LOG_GAP, introBandRadius, introSectionProjection } = bands
assert(section && Object.isFrozen(section), 'The bounded lettering field needs one immutable production policy')
assert.equal(typeof introSectionProjection, 'function')
assert.equal(section.minCount, 16)
assert(section.minInkCss > 0 && section.fullInkCss > section.minInkCss)
assert(section.recyclePadding > 0, 'Per-ring reuse needs invisible support beyond the viewport')
assert(section.outerFadeOctaves > INTRO_LOG_GAP,
  'Returning outer rings need a gradual depth fade spanning multiple neighbouring arrivals')
assert.equal(section.gapOctaves, undefined, 'The superseded whole-field empty interval must not remain active')
assert(motion.INTRO_AUTO_RATE > 0 && motion.INTRO_AUTO_RATE < .075,
  'Automatic radial speed must be materially slower than the rejected .1 octaves/s')
assert.equal(INTRO_PHRASE, 'MANI MARAMI MILANI SELECT A PROJECT ')
assert(!/ {2,}/u.test(INTRO_PHRASE), 'Identity/project and loop seams must not reserve oversized blank word slots')
assert(!INTRO_GLYPHS.includes('·') && !INTRO_GLYPHS.includes('.'))
const phrase = Array.from(INTRO_PHRASE)
const inkPerBand = phrase.filter(glyph => glyph !== ' ').length * 2
const near = (actual, expected, tolerance = 1e-9, label = '') =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} differs from ${expected}`)
const fixture = () => ({ zoom: { octave: 0n, phase: 0 }, loopPeriod: 10,
  transport: motion.createIntroTransport(), zoomDelta: 0, zoomReset: false,
  zoomVelocity: 0, resetActive: false, resetDistance: 0, holding: false,
  paused: false, exiting: false, inputBlocked: false, ripples: ripple.createIntroRipples(), elapsed: 0 })
const advance = (intro, seconds, hz = 120) => {
  const ticks = Math.round(seconds * hz)
  for (let tick = 0; tick < ticks; tick++) motion.stepIntroZoom(intro, 1 / hz)
}

// A construction-only canvas boundary is sufficient for real instance buffers.
// Native font/atlas pixels and display composition require the browser evidence.
globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return { width: 0, height: 0 } } }
const { Ringwriter } = await import(await load('src/experience/hub/Ringwriter.ts'))
const ringwriter = new Ringwriter(), rows = []
for (const [width, height] of [[1889, 972], [1440, 900], [390, 844], [1440, 480],
  [320, 568], [320, 320], [768, 768]]) {
  ringwriter.update(0, width, height, 1, { active: false, ripples: ripple.createIntroRipples() }, false)
  const geometry = ringwriter.mesh.geometry, attributes = geometry.attributes
  const layout = ringwriter.mesh.userData.introBands, minimum = Math.min(width, height)
  assert(Number.isInteger(layout.count) && layout.count >= section.minCount && layout.count <= 64,
    'The viewport needs bounded adaptive ring roles above the minimum count')
  assert(Number.isSafeInteger(layout.period) && layout.period > 0, 'BigInt projection retains an integer logical period')
  assert(Number.isFinite(layout.depthPeriod) && layout.depthPeriod > 0)
  near(layout.depthPeriod, layout.count * INTRO_LOG_GAP, 1e-9,
    `${width}x${height}: every gap, including the wrap, must use the canonical spacing`)
  assert(layout.depthPeriod >= layout.outerSupportLog - layout.lower + section.recyclePadding,
    'Adaptive count must reach the complete invisible outer reuse support')
  near(layout.sectionSpan, (layout.count - 1) * INTRO_LOG_GAP)
  assert.equal(layout.period, Math.ceil(layout.depthPeriod))
  near(ringwriter.material.uniforms.uPeriod.value, layout.depthPeriod)
  near(ringwriter.material.uniforms.uOuterSupportLog.value, layout.outerSupportLog)
  assert.deepEqual(layout.section, section)
  assert.equal(geometry.instanceCount, layout.count * inkPerBand)
  assert.equal(attributes.aKind, undefined)
  const logs = new Set(), speeds = new Set()
  for (let instance = 0; instance < geometry.instanceCount; instance++) {
    const index = attributes.aIndex.getX(instance)
    const role = Math.floor(index / INTRO_GLYPHS_PER_BAND)
    const slot = index % INTRO_GLYPHS_PER_BAND
    const glyph = INTRO_GLYPHS[attributes.aChar.getX(instance)]
    assert(role >= 0 && role < layout.count)
    assert.equal(glyph, phrase[slot % phrase.length])
    assert.notEqual(glyph, ' ', 'Whitespace preserves logical slots without drawable quads')
    near(attributes.aLog.getX(instance), role * INTRO_LOG_GAP, 1e-7)
    const expectedSpeed = (role % 2 ? -1 : 1) * (section.spinBase + role * section.spinStep)
    near(attributes.aSpeed.getX(instance), expectedSpeed, 1e-8)
    assert(Math.abs(expectedSpeed) <= .05, 'Adaptive-ring spin must remain substantially slower than the rejected field')
    logs.add(attributes.aLog.getX(instance)); speeds.add(attributes.aSpeed.getX(instance))
  }
  assert.equal(logs.size, layout.count)
  const inkFactor = layout.quadFactor * layout.inkHeight / bands.INTRO_ATLAS.cell
  const active = phase => Array.from({ length: layout.count }, (_, role) => {
    const radius = introBandRadius(role, phase, layout.lower, layout.depthPeriod)
    const inkCss = radius * inkFactor * minimum
    // Conservative complete-quad support, including existing scatter and
    // inward pointer displacement. The minimum CSS gate is an exact zero.
    const nearest = radius * (1 - .035 - layout.quadFactor / Math.SQRT2) - .018 * (.5 + radius)
    return { role, radius, log: Math.log2(radius), inkCss,
      possibleInk: inkCss > section.minInkCss && nearest <= layout.corner }
  }).filter(row => row.possibleInk)
  const samples = 16384, step = layout.depthPeriod / samples
  const supportCounts = Array.from({ length: samples }, (_, index) => active(index * step).length)
  assert(Math.min(...supportCounts) > 0,
    'Ring returns must overlap existing visible support instead of scheduling a whole-field empty interval')
  const returns = []
  for (let role = 0; role < layout.count; role++) {
    // Select poses from real production depth parameters. Checking support and
    // ordering here does not approximate the shader arrival alpha curve.
    const projected = layout.outerSupportLog - section.outerFadeOctaves * .5 - layout.lower - role * INTRO_LOG_GAP
    const returning = active(projected).find(row => row.role === role)
    const existing = active(projected).filter(row => row.role !== role)
    assert(existing.length > 0, 'Each outer return must overlap another ring in the existing field')
    const actualDepth = Math.log2(introBandRadius(role, projected, layout.lower, layout.depthPeriod))
    near(actualDepth, layout.outerSupportLog - section.outerFadeOctaves * .5)
    assert(actualDepth > layout.outerSupportLog - section.outerFadeOctaves && actualDepth < layout.outerSupportLog)
    returns.push({ role, projected, actualDepth, returningHasViewportSupport: !!returning,
      otherSupportRoles: existing.map(row => row.role) })
  }
  const innerRadius = introBandRadius(0, 0, layout.lower, layout.depthPeriod)
  assert(innerRadius * inkFactor * minimum < section.minInkCss,
    'A reused ring must be exactly below the CSS ink gate at the inner seam')
  const outerRadius = 2 ** (layout.lower + layout.depthPeriod)
  const outerNearest = outerRadius * (1 - .035 - layout.quadFactor / Math.SQRT2) - .018 * (.5 + outerRadius)
  assert(outerNearest > layout.corner, 'The other side of each ring reuse must be completely offscreen')
  const birthSpacingSeconds = INTRO_LOG_GAP * layout.period / layout.depthPeriod / motion.INTRO_AUTO_RATE
  const outerFadeSeconds = section.outerFadeOctaves * layout.period / layout.depthPeriod / motion.INTRO_AUTO_RATE
  assert(birthSpacingSeconds > 3 && birthSpacingSeconds < 7, 'Neighbouring outer arrivals must be paced in seconds')
  assert(outerFadeSeconds > birthSpacingSeconds * 2, 'Outer appearance must extend across neighbouring ring arrivals')
  // A portrait guard can place a newly added inner logical role below the
  // minimum readable scale; its bounded physical role has already recycled.
  near(layout.lower + introSectionProjection(0, layout), section.initialLog)
  for (let role = 4; role < 16; role++) near(Math.log2(introBandRadius(role,
    introSectionProjection(0, layout), layout.lower, layout.depthPeriod)), -3 + (role - 4) * INTRO_LOG_GAP,
    1e-9, 'The liked twelve-ring outer extent must survive with four new inner rings')
  for (const zoom of [-1234.125, -layout.period - 1e-7, -1e-7, 0, .125, layout.period - 1e-7]) {
    const projected = introSectionProjection(zoom, layout)
    const exponents = Array.from({ length: layout.count }, (_, role) => {
      const radius = introBandRadius(role, projected, layout.lower, layout.depthPeriod)
      for (const direction of [-1, 1]) near(radius, introBandRadius(role,
        introSectionProjection(zoom + direction * layout.period, layout), layout.lower, layout.depthPeriod), 1e-9)
      return Math.log2(radius)
    }).sort((first, second) => first - second)
    const gaps = exponents.map((log, index) => index === exponents.length - 1
      ? exponents[0] + layout.depthPeriod - log : exponents[index + 1] - log)
    for (const gap of gaps) near(gap, INTRO_LOG_GAP, 1e-8,
      'No phase may expose an oversized empty annulus or a compressed wrap seam')
  }
  for (const whole of [10n ** 100n, -(10n ** 100n), (2n ** 512n) + 37n]) {
    const pose = { octave: whole, phase: .125 }
    const bounded = coordinates.boundedZoom(pose, layout.period)
    for (const direction of [-1, 1]) near(coordinates.boundedZoom(
      coordinates.advanceZoom(pose, direction * layout.period), layout.period), bounded, 1e-9)
  }
  // Real controller remains stationary at the current section pose and resumes
  // once after a deliberate release. No independent section clock exists.
  const intro = fixture()
  intro.loopPeriod = layout.period
  const token = motion.beginIntroGesture(intro)
  assert.notEqual(token, null)
  advance(intro, .4)
  assert.equal(intro.transport.state, 'HELD')
  const held = structuredClone(intro.zoom), angular = intro.transport.angularTime
  advance(intro, 2)
  assert.deepEqual(intro.zoom, held)
  assert.equal(intro.transport.angularTime, angular)
  assert(active(introSectionProjection(coordinates.boundedZoom(held, layout.period), layout)).length > 0)
  assert.equal(motion.releaseIntroGesture(intro, token, .4, false, true), 'reverse')
  advance(intro, 1.2)
  assert.equal(intro.transport.state, 'AUTO_IN')
  assert.equal(intro.transport.lastDirection, 1)
  assert.equal(intro.transport.committedToken, token)
  assert(intro.zoomVelocity > 0)
  assert.equal(motion.releaseIntroGesture(intro, token, .4, false, true), 'ignored')
  // Test the actual angular wrapping path using every production spin speed.
  const spin = fixture()
  spin.zoomVelocity = -motion.INTRO_AUTO_RATE
  spin.transport.angularTime = .01
  const previous = spin.transport.angularTime
  motion.stepIntroZoom(spin, .02)
  assert(spin.transport.angularTime > 6000, 'The fixture must actually cross the bounded angular seam')
  for (const speed of speeds) {
    const expected = speed * (previous - .02)
    const actual = speed * spin.transport.angularTime
    near(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)), 0, 1e-5,
      'Bounded angular phase cannot cause a visible rotation jump')
  }
  rows.push({ width, height, layout, instances: geometry.instanceCount, spinRadiansPerSecond: [...speeds],
    minimumPossibleInkSupportRings: Math.min(...supportCounts), maximumPossibleInkSupportRings: Math.max(...supportCounts),
    birthSpacingSeconds, outerFadeSeconds, returns, outerReuseMarginCssPx: (outerNearest - layout.corner) * minimum,
    heldOverlapReversal: 'PASS' })
}
ringwriter.dispose()
await mkdir(out, { recursive: true })
await writeFile(`${out}/results.json`, JSON.stringify({ status: 'PASS', sourceHashes: hashes,
  section, automaticLogicalOctavesPerSecond: motion.INTRO_AUTO_RATE, rows,
  scope: 'Actual production adaptive projection, geometry attributes and state controller; every real radius gap including the wrap is exactly the canonical .25 octaves, with bounded viewport-dependent ring count. Conservative complete-quad bounds identify overlapping support throughout the period and invisible individual-ring reuse. Actual pose-selected outer fade ranges overlap the existing field. This does not duplicate shader formation/arrival/reveal alpha, prove pixel coverage, inspect native raster pixels or establish visual approval. Canvas construction uses fallback font metrics; real native-font bounds, transition pixels, input and normal-speed motion require browser evidence.' }, null, 2) + '\n')
console.log('PASS adaptive complete lattice, actual instance slots, overlapping arrivals, invisible per-ring reuse, bounded phase and held reversal', rows.length)
