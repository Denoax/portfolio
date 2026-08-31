import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.PORTFOLIO_URL ?? 'http://127.0.0.1:5173/'
const outputDirectory = join(tmpdir(), 'mani-portfolio-qa')
await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const issues = []

async function captureSet(name, viewport, states) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`${name} console: ${message.text()}`)
  })
  page.on('pageerror', (error) => issues.push(`${name} page: ${error.message}`))
  page.on('requestfailed', (request) => issues.push(`${name} request: ${request.url()}`))
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.site.is-ready')
  await page.waitForTimeout(900)
  const dimensions = await page.evaluate(() => ({
    scrollRange: document.documentElement.scrollHeight - window.innerHeight,
    canvas: document.querySelectorAll('canvas').length,
    title: document.title,
    gpuPath: document.documentElement.dataset.gpuPath,
  }))

  for (const state of states) {
    await page.evaluate(({ progress, range }) => window.scrollTo(0, progress * range), {
      progress: state.progress,
      range: dimensions.scrollRange,
    })
    await page.waitForTimeout(1100)
    await page.screenshot({ path: join(outputDirectory, `${name}-${state.label}.png`) })
  }

  const externalLinks = await page.locator('a[target="_blank"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  )
  await page.close()
  return { dimensions, externalLinks }
}

const desktop = await captureSet('desktop', { width: 1440, height: 900 }, [
  { label: 'hero', progress: 0 },
  { label: 'identity', progress: 1 / 7 },
  { label: 'career', progress: 2 / 7 },
  { label: 'infrastructure', progress: 3 / 7 },
  { label: 'icpc', progress: 4 / 7 },
  { label: 'education', progress: 5 / 7 },
  { label: 'human', progress: 6 / 7 },
  { label: 'contact', progress: 1 },
])

const mobile = await captureSet('mobile', { width: 390, height: 844 }, [
  { label: 'hero', progress: 0 },
  { label: 'mid', progress: 3 / 7 },
  { label: 'contact', progress: 1 },
])

const reducedPage = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' })
await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' })
await reducedPage.waitForSelector('.site.is-ready')
await reducedPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.5))
await reducedPage.waitForTimeout(200)
const reducedMotion = await reducedPage.evaluate(() => ({
  ready: document.querySelector('.site')?.classList.contains('is-ready'),
  activeChapter: document.querySelector('.frame-ui__chapter span:last-child')?.textContent,
}))
await reducedPage.close()

const interactionPage = await browser.newPage({ viewport: { width: 1366, height: 768 } })
await interactionPage.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl })
await interactionPage.goto(baseUrl, { waitUntil: 'networkidle' })
await interactionPage.waitForSelector('.site.is-ready')
await interactionPage.locator('.frame-ui__chapter').click()
await interactionPage.getByRole('button', { name: /07 HORIZON/ }).click()
await interactionPage.waitForTimeout(1800)
await interactionPage.locator('.contact-links button').click()
const interactions = await interactionPage.evaluate(() => ({
  chapter: document.querySelector('.frame-ui__chapter span:last-child')?.textContent,
  emailState: document.querySelector('.contact-links button span')?.textContent,
  scrollProgress: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--narrative-progress')),
}))
await interactionPage.reload({ waitUntil: 'networkidle' })
interactions.refreshReady = await interactionPage.locator('.site.is-ready').isVisible()
await interactionPage.close()

const viewportMatrix = []
for (const viewport of [
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  const page = await browser.newPage({ viewport })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.site.is-ready')
  viewportMatrix.push(await page.evaluate(() => ({
    viewport: [window.innerWidth, window.innerHeight],
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    canvas: document.querySelectorAll('canvas').length,
  })))
  await page.close()
}

const fallbackContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
await fallbackContext.addInitScript(() => {
  Reflect.deleteProperty(Navigator.prototype, 'gpu')
})
const fallbackPage = await fallbackContext.newPage()
await fallbackPage.goto(baseUrl, { waitUntil: 'networkidle' })
await fallbackPage.waitForSelector('.site.is-ready')
const fallback = await fallbackPage.evaluate(() => ({
  gpuPath: document.documentElement.dataset.gpuPath,
  canvas: document.querySelectorAll('canvas').length,
}))
await fallbackContext.close()
await browser.close()

console.log(JSON.stringify({ outputDirectory, desktop, mobile, reducedMotion, interactions, viewportMatrix, fallback, issues }, null, 2))
if (issues.length) process.exitCode = 1
