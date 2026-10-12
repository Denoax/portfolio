import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launchCaptureBrowser } from './v15-capture-browser.mjs'

const base = process.env.BASE_URL || 'https://manimarami.com'
const out = process.env.EVIDENCE_OUT || 'showcase/v23-evidence/deployment'
await mkdir(out, { recursive: true })
const browser = await launchCaptureBrowser()
const rows = []
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: out, size: { width, height } },
    })
    const page = await context.newPage()
    const errors = [],
      failedAssets = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (r) => {
      if (r.url().startsWith(base + '/assets/') && r.status() >= 400)
        failedAssets.push({ url: r.url(), status: r.status() })
    })
    const nav = async (name) => {
      if (width < 900)
        await page
          .getByRole('button', { name: 'Portfolio menu', exact: true })
          .click()
      await page.getByRole('button', { name, exact: true }).click()
    }
    await page.goto(base)
    await page.waitForFunction(
      () => window.__portfolio?.introZoom.instances > 0,
    )
    assert.equal(
      await page.locator('html').getAttribute('data-color-theme'),
      'light',
    )
    await page.screenshot({ path: `${out}/live-${width}-opening.png` })
    await page.locator('.identity-intro').focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-surface=hub]')
    await page.waitForSelector('.global-proximity-rail > button')
    await page.waitForSelector('.menu-preview-target[data-ready=true]')
    assert.equal(
      await page.locator('.global-proximity-rail > button').count(),
      8,
    )
    assert.equal(await page.locator('.rail-minor').count(), 21)
    const rail = page.locator('.global-proximity-rail > button')
    const secondId = await rail.nth(1).getAttribute('data-location-id')
    await rail.nth(1).click()
    await page.waitForFunction(
      (id) => __portfolio.menu.settledId === id,
      secondId,
    )
    const firstId = await rail.nth(0).getAttribute('data-location-id')
    await rail.nth(0).click()
    await page.waitForFunction(
      (id) => __portfolio.menu.settledId === id,
      firstId,
    )
    const preview = await page.locator('.menu-preview-target').boundingBox()
    await page.mouse.move(
      preview.x + preview.width * 0.4,
      preview.y + preview.height * 0.4,
    )
    await page.waitForFunction(
      () =>
        document.querySelector('video.owned-preview-decoder')?.currentTime > 0,
    )
    await page.screenshot({ path: `${out}/live-${width}-hub.png` })
    await nav('Settings')
    const brightness = page.getByRole('slider', {
      name: 'Brightness',
      exact: true,
    })
    await brightness.focus()
    await page.keyboard.press('Home')
    assert.equal(await brightness.inputValue(), '80')
    await page
      .getByRole('button', { name: 'Reset settings', exact: true })
      .click()
    assert.equal(await brightness.inputValue(), '100')
    assert.equal(
      await page
        .getByRole('slider', { name: 'Sound volume', exact: true })
        .inputValue(),
      '35',
    )
    await page.screenshot({ path: `${out}/live-${width}-settings.png` })
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => !document.querySelector('#experience-settings[open]'),
    )
    await nav('About me')
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => !document.querySelector('#info-panel[open]'),
    )
    assert.notEqual(
      await page.evaluate(() => document.activeElement.tagName),
      'BODY',
    )
    await page.locator('.ui-primary').click()
    await page.waitForSelector('[data-surface=world]', { timeout: 65000 })
    await page.screenshot({ path: `${out}/live-${width}-world.png` })
    if (width < 900)
      await page
        .getByRole('button', { name: 'Portfolio menu', exact: true })
        .click()
    await page
      .getByRole('button', { name: 'Return to projects', exact: true })
      .click()
    await page.waitForSelector('[data-surface=hub]')
    await page.locator('.theme-toggle').click()
    await page.waitForFunction(
      () => Number(document.documentElement.dataset.themeMix) === 0,
    )
    await page.screenshot({ path: `${out}/live-${width}-dark.png` })
    await page.reload()
    await page.waitForSelector('.global-proximity-rail > button')
    assert.equal(
      await page.locator('html').getAttribute('data-color-theme'),
      'dark',
    )
    await nav('About me')
    await page
      .getByRole('button', { name: 'Return to the start', exact: true })
      .click()
    await page.waitForSelector('.identity-intro')
    assert.deepEqual(errors, [])
    assert.deepEqual(failedAssets, [])
    rows.push({
      width,
      height,
      status: 'PASS',
      errors,
      failedAssets,
      runtime: await page.evaluate(() => structuredClone(__portfolio)),
    })
    const video = page.video()
    await context.close()
    await video.saveAs(`${out}/live-${width}-flow-unedited.webm`)
    await writeFile(
      `${out}/public-browser-results.json`,
      JSON.stringify(rows, null, 2) + '\n',
    )
    console.log('PASS public v23 flow', width, height)
  }
} finally {
  await browser.close()
}
