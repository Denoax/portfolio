import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { launchCaptureBrowser, rendererIdentity } from './v27-browser.mjs'

// Public read-only release smoke, adapted from v24 with current ten-project
// state and held pressure. No authentication bypass or application mutation.
const base = process.env.BASE_URL || 'https://manimarami.com'
const out = process.env.EVIDENCE_OUT || 'showcase/releases/v28-1-pressure/browser-local'
assert.equal(new URL(base).origin, 'https://manimarami.com')
assert.equal(process.env.V27_NATIVE_GL, '1')
const buildState = JSON.parse(await readFile(process.env.BUILD_STATE || 'showcase/releases/v28-1-pressure/build-state.json', 'utf8'))
assert.equal(buildState.runtimeRevision, process.env.RUNTIME_SHA, 'Supply the frozen runtime RUNTIME_SHA')
const expected = new Map(buildState.files.map(row => [row.path, row]))
const sha = data => createHash('sha256').update(data).digest('hex')
const response = await fetch(base + '/', { signal: AbortSignal.timeout(20000) })
assert.equal(response.status, 200, 'Public homepage must be accessible without authentication')
const bytes = Buffer.from(await response.arrayBuffer()), html = bytes.toString('utf8')
assert.equal(sha(bytes), expected.get('index.html')?.sha256, 'Public index differs from the frozen release')
const served = [{ path: 'index.html', bytes: bytes.length, sha256: sha(bytes) }]
for (const match of html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)) {
  const url = new URL(match[1], base)
  assert.equal(url.origin, new URL(base).origin)
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const bytes = Buffer.from(await response.arrayBuffer()), path = url.pathname.replace(/^\//, '')
  assert.equal(sha(bytes), expected.get(path)?.sha256, 'Public entry script differs from the frozen release')
  served.push({ path, bytes: bytes.length, sha256: sha(bytes) })
}
assert(served.some(row => /^assets\/.+\.js$/.test(row.path)))
const source = { runtimeRevision: buildState.runtimeRevision, base, served,
  binding: 'Anonymous public index and entry JavaScript match the frozen compiled inventory. Full asset identity and GitHub release SHA are verified separately.' }
const projectIds = JSON.parse(await readFile('src/content/projectOrder.json', 'utf8')).map(row => row.id)
assert.equal(projectIds.length, 10)
await mkdir(out, { recursive: true })
await writeFile(`${out}/public-source.json`, JSON.stringify(source, null, 2) + '\n')
const browser = await launchCaptureBrowser(), rows = []
try {
  for (const [width, height, dpr, theme] of [[1440, 900, 1, 'dark'], [390, 844, 2, 'light']]) {
    const name = `${width}x${height}-dpr${dpr}-${theme}`, dir = `${out}/${name}`
    await mkdir(dir, { recursive: true })
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr,
      hasTouch: width < 720, recordVideo: { dir, size: { width, height } } })
    await context.addInitScript(theme => {
      localStorage.setItem('portfolio:experience-settings:v1', JSON.stringify({ version: 2, theme, soundVolume: 0 }))
      sessionStorage.removeItem('portfolio:intro:v11')
      window.__publicInputs = []
      for (const type of ['pointerdown', 'pointerup', 'wheel', 'keydown']) addEventListener(type, event =>
        __publicInputs.push({ type, at: performance.now(), trusted: event.isTrusted, x: event.clientX,
          y: event.clientY, deltaY: event.deltaY, key: event.key }), { capture: true })
    }, theme)
    const page = await context.newPage(), errors = [], failedAssets = [], snapshots = [], gpuFrames = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('response', response => { if (response.url().startsWith(base + '/assets/') && response.status() >= 400)
      failedAssets.push({ url: response.url(), status: response.status() }) })
    let failure = null, row, stage = 'opening'
    const sample = async label => {
      const value = await page.evaluate(label => ({ label, at: performance.now(),
        runtime: window.__portfolio ? structuredClone(__portfolio) : null,
        requestedDpr: devicePixelRatio, theme: document.documentElement.dataset.colorTheme,
        activeIntro: !!document.querySelector('.identity-intro') }), label)
      snapshots.push(value); return value
    }
    const nav = async name => {
      if (width < 900 && !await page.getByRole('button', { name, exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Portfolio menu', exact: true }).click()
        await page.waitForFunction(() => !window.__paneFlights || __paneFlights.active === 0)
      }
      await page.getByRole('button', { name, exact: true }).click()
    }
    try {
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.__portfolio?.introZoom.instances > 0 && __portfolio.introZoom.cueAge > 6.6)
      const identity = await rendererIdentity(page)
      assert(identity.renderer && !/swiftshader|llvmpipe/i.test(identity.renderer))
      assert.equal(await page.locator('html').getAttribute('data-color-theme'), theme)
      await page.screenshot({ path: `${dir}/opening.png` })
      stage = 'held public pressure'
      await page.mouse.move(width - 30, height - 30)
      await page.mouse.down()
      await page.waitForFunction(() => __portfolio.introZoom.transport.state === 'HELD')
      await page.waitForTimeout(1000)
      const gpu = async label => {
        const value = await page.evaluate(label => new Promise(resolve => requestAnimationFrame(() => {
          const canvas = document.querySelector('.experience-canvas canvas'), gl = canvas.getContext('webgl2')
          const size = Math.floor(Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight) * .8)
          const x = Math.floor((gl.drawingBufferWidth - size) / 2), y = Math.floor(gl.drawingBufferHeight * .475 - size / 2)
          const pixels = new Uint8Array(size * size * 4)
          gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          let changedAbove8 = 0, maximumDelta = 0, minimumRgb = 255, maximumRgb = 0
          const output = document.createElement('canvas'); output.width = size; output.height = size
          const context = output.getContext('2d'), image = context.createImageData(size, size)
          for (let index = 0; index < pixels.length; index += 4) {
            let delta = 0
            for (let channel = 0; channel < 3; channel++) {
              minimumRgb = Math.min(minimumRgb, pixels[index + channel]); maximumRgb = Math.max(maximumRgb, pixels[index + channel])
              if (window.__publicPreviousPixels) delta = Math.max(delta, Math.abs(pixels[index + channel] - __publicPreviousPixels[index + channel]))
            }
            if (delta > 8) changedAbove8++
            maximumDelta = Math.max(maximumDelta, delta)
            const px = (index / 4) % size, py = Math.floor(index / 4 / size)
            image.data.set(pixels.subarray(index, index + 4), ((size - 1 - py) * size + px) * 4)
          }
          window.__publicPreviousPixels = pixels
          context.putImageData(image, 0, 0)
          resolve({ label, at: performance.now(), error: gl.getError(), size, changedAbove8, maximumDelta,
            minimumRgb, maximumRgb, intro: structuredClone(__portfolio.introZoom), framebuffer: structuredClone(__portfolio.framebuffer),
            png: output.toDataURL('image/png').split(',')[1] })
        })), label)
        await writeFile(`${dir}/${label}-gpu.png`, Buffer.from(value.png, 'base64')); delete value.png
        gpuFrames.push(value); return value
      }
      const heldFirst = await gpu('held-first')
      await page.waitForTimeout(350)
      const heldSecond = await gpu('held-second')
      for (const field of ['octave', 'phase']) assert.equal(heldSecond.intro[field], heldFirst.intro[field])
      assert.equal(heldSecond.intro.transport.angularTime, heldFirst.intro.transport.angularTime)
      assert.equal(heldSecond.intro.geometryId, heldFirst.intro.geometryId)
      assert(heldFirst.intro.ripples.every(ripple => !ripple.active) && heldSecond.intro.ripples.every(ripple => !ripple.active))
      assert(heldSecond.intro.age > heldFirst.intro.age)
      assert.equal(heldFirst.error, 0); assert.equal(heldSecond.error, 0)
      assert(heldFirst.maximumRgb - heldFirst.minimumRgb > 60)
      assert(heldSecond.changedAbove8 > 30 && heldSecond.maximumDelta > 16, 'Public held glyph pixels must vary while canonical spin/zoom stay fixed')
      await page.screenshot({ path: `${dir}/held-pressure.png` })
      await page.mouse.up()
      await page.waitForFunction(() => __portfolio.introZoom.transport.state === 'AUTO_IN')
      const reversed = await sample('public release reversed once')
      assert.equal(reversed.runtime.introZoom.transport.committedToken, heldFirst.intro.transport.activeGesture)
      await page.mouse.click(width * .5, height * .5, { delay: 60 })
      stage = 'ten-project Worlds and scroll'
      // The preview is preloaded behind the opening. It does not establish
      // completion of the visible, loader-free transition into Worlds.
      await page.waitForSelector('[data-surface=hub]')
      await page.locator('.identity-intro').waitFor({ state: 'detached' })
      await page.waitForSelector('.menu-preview-target[data-ready=true]')
      const actualIds = await page.locator('.menu-project[data-project-id]').evaluateAll(nodes => nodes.map(node => node.dataset.projectId))
      assert.deepEqual(actualIds, projectIds)
      assert.equal(await page.locator('.global-proximity-rail > button').count(), 10)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, projectIds[0])
      await page.mouse.move(width * .5, height * .7)
      await page.mouse.wheel(0, height * .85)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, projectIds[1])
      await sample('real forward scroll second project')
      await page.mouse.wheel(0, -height * .85)
      await page.waitForFunction(id => __portfolio.menu.settledId === id, projectIds[0])
      await sample('real reverse scroll first project')
      await page.screenshot({ path: `${dir}/worlds.png` })
      stage = 'settings open and close'
      await nav('Settings')
      await page.locator('#experience-settings[open]').waitFor()
      await page.waitForFunction(() => !window.__paneFlights || __paneFlights.active === 0)
      await page.screenshot({ path: `${dir}/settings.png` })
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('#experience-settings[open]'))
      stage = 'Pelagic journey launch and early-descent return'
      await page.locator('.menu-project[data-current=true] .ui-primary').click()
      await page.waitForSelector('[data-surface=world]', { timeout: 65000 })
      await sample('public original Pelagic')
      await page.screenshot({ path: `${dir}/pelagic.png` })
      await nav('Return to projects')
      await page.waitForSelector('[data-surface=hub]')
      await page.waitForSelector('.menu-preview-target[data-ready=true]')
      await sample('public return to Worlds')
      await page.screenshot({ path: `${dir}/returned.png` })
      const inputs = await page.evaluate(() => __publicInputs)
      assert(inputs.length && inputs.every(event => event.trusted))
      assert.deepEqual(errors, []); assert.deepEqual(failedAssets, [])
      row = { name, status: 'PASS', source, identity, snapshots, gpuFrames, actualIds, inputs, errors, failedAssets,
        scope: 'Anonymous public HTTPS on identified native Chromium. Actual held framebuffer ink changes with canonical radial/spin pose fixed; trusted release/short click, ten project IDs/order, one real forward/reverse wheel scroll, Settings open/Escape, Pelagic journey launch into the early Earth descent and Return. Full jellyfish arrival is not traversed. Original unedited recording; no uniform/controller mutation, authentication bypass, remote writes, timing benchmark, physical-device or Brave/Safari approval. Portrait/DPR2 is emulation; allocated buffer is recorded.' }
    } catch (error) {
      failure = error
      await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {})
      row = { name, status: 'FAIL', stage, error: String(error.stack || error), source, snapshots, gpuFrames, errors, failedAssets }
    } finally {
      const video = page.video(); await context.close()
      if (video) {
        const path = `${dir}/unedited-public.webm`
        await video.saveAs(path); await video.delete()
        const bytes = await readFile(path)
        row.recording = { path: `${name}/unedited-public.webm`, bytes: bytes.length, sha256: sha(bytes),
          metadata: JSON.parse(execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-show_entries',
            'stream=codec_name,width,height,r_frame_rate:format=duration,size', '-of', 'json', path], { encoding: 'utf8' })) }
      }
      rows.push(row)
      await writeFile(`${dir}/result.json`, JSON.stringify(row, null, 2) + '\n')
      await writeFile(`${out}/public-browser-results.json`, JSON.stringify({ status: failure ? 'FAIL' : 'PASS', source, rows }, null, 2) + '\n')
    }
    if (failure) throw failure
    console.log('PASS public latest pressure/ten-project/settings/Pelagic flow', name)
  }
} finally { await browser.close() }
