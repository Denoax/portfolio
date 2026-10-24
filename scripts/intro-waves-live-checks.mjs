import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launchCaptureBrowser, rendererIdentity } from './v27-browser.mjs'

const base = process.env.BASE_URL, out = process.env.OUT
assert(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname),
  'Provide the isolated candidate BASE_URL on loopback')
assert(out, 'Provide a private OUT directory')
await mkdir(out, { recursive: true })
const browser = await launchCaptureBrowser(), results = []
try {
  for (const system of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: system ? 'reduce' : 'no-preference',
    })
    await context.addInitScript(system => {
      localStorage.setItem('portfolio:experience-settings:v1', JSON.stringify({
        version: 2, theme: 'light', soundVolume: 0, ambienceVolume: 0,
        motion: system ? 'system' : 'less',
      }))
      const locations = {}, original = WebGL2RenderingContext.prototype.getUniformLocation
      WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
        const location = original.call(this, program, name)
        if (name.startsWith('uWave')) locations[name] = { gl: this, program, location }
        return location
      }
      window.readIntroWaves = () => Object.fromEntries(Object.entries(locations).map(
        ([name, { gl, program, location }]) => {
          const value = gl.getUniform(program, location)
          return [name, ArrayBuffer.isView(value) ? [...value] : value]
        }))
    }, system)
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await page.waitForFunction(() => readIntroWaves().uWaveVisibility === 1)
    const before = await page.evaluate(() => readIntroWaves())
    await page.waitForTimeout(500)
    assert.equal((await page.evaluate(() => readIntroWaves())).uWaveTime, before.uWaveTime)
    assert.equal(await page.locator('.intro-static-rings').count(), 1)
    assert.equal(await page.locator('.selection-hub').evaluate(node => getComputedStyle(node).opacity), '0',
      'Project panels must not paint through the still intro')
    await page.locator('.theme-toggle').click()
    await page.waitForTimeout(250)
    const themed = await page.evaluate(() => readIntroWaves())
    assert.equal(themed.uWaveTime, before.uWaveTime)
    assert.notDeepEqual(themed.uWaveBase, before.uWaveBase)
    await page.screenshot({ path: `${out}/${system ? 'system' : 'setting'}-still.png` })
    const renderer = await rendererIdentity(page)
    await page.locator('.identity-intro').press('Enter')
    await page.waitForSelector('[data-surface=hub] .menu-preview-target')
    // Regression: a still intro canvas used to leave these DOM panels hidden
    // when reduced-motion entry unmounted it. Assert the visible user content.
    assert(await page.locator('[data-surface=hub] .menu-preview-target').isVisible())
    assert.equal(await page.locator('.experience-canvas canvas').count(), 0)
    assert.deepEqual(errors, [])
    results.push({ system, before, themed, renderer, errors, status: 'PASS' })
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n')
}
console.log('PASS frozen waves/theme redraw and visible reduced-motion entry (OS and setting)')
