import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchCaptureBrowser } from './v15-capture-browser.mjs'

// Transform owned evidence; never recreate a screenshot as decorative media.
const out = resolve('showcase/github')
const evidence = process.env.EVIDENCE_ROOT || 'showcase/v23-evidence'
await mkdir(out, { recursive: true })
const sources = {
  'opening-dark.webp': `${evidence}/delivered/1440-900-dark-intro.png`,
  'projects-light.webp': `${evidence}/delivered/1440-900-light-hub.png`,
  'projects-dark.webp': `${evidence}/delivered/1440-900-dark-hub.png`,
  'settings-light.webp': `${evidence}/delivered/1440-900-light-Settings.png`,
  'settings-dark.webp': `${evidence}/delivered/1440-900-dark-Settings.png`,
  'mobile-opening.webp': `${evidence}/delivered/390-844-dark-intro.png`,
  'mobile-projects.webp': `${evidence}/delivered/390-844-light-hub.png`,
  'mobile-settings.webp': `${evidence}/delivered/390-844-dark-Settings.png`,
  'pelagic.webp': 'public/assets/previews/pelagic-poster.webp',
}
const hash = async (p) =>
  createHash('sha256')
    .update(await readFile(p))
    .digest('hex')
const files = []
for (const [name, source] of Object.entries(sources)) {
  const bytes = await readFile(source)
  if (name === 'pelagic.webp') await writeFile(`${out}/${name}`, bytes)
  else
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      source,
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-lossless',
      '1',
      `${out}/${name}`,
    ])
  files.push({
    path: name,
    source,
    sourceSHA256: await hash(source),
    sha256: await hash(`${out}/${name}`),
    operation:
      name === 'pelagic.webp'
        ? 'byte-identical owned poster'
        : 'lossless PNG to WebP; no crop or pixel change',
  })
}
const browser = await launchCaptureBrowser()
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 640 },
    deviceScaleFactor: 1,
  })
  await page.goto(pathToFileURL(`${out}/banner.html`).href)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((i) => i.decode()))
  })
  const input = '/tmp/portfolio-github-banner.png'
  await page.screenshot({ path: input })
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    input,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-lossless',
    '1',
    `${out}/portfolio-banner.webp`,
  ])
  files.push({
    path: 'portfolio-banner.webp',
    sha256: await hash(`${out}/portfolio-banner.webp`),
    source: 'banner.html and public/assets/previews/pelagic-poster.webp',
    operation:
      'original HTML/CSS typography composed with existing owned Pelagic poster; Chromium capture',
  })
} finally {
  await browser.close()
}
const video = `${evidence}/delivered/1440-900-dark-production-review-unedited.webm`
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-i',
  video,
  '-filter_complex',
  'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a',
  '-loop',
  '0',
  `${out}/interaction.gif`,
])
files.push({
  path: 'interaction.gif',
  source: video,
  sourceSHA256: await hash(video),
  sha256: await hash(`${out}/interaction.gif`),
  operation:
    'entire 3.96-second silent recording; original pace, 15fps, 960px wide, GIF palette',
})
await writeFile(
  `${out}/sources.json`,
  JSON.stringify(
    {
      runtimeRevision: '60d83a3c76f62a747893a4e9f93443a4e49c923f',
      reference: {
        url: 'https://github.com/Denoax/konata-hyprland-dotfiles',
        revision: 'e1e8ad65ccb7e7b20b82485f959d5249a5ff41b6',
        borrowed:
          'wide banner, centered intro, navigation, screenshot sections, comparison tables and collapsible portrait gallery; no reference artwork',
      },
      files,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Created ${files.length} visuals from owned evidence`)
