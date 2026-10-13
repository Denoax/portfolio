import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const out = process.env.EVIDENCE_OUT || 'showcase/v24-evidence'
await mkdir(out, { recursive: true })
const bundled = await build({
  stdin: {
    contents:
      "export * from './src/core/fineTickWave';export * from './src/core/pairedReel';export * from './src/core/paneFlight';export * from './src/core/glassOptics';export * from './src/core/experienceSettings'",
    loader: 'ts',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
})
const m = await import(
    'data:text/javascript;base64,' +
      Buffer.from(bundled.outputFiles[0].text).toString('base64')
  ),
  rows = []
assert.equal(m.fineTickWeight(0.25, 0.25), 1)
assert(Math.abs(m.fineTickWeight(0.25, 0.5) - 0.75) < 1e-12)
assert(Math.abs(m.fineTickWeight(0.25, 0.75) - 0.25) < 1e-12)
assert.equal(m.fineTickWeight(0.25, 1), 0)
assert(Math.abs(m.fineTickWeight(0.25, 1 - 1e-8)) < 1e-12)
for (let step = 0; step <= 2800; step++)
  for (let coordinate = 0.25; coordinate < 7; coordinate += 0.25) {
    if (Number.isInteger(coordinate)) continue
    const position = step / 400,
      width = m.fineTickWidth(position, coordinate, Infinity)
    assert(width >= 10 && width <= 22)
    assert.equal(m.fineTickWidth(position, coordinate, 0), 32)
    assert.equal(m.fineTickWidth(position, coordinate, Infinity, 0), 10)
    assert(
      Math.abs(width - m.fineTickWidth(position + 1e-7, coordinate, Infinity)) <
        1e-5,
    )
  }
rows.push({
  name: 'Fine position peak/falloff/support is continuous, weaker than real hover, bounded and reversible',
  status: 'PASS',
})
for (let index = 0; index < 8; index++) {
  const rest = index / 7,
    a = m.counterReelPose(index, rest, 8, 'text'),
    b = m.counterReelPose(index, rest, 8, 'media')
  assert(Math.abs(a.y) < 1e-12 && Math.abs(b.y) < 1e-12)
  for (const progress of [0, 0.01, 0.2, 0.35, 0.5, 0.9, 1]) {
    const l = m.counterReelPose(index, progress, 8, 'text'),
      r = m.counterReelPose(index, progress, 8, 'media')
    assert.equal(l.y, -r.y)
    assert.equal(l.z, r.z)
    assert.equal(l.pitch, -r.pitch)
  }
  if (index < 7) {
    const l = m.counterReelPose(index, rest + 0.01, 8, 'text'),
      r = m.counterReelPose(index, rest + 0.01, 8, 'media')
    assert(l.y > 0 && r.y < 0)
  }
}
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [390, 844],
  [320, 740],
  [1366, 400],
  [960, 496],
]) {
  const l = m.pairedReelLayout(width, height)
  for (const b of [l.text, l.media])
    assert(
      b.width > 0 &&
        b.height > 0 &&
        b.x - b.width / 2 >= 0 &&
        b.x + b.width / 2 <= width,
    )
  if (!l.portrait)
    assert(l.media.x - l.media.width / 2 - (l.text.x + l.text.width / 2) >= 30)
  else assert(l.text.y - l.text.height / 2 > l.media.y + l.media.height / 2)
}
rows.push({
  name: 'All eight paired poses share depth and opposing travel; responsive logical slots fit real gutters',
  status: 'PASS',
})
let minJacobian = Infinity
for (const [width, height, radius, pane] of [
  [420, 650, 30, true],
  [380, 470, 30, true],
  [220, 44, 22, false],
  [358, 490, 30, true],
]) {
  const profile = m.glassOptics(width, height, radius, pane)
  for (let y = 0.5; y < height; y += 5)
    for (let x = 0.5; x < width; x += 5) {
      const qx = Math.abs(x - width / 2) - width / 2 + profile.radius,
        qy = Math.abs(y - height / 2) - height / 2 + profile.radius
      const distance =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        profile.radius
      if (distance > -0.02) continue
      const p = m.glassDisplacement(x, y, width, height, profile),
        dx = m.glassDisplacement(x + 0.01, y, width, height, profile),
        dy = m.glassDisplacement(x, y + 0.01, width, height, profile)
      const determinant =
        (1 + (dx.x - p.x) / 0.01) * (1 + (dy.y - p.y) / 0.01) -
        ((dy.x - p.x) * (dx.y - p.y)) / 0.0001
      assert(determinant > 0.25)
      minJacobian = Math.min(minJacobian, determinant)
    }
}
rows.push({
  name: 'Shared glass sampling remains orientation-preserving through the rounded interior, rim and corners',
  status: 'PASS',
  minimumJacobian: minJacobian,
})
for (const opening of [true, false])
  for (let tile = 0; tile < 100; tile++) {
    const uv = {
        x: ((tile % 10) + 0.5) / 10,
        y: (Math.floor(tile / 10) + 0.5) / 10,
      },
      seed = m.tileSeed(tile),
      from = { x: 350 + tile, y: 100 },
      velocity = { x: 200, y: -150 }
    const flight = {
      rect: { x: 16, y: 73, width: 358, height: 470 },
      anchor: { x: 348, y: 62 },
      viewportWidth: 390,
      opening,
      progress: 0,
      duration: opening ? 0.72 : 0.36,
    }
    assert.deepEqual(m.paneTilePoint(flight, uv, seed, from, velocity), from)
    const endpoint = m.paneTilePoint(
      { ...flight, progress: 1 },
      uv,
      seed,
      from,
      velocity,
    )
    const target = opening
      ? { x: 16 + uv.x * 358, y: 73 + uv.y * 470 }
      : flight.anchor
    assert(Math.hypot(endpoint.x - target.x, endpoint.y - target.y) < 1e-10)
    const at = m.paneTilePoint(
      { ...flight, progress: 0.37 },
      uv,
      seed,
      from,
      velocity,
    )
    const retarget = m.paneTilePoint(
      { ...flight, opening: !opening, progress: 0 },
      uv,
      seed,
      at,
      velocity,
    )
    assert.deepEqual(at, retarget)
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const p = m.paneTilePoint(
        { ...flight, progress: t },
        uv,
        seed,
        from,
        velocity,
      )
      assert(Number.isFinite(p.x) && Number.isFinite(p.y))
    }
  }
for (let t = 0; t <= 1; t += 0.01) {
  const a = m.paneFlightOpacity(t, true, 0)
  assert.equal(m.paneFlightOpacity(0, false, a), a)
  assert.equal(m.paneFlightOpacity(0, true, a), a)
}
assert.equal(m.paneNativeFront(0.49, true), 0)
assert.equal(m.paneNativeFront(0.94, true), 1)
assert.equal(m.paneNativeFront(0.5, false), 0)
rows.push({
  name: 'Tile flights preserve retarget position/opacity, land exactly and reveal native content only behind the assembly front',
  status: 'PASS',
})
const settings = {
  ...m.DEFAULT_SETTINGS,
  theme: 'dark',
  autoScrollSpeed: 2.7,
  soundVolume: 90,
  displayBrightness: 138,
  motion: 'less',
}
assert.deepEqual(m.resetVisibleSettings(settings), {
  ...settings,
  soundVolume: 35,
  displayBrightness: 100,
  motion: 'system',
})
rows.push({
  name: 'Shared Reset preserves theme/tour and restores only visible preferences',
  status: 'PASS',
})
const protectedFiles = JSON.parse(
  await readFile('docs/design/V24_PROTECTED_HASHES.json', 'utf8'),
).files
for (const [path, expected] of Object.entries(protectedFiles))
  assert.equal(
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
    expected,
    path,
  )
rows.push({
  name: 'Original Ringwriter/world/anatomy/audio/media and other protected source bytes remain unchanged',
  status: 'PASS',
  files: Object.keys(protectedFiles).length,
})
await writeFile(
  out + '/model-checks.json',
  JSON.stringify(rows, null, 2) + '\n',
)
console.log('PASS', rows.length, 'meaningful v24 model/preservation contracts')
