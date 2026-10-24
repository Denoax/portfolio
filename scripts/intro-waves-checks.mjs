import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Exercise the production resource owner. Real GLSL linking/pixels are verified
// separately in the browser; this small compile boundary tests optional failure.
const source = await readFile('src/experience/hub/IntroWaves.ts', 'utf8')
const three = pathToFileURL(resolve('node_modules/three/build/three.module.js')).href
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} }).outputText.replace(/from ['"]three['"]/, `from ${JSON.stringify(three)}`)
const { IntroWaves } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const waves = new IntroWaves(), intro = { active: true, exitProgress: 0 }
const geometry = waves.geometry, material = waves.material
const hits = []
waves.mesh.raycast(null, hits)
assert.deepEqual(hits, [], 'Backdrop must not intercept input')
waves.update(intro, 3, 1, 1440, 900, 100, 900)
assert.equal(waves.mesh.visible, false, 'Foreground can render before optional compile completes')

let finishCompile
const context = { LINK_STATUS: 1, getProgramParameter: () => true }
const renderer = {
  compileAsync: () => new Promise(resolve => { finishCompile = resolve }),
  getContext: () => context,
  info: { programs: [{ name: material.name, program: {} }] },
}
const preparing = waves.prepare(renderer, {})
assert.equal(waves.mesh.visible, false)
finishCompile()
await preparing
waves.update(intro, 3, 1, 2880, 1800, 120, 900)
assert.equal(waves.mesh.visible, true)
assert.deepEqual(material.uniforms.uWaveResolution.value.toArray(), [2880, 1800],
  'Actual buffer dimensions must not receive a second DPR multiplier')
assert.equal(material.uniforms.uWaveTime.value, 3)
assert.equal(material.uniforms.uWaveBrightness.value, 1.2)
assert.equal(material.uniforms.uWaveCellFrequency.value, 900 / 40,
  'DPR changes sampling resolution, not CSS cell spacing')

for (const mix of [0, .2, .5, 1, .3, 0, 1]) {
  waves.update(intro, 7, mix, 390, 844, 100, 844)
  assert.equal(material.uniforms.uWaveTime.value, 7, 'Theme/resize cannot restart phase')
  assert.equal(waves.geometry, geometry)
  assert.equal(waves.material, material)
}
assert.equal(material.uniforms.uWaveCellFrequency.value, 844 / 40)
waves.update({ active: true, exitProgress: .4 }, 9, 0, 390, 844, 100, 844)
assert.equal(material.uniforms.uWaveVisibility.value, .6)
waves.update({ active: false, exitProgress: 0 }, 30, 0, 390, 844, 100, 844)
assert.equal(waves.mesh.visible, false)
assert.equal(material.uniforms.uWaveTime.value, 9, 'No wave uniform work in Worlds')
waves.update(intro, 40 * Math.PI + .25, 1, 390, 844, 100, 844)
assert.equal(material.uniforms.uWaveTime.value, 40 * Math.PI + .25,
  'Source phase must continue through the mathematical period without a reset')
waves.update({ active: true, exitProgress: 1 }, 30, 0, 390, 844, 100, 844)
assert.equal(waves.mesh.visible, false)

const warnings = [], originalWarn = console.warn
console.warn = (...args) => warnings.push(args.map(String).join(' '))
try {
  for (const failure of ['rejected', 'unlinked', 'missing']) {
    const optional = new IntroWaves()
    await optional.prepare({
      compileAsync: () => failure === 'rejected' ? Promise.reject(new Error('fixture')) : Promise.resolve(),
      getContext: () => ({ LINK_STATUS: 1, getProgramParameter: () => false }),
      info: { programs: failure === 'missing' ? [] : [{ name: optional.material.name, program: {} }] },
    }, {})
    optional.update(intro, 1, 1, 1440, 900, 100, 900)
    assert.equal(optional.mesh.visible, false, `${failure}: plain intro remains available`)
    optional.dispose()
  }
} finally { console.warn = originalWarn }
assert.equal(warnings.length, 3)
let geometryDisposals = 0, materialDisposals = 0
geometry.addEventListener('dispose', () => geometryDisposals++)
material.addEventListener('dispose', () => materialDisposals++)
waves.dispose()
assert.equal(geometryDisposals, 1)
assert.equal(materialDisposals, 1)
assert.equal(waves.mesh.visible, false)
console.log('PASS waves readiness, optional failure, phase/theme/resize, exit/Worlds, input and disposal contracts')
