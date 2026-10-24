import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const modules = new Map()
async function compile(path) {
  path = resolve(path)
  if (modules.has(path)) return modules.get(path)
  let js = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText
  for (const match of [...js.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const name = match[1], url = name === 'three'
      ? pathToFileURL(resolve('node_modules/three/build/three.module.js')).href
      : await compile(resolve(dirname(path), name + '.ts'))
    js = js.replace(match[0], `from ${JSON.stringify(url)}`)
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  modules.set(path, url)
  return url
}
const { TubeOrbit } = await import(await compile('src/core/tubeOrbit.ts'))
const advance = (orbit, seconds, hz = 60, dragging = false) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) orbit.step(1 / hz, dragging)
}
const a = new TubeOrbit()
assert.equal(a.known, false)
a.observe(NaN, 300); assert.equal(a.known, false)
a.observe(500, 300); assert(a.step(0, false).resetChain)
assert(!a.step(0, false).resetChain)
advance(a, .5); assert.equal(a.mix, 0)
advance(a, 12)
assert(Math.abs(Math.hypot(a.output.x - 500, a.output.y - 300) - 22) < .001)
const phase = a.phase
advance(a, 12); assert(Math.abs(a.phase - phase) < 1e-10)
assert.deepEqual([a.x, a.y], [500, 300], 'Synthetic circle cannot move actual anchor')
a.observe(500.3, 300.1); advance(a, 1); assert(a.mix > .99, 'Subpixel jitter preserves dwell')
a.observe(520, 310); const mix = a.mix; a.step(1 / 60, false)
assert(a.mix < mix && a.mix > 0)
a.leave(); advance(a, 2); assert(a.mix > .9); assert.deepEqual([a.x, a.y], [520, 310])
advance(a, 1, 60, true); assert(a.mix < .01, 'Precise drag contracts idle')
a.observe(1100, 600); assert(a.step(0, false).resetChain)
const rates = [30, 60, 120].map(hz => { const orbit = new TubeOrbit(); orbit.observe(0, 0); advance(orbit, 15, hz); return orbit })
assert(rates.every(o => Math.abs(o.phase - rates[0].phase) < 1e-10 && Math.abs(o.mix - rates[0].mix) < 1e-9))

const media = new EventTarget(); media.matches = true
const win = new EventTarget(); win.matchMedia = () => media
const doc = new EventTarget(); doc.hidden = false
Object.assign(globalThis, { window: win, document: doc, innerWidth: 1440, innerHeight: 900, Element: class {} })
const { WorldsTubes } = await import(await compile('src/experience/cursor/WorldsTubes.ts'))
const { deriveProjectPigment } = await import(await compile('src/core/projectPigment.ts'))
const pink = deriveProjectPigment('#ff27cf'), cyan = deriveProjectPigment('#00ddf5')
const tubes = new WorldsTubes()
await tubes.prepare({ compileAsync: async () => {}, getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }), info: { programs: [{ name: tubes.material.name, program: {} }] } })
let worlds = false
const stop = tubes.connect(() => worlds)
assert.equal(tubes.connect(() => false), stop, 'One listener owner')
const move = (x, y, pointerType = 'mouse', buttons = 0) => {
  const e = new Event('pointermove'); Object.assign(e, { clientX: x, clientY: y, pointerType, buttons }); win.dispatchEvent(e)
}
move(200, 200); assert(!tubes.orbit.known, 'No pointer admission in intro')
worlds = true
move(200, 200, 'touch'); assert(!tubes.orbit.known)
move(-1, 200); assert(!tubes.orbit.known)
assert(!tubes.update(1 / 60, 1440, 900, true, 1, pink, null, 100), 'No fabricated start')
move(200, 200)
const update = (dt = 1 / 60, pigment = pink, smoke = pigment) => tubes.update(dt, 1440, 900, true, 1, pigment, smoke, 100)
assert(update())
const geometry = tubes.geometry, position = geometry.attributes.position, normal = geometry.attributes.normal, color = geometry.attributes.color
const version = position.version
for (let i = 0; i < 240; i++) { move(200 + i, 200 + Math.sin(i / 20) * 80); update() }
assert.equal(tubes.geometry, geometry)
assert.equal(tubes.geometry.attributes.position, position)
assert(position.version > version)
assert(position.array.every(Number.isFinite)); assert(normal.array.every(Number.isFinite))
assert.equal(position.count, 9 * 72 * 9)
assert.equal(geometry.index.count, 9 * 71 * 8 * 6)
for (let i = 0; i < normal.count; i++) assert(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-6)
const diameter = (ring) => {
  const i = ring * 9
  return Math.hypot(position.getX(i) - position.getX(i + 4), position.getY(i) - position.getY(i + 4), position.getZ(i) - position.getZ(i + 4))
}
assert(diameter(0) < 1e-5 && diameter(71) < 1e-5, 'Both ends taper to a point')
assert(diameter(35) > 1.79 && diameter(35) < 1.81, 'Rounded middle retains CSS-scale volume')
for (let strand = 0; strand < 9; strand++) for (let side = 0; side < 8; side++) {
  const face = (strand * 71 * 8 + 35 * 8 + side) * 6
  const [a, b, c] = geometry.index.array.slice(face, face + 3)
  const ab = [position.getX(b) - position.getX(a), position.getY(b) - position.getY(a), position.getZ(b) - position.getZ(a)]
  const ac = [position.getX(c) - position.getX(a), position.getY(c) - position.getY(a), position.getZ(c) - position.getZ(a)]
  const cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]]
  assert(cross[0]*normal.getX(a)+cross[1]*normal.getY(a)+cross[2]*normal.getZ(a)>0,
    'Front faces must agree with outward lighting normals, not expose the dark inside of the tubes')
}
const hits = []; tubes.mesh.raycast(null, hits); assert.deepEqual(hits, [])
const oldTail = color.array.slice(71 * 9 * 3, 71 * 9 * 3 + 3)
update(1 / 60, cyan); update(1 / 60, cyan)
for (let axis = 0; axis < 3; axis++) assert(Math.abs(color.array[axis] - cyan.rgb[axis]) < 1e-6, 'Head reads exact displayed smoke, not another hue damper')
assert.deepEqual(color.array.slice(71 * 9 * 3, 71 * 9 * 3 + 3), oldTail, 'New pigment does not instantly recolor historical tail')
win.dispatchEvent(new Event('pointerout'))
for (let i = 0; i < 180; i++) update()
assert(tubes.orbit.known && !tubes.orbit.inside && tubes.orbit.mix > .9)
const frozenPhase = tubes.orbit.phase, frozenVersion = position.version
doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
assert(!update(30)); assert.equal(tubes.orbit.phase, frozenPhase); assert.equal(position.version, frozenVersion)
doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); update(30)
assert.equal(tubes.orbit.phase, frozenPhase, 'Resume drops hidden delta and reseeds')
win.dispatchEvent(new Event('keydown')); assert(!update()); assert(!tubes.orbit.known)
move(500, 600); update(); media.matches = false; media.dispatchEvent(new Event('change')); assert(!update())
media.matches = true; move(500, 600); update()
assert(!tubes.update(.016, 1440, 900, false, 0, pink, null, 100)); assert(!tubes.orbit.known)
// Repeated section ownership leaves resources bounded and input unsubscribed.
for (let cycle = 0; cycle < 10; cycle++) { move(500, 600); update(); tubes.update(.016, 1440, 900, false, 0, pink, null, 100) }
let geometryDisposals = 0, materialDisposals = 0
geometry.addEventListener('dispose', () => geometryDisposals++)
tubes.material.addEventListener('dispose', () => materialDisposals++)
tubes.dispose(); tubes.dispose(); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1)
move(700, 600); assert(!tubes.orbit.known, 'Dispose removes event observers')
const optional = new WorldsTubes(), warnings = [], warn = console.warn
console.warn = (...args) => warnings.push(args)
try { await optional.prepare({ compileAsync: async () => { throw new Error('fixture') } }) } finally { console.warn = warn }
optional.orbit.observe(10, 10)
assert(!optional.update(.016, 1440, 900, true, 0, pink, null, 100)); assert.equal(warnings.length, 1); optional.dispose()
const trajectories = []
for (const hz of [30, 60, 120]) {
  const layer = new WorldsTubes()
  await layer.prepare({ compileAsync: async () => {}, getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }), info: { programs: [{ name: layer.material.name, program: {} }] } })
  layer.orbit.observe(400, 400)
  layer.update(0, 1440, 900, true, 1, pink, pink, 100)
  for (let i = 1; i <= hz * 3; i++) {
    const t = i / hz
    layer.orbit.observe(400 + 120 * Math.sin(t), 400 + 80 * Math.cos(t))
    layer.update(1 / hz, 1440, 900, true, 1, pink, pink, 100)
  }
  trajectories.push({ hz, positions: layer.geometry.attributes.position.array.slice() })
  layer.dispose()
}
const errors = trajectories.map(({ hz, positions }) => ({ hz,
  rmsCss: Math.sqrt(positions.reduce((sum, value, i) => sum + (value - trajectories[2].positions[i]) ** 2, 0) / positions.length) }))
assert(errors.every(e => e.rmsCss < 3), `Follower must remain comparable across input cadences: ${JSON.stringify(errors)}`)
console.log('30/60/120Hz simulation comparison (not display validation): ' + JSON.stringify(errors))
console.log('PASS production orbit, 30/60/120Hz phase, pointer ownership, rounded/tapered geometry, pigment history, visibility, section lifecycle, optional failure and cleanup')
