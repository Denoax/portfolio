import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { launchCaptureBrowser, rendererIdentity } from './v27-browser.mjs'

const base = process.env.BASE_URL, out = process.env.OUT
assert(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
assert(out, 'Provide task-private OUT')
await mkdir(out, { recursive: true })
const projects = JSON.parse(await readFile('src/content/projectOrder.json', 'utf8'))
const browser = await launchCaptureBrowser(), results = []

// Browser-only observation of the real production shader and GPU buffers. No
// production debug state is changed. Synchronous reads are excluded from perf.
function probe() {
  const programs = new Map(), proto = WebGL2RenderingContext.prototype
  const uniform = proto.getUniformLocation, use = proto.useProgram, draw = proto.drawElements
  let current = null, pending = null
  const evidence = { draws: 0, snapshot: null }
  proto.getUniformLocation = function (program, name) {
    const location = uniform.call(this, program, name)
    if (name === 'uTubeLight') programs.set(program, true)
    return location
  }
  proto.useProgram = function (program) { current = program; return use.call(this, program) }
  proto.drawElements = function (...args) {
    if (programs.has(current)) {
      evidence.draws++
      if (pending) {
        const original = this.getParameter(this.ARRAY_BUFFER_BINDING), arrays = {}
        for (const name of ['position', 'normal', 'color']) {
          const location = this.getAttribLocation(current, name)
          const buffer = this.getVertexAttrib(location, this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)
          this.bindBuffer(this.ARRAY_BUFFER, buffer)
          const data = new Float32Array(this.getBufferParameter(this.ARRAY_BUFFER, this.BUFFER_SIZE) / 4)
          this.getBufferSubData(this.ARRAY_BUFFER, 0, data)
          arrays[name] = data
        }
        this.bindBuffer(this.ARRAY_BUFFER, original)
        const p = arrays.position, heads = [], bounds = [Infinity, Infinity, -Infinity, -Infinity]
        for (let s = 0; s < 9; s++) {
          const i = s * 72 * 9 * 3
          heads.push([p[i] + innerWidth / 2, innerHeight / 2 - p[i + 1], p[i + 2]])
        }
        for (let i = 0; i < p.length; i += 3) {
          bounds[0] = Math.min(bounds[0], p[i]); bounds[1] = Math.min(bounds[1], p[i + 1])
          bounds[2] = Math.max(bounds[2], p[i]); bounds[3] = Math.max(bounds[3], p[i + 1])
        }
        evidence.snapshot = { heads, bounds, pigment: [...arrays.color.slice(0, 3)],
          finite: Object.values(arrays).every(a => a.every(Number.isFinite)), vertices: p.length / 3,
          light: this.getUniform(current, uniform.call(this, current, 'uTubeLight')),
          opacity: this.getUniform(current, uniform.call(this, current, 'uTubeOpacity')) }
        pending(evidence.snapshot); pending = null
      }
    }
    return draw.apply(this, args)
  }
  window.tubeProbe = evidence
  window.readTube = () => new Promise(resolve => { pending = resolve })
}
async function setup(options = {}, fixture = null) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options })
  await context.addInitScript(probe)
  if (fixture === 'tube-failure') await context.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.shaderSource
    WebGL2RenderingContext.prototype.shaderSource = function (shader, code) {
      return original.call(this, shader, code.includes('vTubePigment') ? code + '\nINVALID_TUBE_FIXTURE;' : code)
    }
  })
  const page = await context.newPage(), errors = [], consoleErrors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.goto(base)
  await page.waitForFunction(() => window.__portfolio?.introZoom.instances > 0)
  return { context, page, errors, consoleErrors }
}
const state = page => page.evaluate(() => ({ diagnostic: structuredClone(__portfolio),
  smoke: structuredClone(window.__worldsTrail), tubeDraws: tubeProbe.draws,
  canvas: document.querySelectorAll('.experience-canvas canvas').length,
  overflow: document.documentElement.scrollWidth > innerWidth }))
const snapshot = page => page.evaluate(() => readTube())
const enter = async page => {
  await page.locator('.identity-intro').press('Enter')
  await page.waitForSelector('[data-surface=hub]')
  await page.waitForTimeout(500)
}
async function choose(page, index) {
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.locator('.projects-index-rows button').nth(index).click()
  await page.waitForFunction(id => __portfolio.menu.settledId === id, projects[index].id)
  await page.mouse.move(300, 720)
  await page.waitForTimeout(700)
}
const save = () => writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n')
try {
  const { context, page, errors, consoleErrors } = await setup()
  const identity = await rendererIdentity(page)
  await page.mouse.move(300, 720); await page.waitForTimeout(150)
  assert.equal((await state(page)).tubeDraws, 0, 'No tubes in Waves intro')
  await page.screenshot({ path: `${out}/preserved-intro.png` })
  await enter(page)
  assert.equal((await state(page)).tubeDraws, 0, 'No fabricated pointer after keyboard entry')
  await page.mouse.move(310, 720); await page.waitForTimeout(250)
  let shape = await snapshot(page)
  assert(shape.finite && shape.vertices === 9 * 72 * 9)
  const before = await state(page), samples = []
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); samples.push(await snapshot(page)) }
  const stationary = await state(page)
  assert.equal(stationary.smoke.path.admitted, before.smoke.path.admitted, 'Orbit cannot feed smoke samples')
  assert(stationary.tubeDraws > before.tubeDraws + 100)
  const settled = samples.slice(12).map(s => s.heads[0])
  assert(settled.every(([x, y]) => Math.hypot(x - 310, y - 720) < 28))
  assert(Math.max(...settled.map(p => p[0])) - Math.min(...settled.map(p => p[0])) > 30)
  await page.screenshot({ path: `${out}/light-idle.png` })
  await page.mouse.move(-20, -20)
  const leave = await state(page)
  await page.waitForTimeout(1600); shape = await snapshot(page)
  assert((await state(page)).tubeDraws > leave.tubeDraws)
  assert(shape.heads.every(([x, y]) => Math.hypot(x - 310, y - 720) < 43))
  assert.equal((await state(page)).smoke.field.pointerKnown, false)
  await page.mouse.move(1320, 760); await page.waitForTimeout(50); shape = await snapshot(page)
  assert(shape.bounds[2] - shape.bounds[0] < 100, 'Large re-entry reseeds without viewport chord')
  results.push({ test: 'native-idle-leave-jump', identity, before, stationary, stationarySamples: samples, leave, shape })
  await save()
  await page.mouse.move(300, 720); await page.waitForTimeout(200)
  const colors = []
  for (let index = 0; index < projects.length; index++) {
    await choose(page, index)
    shape = await snapshot(page)
    const observed = await state(page)
    assert.equal(observed.diagnostic.menu.settledId, projects[index].id)
    assert(shape.pigment.every((c, i) => Math.abs(c - observed.smoke.field.pigment[i]) < .002))
    colors.push({ id: projects[index].id, title: projects[index].title, pigment: shape.pigment, smoke: observed.smoke.field.pigment })
  }
  results.push({ test: 'all-project-pigments', colors }); await save()
  await choose(page, 0)
  // Observe a real smooth scroll *during* its fractional displayed pose. The
  // native reel deliberately snaps to projects; do not disable that behavior.
  await page.locator('.menu-scroll').evaluate(node => { node.scrollTo({ top: node.clientHeight, behavior: 'smooth' }) })
  await page.waitForFunction(() => __portfolio.menu.rendered * 10 > .15 && __portfolio.menu.rendered * 10 < .8)
  shape = await snapshot(page)
  const fractional = await state(page)
  assert(fractional.diagnostic.menu.rendered * 10 > .1 && fractional.diagnostic.menu.rendered * 10 < .95)
  assert(shape.pigment.every((c, i) => Math.abs(c - fractional.smoke.field.pigment[i]) < .04))
  await page.screenshot({ path: `${out}/fractional-light.png` })
  // Semantic DOM activation keeps the actual pointer/anchor in place while
  // exercising rapid theme retargets; it does not mutate theme debug state.
  for (const delay of [120, 160, 120, 900]) {
    await page.locator('.theme-toggle').evaluate(node => node.click())
    await page.waitForTimeout(delay)
    assert((await snapshot(page)).finite)
  }
  await page.locator('.theme-toggle').evaluate(node => node.click())
  await page.waitForFunction(() => Number(document.documentElement.style.getPropertyValue('--theme-mix')) < .002)
  shape = await snapshot(page); assert(shape.light < .01)
  await page.screenshot({ path: `${out}/dark-idle.png` })
  const preHidden = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    return tubeProbe.draws
  })
  await page.waitForTimeout(400); assert.equal((await state(page)).tubeDraws, preHidden)
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(100); assert((await snapshot(page)).finite)
  await page.keyboard.press('Tab'); const keyboard = (await state(page)).tubeDraws
  await page.waitForTimeout(100); assert.equal((await state(page)).tubeDraws, keyboard)
  await page.mouse.move(320, 720); await page.waitForTimeout(300)
  // Observe bounded real renderer resources through ten actual UI return/entry cycles.
  const cycles = []
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'About me', exact: true }).click()
    await page.getByRole('button', { name: 'Return to the start', exact: true }).click()
    await page.waitForSelector('[data-surface=intro]')
    const count = (await state(page)).tubeDraws
    await page.waitForTimeout(100); assert.equal((await state(page)).tubeDraws, count)
    await enter(page); await page.mouse.move(300 + i, 720); await page.waitForTimeout(300)
    cycles.push(await state(page))
  }
  assert(new Set(cycles.map(c => c.diagnostic.geometries)).size === 1)
  assert(new Set(cycles.map(c => c.canvas)).size === 1)
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, [])
  results.push({ test: 'native-production-contracts', identity, fractional, cycles, errors, consoleErrors,
    scope: 'Real production geometry/input/rendering; hidden state is an explicit visibility fixture. Screenshots and samples are not human continuous-motion approval.' })
  await context.close(); await save()

  for (const options of [{ viewport: { width: 1440, height: 480 } }, { viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    const { context, page, errors, consoleErrors } = await setup(options)
    await enter(page); await page.mouse.move(120, 300); await page.waitForTimeout(400)
    const observed = await state(page)
    assert.equal(observed.overflow, false)
    if (options.isMobile) assert.equal(observed.tubeDraws, 0, 'Coarse emulation has no mouse tubes')
    else assert((await snapshot(page)).finite)
    await page.screenshot({ path: `${out}/${options.isMobile ? 'portrait-coarse' : options.deviceScaleFactor ? 'dpr2' : 'short-landscape'}.png` })
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, [])
    results.push({ test: 'responsive-input', options, observed, errors, consoleErrors, scope: 'Browser emulation, not physical-device evidence' })
    await context.close(); await save()
  }
  const failure = await setup({}, 'tube-failure')
  await enter(failure.page); await failure.page.mouse.move(300, 700); await failure.page.waitForTimeout(300)
  const failed = await state(failure.page)
  assert.equal(failed.tubeDraws, 0); assert(failed.smoke.field.pointerKnown)
  assert.deepEqual(failure.errors, [])
  results.push({ test: 'optional-tube-shader-failure', observed: failed, errors: failure.errors,
    consoleErrors: failure.consoleErrors, scope: 'Deliberate invalid-shader fixture; expected shader diagnostic retained; smoke/interface remain functional' })
  await failure.context.close(); await save()
} finally { await browser.close(); await save() }
console.log('PASS production tube/smoke/pigment/idle/input/lifecycle/responsive/optional-failure checks')
