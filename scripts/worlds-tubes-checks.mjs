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
advance(a, .3); assert.equal(a.mix, 0)
advance(a, 11)
assert(Math.abs(Math.hypot(a.output.x - 500, a.output.y - 300) - 42) < .001)
const phase = a.phase
advance(a, 11); assert(Math.abs(a.phase - phase) < 1e-10)
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
await tubes.prepare({ compileAsync: async () => {}, getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }), info: { programs: [tubes.material, tubes.glow.emission, tubes.glow.blur, tubes.glow.composite].map(m => ({name:m.name,program:{}})) } })
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
assert.equal(position.count, 9 * 32 * 9)
assert.equal(geometry.index.count, 9 * 31 * 8 * 6)
for (let i = 0; i < normal.count; i++) assert(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-6)
const diameter = (ring) => {
  const i = ring * 9
  return Math.hypot(position.getX(i) - position.getX(i + 4), position.getY(i) - position.getY(i + 4), position.getZ(i) - position.getZ(i + 4))
}
assert(diameter(0) < 1e-5 && diameter(31) < 1e-5, 'Both ends taper to a point')
assert(diameter(15) > 1.79 && diameter(15) < 1.81, 'Rounded middle retains CSS-scale volume')
for (let strand = 0; strand < 9; strand++) for (let side = 0; side < 8; side++) {
  const face = (strand * 31 * 8 + 15 * 8 + side) * 6
  const [a, b, c] = geometry.index.array.slice(face, face + 3)
  const ab = [position.getX(b) - position.getX(a), position.getY(b) - position.getY(a), position.getZ(b) - position.getZ(a)]
  const ac = [position.getX(c) - position.getX(a), position.getY(c) - position.getY(a), position.getZ(c) - position.getZ(a)]
  const cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]]
  assert(cross[0]*normal.getX(a)+cross[1]*normal.getY(a)+cross[2]*normal.getZ(a)>0,
    'Front faces must agree with outward lighting normals, not expose the dark inside of the tubes')
}
const hits = []; tubes.mesh.raycast(null, hits); assert.deepEqual(hits, [])
const oldTail = color.array.slice(31 * 9 * 3, 31 * 9 * 3 + 3)
update(1 / 60, cyan); update(1 / 60, cyan)
for (let axis = 0; axis < 3; axis++) assert(Math.abs(color.array[axis] - cyan.rgb[axis]) < 1e-6, 'Head reads exact displayed smoke, not another hue damper')
assert.deepEqual(color.array.slice(31 * 9 * 3, 31 * 9 * 3 + 3), oldTail, 'New pigment does not instantly recolor historical tail')
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
  await layer.prepare({ compileAsync: async () => {}, getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }), info: { programs: [layer.material, layer.glow.emission, layer.glow.blur, layer.glow.composite].map(m => ({name:m.name,program:{}})) } })
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

// Measure the actual supported geometry, including the new tail position. A
// lower alpha or a hidden long tail cannot satisfy these contracts.
function arcs(layer) {
  const p = layer.geometry.attributes.position, sections = p.count / (9 * 9)
  const result = []
  for (let s = 0; s < 9; s++) {
    let length = 0, previous = null
    for (let i = 0; i < sections; i++) {
      const center = [0, 0, 0]
      for (let j = 0; j < 8; j++) {
        const v = (s * sections + i) * 9 + j
        center[0] += p.getX(v) / 8; center[1] += p.getY(v) / 8; center[2] += p.getZ(v) / 8
      }
      if (previous) length += Math.hypot(...center.map((v, axis) => v - previous[axis]))
      previous = center
    }
    result.push(length)
  }
  return result
}
const prepare = layer => layer.prepare({ compileAsync: async () => {},
  getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }),
  info: { programs: ['WorldsTubes', 'WorldsTubesEmission', 'WorldsTubesBlur', 'WorldsTubesHalo'].map(name => ({ name, program: {} })) } })
const measured = []
for (const speed of [150, 500, 1600]) {
  const layer = new WorldsTubes(); await prepare(layer)
  const tick = () => layer.update(1 / 60, 1440, 900, true, 0, pink, pink, 100)
  layer.orbit.observe(150, 450); tick()
  const duration = speed > 1000 ? .6 : 1.5
  for (let i = 1; i <= duration * 60; i++) { layer.orbit.observe(150 + speed * i / 60, 450); tick() }
  const moving = arcs(layer)
  assert(moving.every(v => v <= 200.01), 'Fast motion must have a finite actual arc')
  if (speed === 500) assert(moving.every(v => v > 125 && v < 185), 'Ordinary motion stays compact without collapsing')
  for (let i = 0; i < 21; i++) tick()
  const stopped = arcs(layer)
  assert(stopped.every(v => v < 15), 'Extended moving tail retracts within .35s')
  for (let i = 0; i < 240; i++) tick()
  const idle = arcs(layer)
  assert(idle.every(v => v > 30 && v < 95), 'Idle retains a curved traveling arc, not a dot or full circle')
  measured.push({ speedCssPerSecond: speed, moving, afterStop350ms: stopped, idle })
  layer.dispose()
}
console.log('Actual geometry arc/settling (CSS units): ' + JSON.stringify(measured))

// Exercise the renderer boundary on both success and an interrupted halo pass.
const THREE = await import(pathToFileURL(resolve('node_modules/three/build/three.module.js')).href)
const stateLayer = new WorldsTubes(); await prepare(stateLayer)
stateLayer.orbit.observe(300, 450); stateLayer.update(0, 1440, 900, true, 1, pink, pink, 100)
for (const failAt of [0, 1, 3, 5]) {
  const target = {}, viewport = new THREE.Vector4(7, 9, 420, 330), scissor = new THREE.Vector4(8, 10, 80, 60)
  const state = { target, face: 3, mip: 2, viewport: viewport.clone(), scissor: scissor.clone(), test: true, color: new THREE.Color('#123456'), alpha: .7 }
  let draws = 0
  const renderer = { autoClear: true, getRenderTarget: () => state.target, getActiveCubeFace: () => state.face,
    getActiveMipmapLevel: () => state.mip, getScissorTest: () => state.test, getClearAlpha: () => state.alpha,
    getClearColor: out => out.copy(state.color), getViewport: out => out.copy(state.viewport), getScissor: out => out.copy(state.scissor),
    getDrawingBufferSize: out => out.set(2880, 1800), setScissorTest: value => { state.test = value },
    setRenderTarget: (value, face = 0, mip = 0) => { state.target = value; state.face = face; state.mip = mip },
    setViewport: value => state.viewport.copy(value), setScissor: value => state.scissor.copy(value),
    setClearColor: (value, alpha) => { state.color.set(value); state.alpha = alpha }, clear: () => {}, clearDepth: () => {},
    render: () => { if (++draws === failAt) throw Error('injected render interruption') } }
  if (failAt) assert.throws(() => stateLayer.render(renderer), /injected render interruption/)
  else { stateLayer.render(renderer); assert.equal(draws, 5) }
  assert.equal(state.target, target); assert.equal(state.face, 3); assert.equal(state.mip, 2)
  assert(state.viewport.equals(viewport) && state.scissor.equals(scissor)); assert.equal(state.test, true)
  assert.equal(state.color.getHexString(), '123456'); assert.equal(state.alpha, .7); assert.equal(renderer.autoClear, true)
}
let targetDisposals = 0
const originalDispose = THREE.WebGLRenderTarget.prototype.dispose
THREE.WebGLRenderTarget.prototype.dispose = function () { targetDisposals++; return originalDispose.call(this) }
try { stateLayer.dispose(); stateLayer.dispose(); assert.equal(targetDisposals, 2, 'Both owned glow targets disposed exactly once') }
finally { THREE.WebGLRenderTarget.prototype.dispose = originalDispose }
console.log('PASS bounded supported arcs, rapid tail settling, noncollapsed idle, halo state restoration and target disposal')
for (const disposeDuring of [1, 2, 3]) {
  const layer = new WorldsTubes(); let finish, calls = 0
  const pending = layer.prepare({ compileAsync: async () => {
    if (++calls === disposeDuring) await new Promise(resolve => { finish = resolve })
  }, getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => true }),
  info: { programs: ['WorldsTubes', 'WorldsTubesEmission', 'WorldsTubesBlur', 'WorldsTubesHalo'].map(name => ({ name, program: {} })) } })
  while (!finish) await new Promise(resolve => setImmediate(resolve))
  layer.dispose(); finish(); await pending
  assert.equal(calls, disposeDuring, 'Disposal prevents subsequent asynchronous shader/resource work')
  layer.orbit.observe(300, 450)
  assert(!layer.update(.016, 1440, 900, true, 0, pink, pink, 100))
}
console.log('PASS disposal during body/emission/blur preparation cancels subsequent work')
console.log('PASS production orbit, 30/60/120Hz phase, pointer ownership, rounded/tapered geometry, pigment history, visibility, section lifecycle, optional failure and cleanup')
