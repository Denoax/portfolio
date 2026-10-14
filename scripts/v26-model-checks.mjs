import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFile, mkdir, writeFile } from 'node:fs/promises'

const load = async path => {
  const source = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
}
const current = await load('src/core/paneFlight.ts')
const baselinePath = process.env.BASELINE_KERNEL || new URL('../docs/design/v26-baseline/paneFlight.ts', import.meta.url)
const baseline = await load(baselinePath)
const rect = { x: 1018, y: 102, width: 380, height: 448 }, anchor = { x: 1213, y: 80 }
const cols = Math.ceil(rect.width / 4), rows = Math.ceil(rect.height / 4), count = cols * rows
const flight = { rect, anchor, opening: true, duration: current.MENU_OPEN_SECONDS, progress: 0, fresh: true, viewportWidth: 1440, tileCount: count }
const cells = Array.from({ length: count }, (_, index) => ({
  uv: { x: (index % cols + .5) / cols, y: (Math.floor(index / cols) + .5) / rows }, seed: current.tileSeed(index),
}))
const pose = (kernel, cell, elapsed) => kernel.paneTilePose({ ...flight, progress: elapsed / flight.duration }, cell.uv, cell.seed,
  { x: anchor.x + (cell.seed.x - .5) * (kernel === current ? 31.2 : 48), y: anchor.y + 3 }, { x: 0, y: 0 })
function sourceCoverage(kernel, elapsed) {
  const width = 128, height = 80, left = anchor.x - width / 2, top = anchor.y - 8
  const pixels = new Float64Array(width * height)
  let visible = 0
  for (const cell of cells) {
    const value = pose(kernel, cell, elapsed)
    if (value.alpha < .001) continue // Same fragment discard as the actual renderer.
    visible++
    const x = value.x - left - rect.width / cols / 2, y = value.y - top - rect.height / rows / 2
    const right = x + rect.width / cols, bottom = y + rect.height / rows
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(height, Math.ceil(bottom)); py++)
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, Math.ceil(right)); px++) {
        const fraction = Math.max(0, Math.min(px + 1, right) - Math.max(px, x)) * Math.max(0, Math.min(py + 1, bottom) - Math.max(py, y))
        const offset = py * width + px
        pixels[offset] = 1 - (1 - pixels[offset]) * (1 - value.alpha * fraction)
      }
  }
  return { elapsedMs: elapsed * 1000, visible, maximum: Math.max(...pixels), mean: pixels.reduce((a, b) => a + b, 0) / pixels.length }
}
const coverage = [.0167, .04, .08, .12, .18, .3].map(time => ({ before: sourceCoverage(baseline, time), after: sourceCoverage(current, time) }))
assert(coverage[0].after.visible > 0 && coverage[0].after.visible < 100, 'Next-frame response must be a small visible cohort')
for (const row of coverage.slice(1, 3)) assert(row.after.mean < row.before.mean * .5, 'Early aggregate source coverage remains too forceful')
let comparisons = 0
for (const cell of cells.filter((_, index) => index % 29 === 0)) {
  const end = pose(current, cell, .84)
  assert(end.settled && end.alpha === 1)
  assert(Math.hypot(end.x - (rect.x + cell.uv.x * rect.width), end.y - (rect.y + cell.uv.y * rect.height)) < 1e-8)
  for (const elapsed of [.04, .16, .35, .68]) {
    const old = pose(current, cell, elapsed)
    const close = { ...flight, fresh: false, opening: false, progress: 0, duration: current.MENU_CLOSE_SECONDS }
    const velocity = { x: old.vx, y: old.vy }
    const start = current.paneTilePose(close, cell.uv, cell.seed, old, velocity, old.alpha)
    assert(Math.hypot(start.x - old.x, start.y - old.y) < 1e-8)
    assert(Math.hypot(start.vx - old.vx, start.vy - old.vy) < 1e-8)
    assert.equal(start.alpha, old.alpha)
    let previousAlpha = old.alpha
    for (let step = 1; step <= 24; step++) {
      const exit = current.paneTilePose({ ...close, progress: step / 24 }, cell.uv, cell.seed, old, velocity, old.alpha)
      assert(exit.alpha <= previousAlpha + 1e-10)
      previousAlpha = exit.alpha
      const reopen = current.paneTilePose({ ...flight, fresh: false }, cell.uv, cell.seed, exit, { x: exit.vx, y: exit.vy }, exit.alpha)
      assert(Math.hypot(reopen.x - exit.x, reopen.y - exit.y) < 1e-8)
      assert.equal(reopen.alpha, exit.alpha)
    }
    const first = current.paneTilePose({ ...close, progress: (1 / 60) / close.duration }, cell.uv, cell.seed, old, velocity, old.alpha)
    if (old.alpha > 0) assert(first.alpha < old.alpha)
    comparisons++
  }
  const native = { x: rect.x + cell.uv.x * rect.width, y: rect.y + cell.uv.y * rect.height }
  for (let step = 0; step <= 30; step++) {
    const exit = current.paneTilePose({ ...flight, opening: false, fresh: false, progress: step / 30, duration: current.MENU_CLOSE_SECONDS }, cell.uv, cell.seed, native, { x: 0, y: 0 }, 1)
    assert(exit.x >= Math.min(native.x, anchor.x) - 1e-8 && exit.x <= Math.max(native.x, anchor.x) + 1e-8)
    assert(exit.y >= Math.min(native.y, anchor.y) - 1e-8 && exit.y <= Math.max(native.y, anchor.y) + 1e-8)
  }
}
const output = process.env.EVIDENCE_OUT || 'showcase/v26-evidence/checks'
await mkdir(output, { recursive: true })
await writeFile(output + '/menu-model.json', JSON.stringify({ status: 'PASS', count, coverage, retargetComparisons: comparisons,
  firstCloseFrameDecreases: true, closeAlphaMonotone: true, noFreshClosingScatter: true, exactLandingAndReversal: true,
  scope: 'Full bounded cell pool, actual CPU pose/alpha kernels and rectangular alpha-compositing model. Coverage is an analytical diagnostic; actual rendered crops/recordings remain separate. Not a GPU timer or physical display measurement.' }, null, 2) + '\n')
console.log('PASS small immediate cohort, aggregate source coverage, exact landing/C1 retarget, first-frame monotone close and no fresh scatter', JSON.stringify(coverage))
