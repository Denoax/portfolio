import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { launchCaptureBrowser, rendererIdentity } from './v27-browser.mjs'

// Read-only runtime observation plus trusted browser inputs. This probe sees
// real shader uploads; it never writes a controller, camera or shader uniform.
const base = process.env.BASE_URL || 'http://127.0.0.1:4185'
assert(['http://127.0.0.1:4185', 'https://manimarami.com'].includes(base))
const out = process.env.OUT
assert(out, 'Provide a distinct evidence directory')
assert.equal(process.env.V27_NATIVE_GL, '1')
await mkdir(out, { recursive: true })
const inventory = JSON.parse(await readFile(process.env.BUILD_STATE, 'utf8'))
const expected = new Map(inventory.files.map(row => [row.path, row]))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const response = await fetch(base + '/')
assert.equal(response.status, 200)
const index = Buffer.from(await response.arrayBuffer())
assert.equal(sha(index), expected.get('index.html').sha256)
const ids = JSON.parse(await readFile('src/content/projectOrder.json', 'utf8')).map(row => row.id)
assert.equal(ids.length, 11)
const browser = await launchCaptureBrowser(), rows = []
try {
  for (const [name, width, height, theme, volume] of [['desktop', 1440, 900, 'dark', 35], ['portrait', 390, 844, 'light', 0]]) {
    const dir = `${out}/${name}`
    await mkdir(dir, { recursive: true })
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 720,
      recordVideo: { dir, size: { width, height } } })
    await context.addInitScript(({ theme, volume }) => {
      localStorage.setItem('portfolio:experience-settings:v1', JSON.stringify({ version: 2, theme, soundVolume: volume, ambienceVolume: 0 }))
      sessionStorage.removeItem('portfolio:intro:v11')
      window.releaseInputs = []; window.releaseAudio = []; window.releaseSnap = []
      for (const type of ['wheel', 'pointerdown', 'pointerup', 'keydown']) addEventListener(type, event =>
        releaseInputs.push({ type, at: performance.now(), trusted: event.isTrusted, deltaY: event.deltaY }), { capture: true })
      addEventListener('portfolio-audio', event => releaseAudio.push(event.detail))
      const prototype = WebGL2RenderingContext.prototype, names = new WeakMap()
      const location = prototype.getUniformLocation, scalar = prototype.uniform1f
      prototype.getUniformLocation = function (...args) {
        const value = location.apply(this, args)
        if (value) names.set(value, args[1])
        return value
      }
      prototype.uniform1f = function (location, value) {
        if (names.get(location) === 'uSnap') releaseSnap.push({ at: performance.now(), value })
        return scalar.call(this, location, value)
      }
    }, { theme, volume })
    const page = await context.newPage(), errors = [], failedAssets = [], samples = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
      if (response.url().startsWith(base + '/assets/') && response.status() >= 400)
        failedAssets.push({ url: response.url(), status: response.status() })
    })
    const read = () => page.evaluate(() => structuredClone(__portfolio.introZoom))
    let row, failure, stage = 'opening'
    try {
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.__portfolio?.introZoom.instances > 0 && __portfolio.introZoom.age > 2)
      const renderer = await rendererIdentity(page)
      assert(renderer.renderer && !/swiftshader|llvmpipe/i.test(renderer.renderer))
      assert.equal(await page.locator('html').getAttribute('data-color-theme'), theme)
      await page.mouse.move(width / 2, height / 2)
      await page.screenshot({ path: `${dir}/opening.png` })
      const wheel = async delta => {
        const count = await page.evaluate(() => releaseInputs.length)
        await page.mouse.wheel(0, delta)
        await page.waitForFunction(count => releaseInputs.length > count, count)
        await page.waitForTimeout(120)
      }
      stage = 'accumulated wheel momentum'
      for (let notch = 0; notch < 5; notch++) await wheel(140)
      await page.waitForFunction(() => __portfolio.introZoom.velocity < -0.1)
      const stacked = await read()
      await wheel(-140)
      await page.waitForFunction(before => __portfolio.introZoom.velocity > before + .005, stacked.velocity)
      const braking = await read()
      assert.equal(braking.transport.lastDirection, -1)
      assert(braking.velocity < 0)
      let oppositeNotches = 1
      while ((await read()).transport.lastDirection === -1 && oppositeNotches < 12) {
        const before = await read()
        await wheel(-140)
        await page.waitForFunction(age => __portfolio.introZoom.age > age, before.age)
        oppositeNotches++
      }
      assert(oppositeNotches >= 3 && oppositeNotches <= 9)
      await page.waitForFunction(() => __portfolio.introZoom.velocity > .01)
      for (let notch = 0; notch < 6; notch++) await wheel(-14000)
      await page.waitForFunction(() => __portfolio.introZoom.velocity > .1)
      const bounded = await read()
      assert(bounded.velocity <= .065 * 2.501)
      samples.push({ stacked, braking, oppositeNotches, bounded })
      await page.screenshot({ path: `${dir}/momentum.png` })
      stage = 'rubber hold, release snap and glyph rebound'
      const sequence = (await read()).transport.gestureSequence
      await page.mouse.down()
      await page.waitForFunction(sequence => __portfolio.introZoom.transport.state === 'HELD' &&
        __portfolio.introZoom.transport.gestureSequence > sequence, sequence)
      await page.waitForTimeout(700)
      const held = await read()
      await page.waitForFunction(age => __portfolio.introZoom.age > age + .4, held.age)
      const still = await read()
      assert.equal(still.phase, held.phase)
      assert.equal(still.transport.angularTime, held.transport.angularTime)
      await page.screenshot({ path: `${dir}/held.png` })
      const releasedAt = await page.evaluate(() => performance.now())
      await page.mouse.up()
      await page.waitForFunction(at => releaseSnap.some(frame => frame.at > at && frame.value > .5), releasedAt)
      await page.screenshot({ path: `${dir}/snap.png` })
      await page.waitForFunction(at => releaseSnap.some(frame => frame.at > at && frame.value < -.2), releasedAt)
      await page.waitForFunction(() => __portfolio.introZoom.transport.state === 'AUTO_OUT')
      const rebound = await page.evaluate(at => releaseSnap.filter(frame => frame.at > at), releasedAt)
      assert(Math.abs(rebound.at(-1).value) < .001)
      const audio = await page.evaluate(() => releaseAudio)
      assert.equal(audio.filter(event => event.type === 'sfx' && event.cue === 'snap').length, volume ? 1 : 0)
      assert.equal(audio.filter(event => event.type === 'sfx' && event.cue === 'ripple').length, 0)
      stage = 'eleven-project reel and original interactive Portfolio panel'
      await page.mouse.click(width / 2, height / 2)
      await page.locator('.identity-intro').waitFor({ state: 'detached' })
      await page.waitForSelector('[data-surface=hub]')
      await page.getByRole('button', { name: 'Portfolio letter field. Click or press Enter to drop a letter.', exact: true }).waitFor({ state: 'visible' })
      const actualIds = await page.locator('.menu-project[data-project-id]').evaluateAll(nodes => nodes.map(node => node.dataset.projectId))
      assert.deepEqual(actualIds, ids)
      assert.equal(await page.locator('.global-proximity-rail > button').count(), 11)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, ids[0])
      await page.screenshot({ path: `${dir}/portfolio-worlds.png` })
      stage = 'real forward/reverse project reel scrolling'
      await page.mouse.move(width * .5, height * .7)
      await page.mouse.wheel(0, height * .85)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, ids[1])
      const pelagicHref = await page.locator('.menu-project[data-current=true] .ui-primary').getAttribute('href')
      assert.equal(pelagicHref, 'https://github.com/Denoax/pelagic-jellyfish-webgl')
      await page.screenshot({ path: `${dir}/pelagic-worlds.png` })
      await page.mouse.wheel(0, -height * .85)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, ids[0])
      stage = 'functional Settings navigation'
      if (width < 900 && !await page.getByRole('button', { name: 'Settings', exact: true }).isVisible())
        await page.getByRole('button', { name: 'Portfolio menu', exact: true }).click()
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.locator('#experience-settings[open]').waitFor()
      await page.waitForFunction(() => !window.__paneFlights || __paneFlights.active === 0)
      await page.screenshot({ path: `${dir}/settings.png` })
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('#experience-settings[open]'))
      assert.equal(await page.locator('[data-surface=world]').count(), 0)
      assert.deepEqual(errors, []); assert.deepEqual(failedAssets, [])
      const inputs = await page.evaluate(() => releaseInputs)
      assert(inputs.every(event => event.trusted))
      row = { result: 'PASS', name, renderer, samples, held, still, rebound, audio, actualIds,
        pelagicHref, inputs, errors, failedAssets }
    } catch (error) {
      failure = error
      await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {})
      row = { result: 'FAIL', name, stage, error: String(error.stack || error), samples, errors, failedAssets }
    } finally {
      const video = page.video()
      await context.close()
      await video.saveAs(`${dir}/unedited.webm`); await video.delete()
      rows.push(row)
      await writeFile(`${out}/results.json`, JSON.stringify({ base, sourceRevision: inventory.sourceRevision,
        result: failure ? 'FAIL' : 'PASS', rows,
        scope: 'Actual compiled runtime, trusted inputs, native Chromium desktop and portrait emulation. Real shader uploads are observed without mutation. Physical devices, Brave/Safari, listening and human motion approval are unverified.' }, null, 2) + '\n')
    }
    if (failure) throw failure
    console.log('PASS compiled/public momentum, snap/rebound, eleven projects, interactive Portfolio, Pelagic link and Settings:', name)
  }
} finally { await browser.close() }
