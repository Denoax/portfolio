import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const out = 'showcase/v23-evidence'
await mkdir(out, { recursive: true })
const built = await build({
  stdin: {
    contents:
      "export * from './src/core/railPosition';export * from './src/core/sliderFlight';export * from './src/core/experienceSettings';export * from './src/core/reelSnap';export * from './src/core/menuReel'",
    loader: 'ts',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
})
const m = await import(
    'data:text/javascript;base64,' +
      Buffer.from(built.outputFiles[0].text).toString('base64')
  ),
  rows = []
for (const anchor of [0, 1])
  for (const amount of [0.02, 0.1, 0.3, 0.6])
    for (const y of [-0.6, -0.15, 0, 0.15, 0.6]) {
      const release = { x: anchor + (anchor === 0 ? -amount : amount), y },
        f = m.predictSliderFlight({ x: anchor, y: 0 }, release)
      assert.deepEqual(f.start, release)
      assert(anchor === 0 ? f.vx > 0 : f.vx < 0)
      assert(anchor === 0 ? f.target > 0 : f.target < 1)
      assert(f.target >= 0 && f.target <= 1)
      assert(f.duration >= 0.12 && f.duration <= 0.48)
      const end = m.sliderFlightPoint(f, 1)
      assert(Math.abs(end.x - f.target) < 1e-12 && Math.abs(end.y) < 1e-12)
      for (const bounds of [
        [80, 140],
        [0, 100],
      ])
        for (let i = 0; i <= 40; i++) {
          const value = m.sliderValue(
            m.sliderFlightPoint(f, i / 40).x,
            ...bounds,
          )
          assert(value >= bounds[0] && value <= bounds[1])
        }
    }
rows.push({
  name: '80 signed endpoint releases keep visible start/energy, launch inward, land exactly and keep both setting ranges legal',
  status: 'PASS',
})
const custom = {
    ...m.DEFAULT_SETTINGS,
    theme: 'dark',
    autoScrollSpeed: 2.7,
    displayBrightness: 140,
    soundVolume: 0,
    motion: 'less',
  },
  copy = structuredClone(custom),
  reset = m.resetVisibleSettings(custom)
assert.deepEqual(custom, copy)
assert.equal(reset.displayBrightness, 100)
assert.equal(reset.soundVolume, 35)
assert.equal(reset.motion, 'system')
for (const key of Object.keys(custom))
  if (!['displayBrightness', 'soundVolume', 'motion'].includes(key))
    assert.equal(reset[key], custom[key])
assert.deepEqual(m.resetVisibleSettings(reset), reset)
rows.push({
  name: 'Visible-preference reset is idempotent and immutable; theme and unrelated fields preserved',
  status: 'PASS',
})
for (const count of [2, 5, 8, 13])
  for (let index = 0; index < count; index++) {
    const span = (count - 1) * 900,
      p = index / (count - 1),
      t = m.createReelSnapTracker()
    assert.equal(m.updateReelSnap(t, p * span, span, p, count, 0), null)
    assert.equal(m.updateReelSnap(t, p * span, span, p, count, 99), null)
    assert.equal(m.updateReelSnap(t, p * span, span, p, count, 100), index)
    assert.equal(
      m.updateReelSnap(t, p * span + 1, span, p + 0.0005, count, 116),
      null,
      'Real departure clears even inside alignment tolerances',
    )
  }
rows.push({
  name: 'Exact restored snaps require stable interval; native/rendered departure clears lock for arbitrary location counts',
  status: 'PASS',
})
for (const count of [2, 5, 8])
  for (const fractional of [0.1, 0.4, 0.6, 0.9]) {
    const t = m.createReelSnapTracker()
    for (let i = 0; i < 50; i++)
      assert.equal(
        m.updateReelSnap(t, fractional * 6300, 6300, fractional, count, i * 16),
        null,
      )
  }
const t = m.createReelSnapTracker()
for (let i = 0; i < 30; i++)
  assert.equal(
    m.updateReelSnap(t, 0, 6300, 0.003 - i * 0.00004, 8, i * 16),
    null,
    'Displayed easing is not a settled native panel',
  )
assert.equal(m.updateReelSnap(t, NaN, 6300, 0, 8, 500), null)
rows.push({
  name: 'Fractional restores and moving displayed panels never claim a snap; invalid input fails closed',
  status: 'PASS',
})
for (const centers of [
  [18, 62, 106, 150],
  [10, 35, 70],
  [1, 80],
])
  for (let p = -1; p < centers.length + 1; p += 0.01) {
    const x = Math.max(0, Math.min(centers.length - 1, p)),
      i = Math.floor(x),
      expected =
        centers[i] + (x - i) * ((centers[i + 1] ?? centers[i]) - centers[i])
    assert.equal(m.railPosition(p, centers), expected)
  }
rows.push({
  name: 'Exact measured-center interpolation clamps outside range and reverses continuously',
  status: 'PASS',
})
const protectedRows = JSON.parse(
  await readFile('docs/design/V22_PROTECTED_HASHES.json', 'utf8'),
)
const checks = Object.entries(protectedRows.files).map(([path, sha256]) => ({
  path,
  sha256,
}))
for (const r of checks) {
  const data = await readFile(r.path)
  assert.equal(
    createHash('sha256').update(data).digest('hex'),
    r.sha256,
    r.path,
  )
}
rows.push({
  name: 'Protected scene/source byte hashes remain unchanged',
  status: 'PASS',
  files: checks.length,
})
await writeFile(
  `${out}/model-checks.json`,
  JSON.stringify(rows, null, 2) + '\n',
)
console.log('PASS', rows.length, 'v23 model contracts')
