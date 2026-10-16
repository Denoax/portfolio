import snapshot from './publicRepositories.json'
import order from './projectOrder.json'
import previewRefresh from './previewRefresh.json'
import nativePreviews from './nativePreviews.json'

interface NativePreview {
  name: string
  sourceRevision: string
  idle: { src: string; portrait?: string }
  hover: { webm: string; mp4: string; gif: string; portraitWebm?: string; portraitMp4?: string; portraitGif?: string } | null
}

export interface Project {
  id: string
  fullName: string
  title: string
  titleLines: string[]
  description: string
  kind: 'webgl' | 'desktop' | 'cli' | 'web' | 'code' | 'documentation'
  presentation: 'media' | 'gravity' | 'activity'
  previewMotion: boolean
  accent: string
  publishedRevision: string
  capturedSourceRevision: string
  repository: string
  upstream?: string
  action: { kind: 'link'; label: string; href: string }
  image: string
  portrait: string
  video: string
  mp4: string
  portraitVideo: string
  portraitMp4: string
  gif: string
  portraitGif: string
  background: string
}

// Copy and media are curated independently of the public API snapshot. A new
// public repository requires a real capture, rather than invented artwork.
const content = [
  [
    'pelagic-jellyfish-webgl',
    'Pelagic',
    ['Pelagic'],
    'A living WebGL ocean.',
    'webgl',
    'pelagic',
    '#020b17',
  ],
  [
    'visual-music',
    'Visual Music',
    ['Visual Music'],
    'A dance floor you can fly through.',
    'webgl',
    'visual-music-v2751',
    '#020b17',
  ],
  [
    'konata-hyprland-dotfiles',
    'Konatachan Desktop',
    ['Konatachan', 'Desktop'],
    'Kona V3. Arch Linux. Hyprland. Quickshell.',
    'desktop',
    'kona',
    '#08111f',
  ],
  [
    'codex-hermes-router',
    'Codex × Hermes',
    ['Codex ×', 'Hermes'],
    'Bounded delegation. Verified action.',
    'cli',
    'codex-hermes',
    '#08111f',
  ],
  [
    'hermes-workspace',
    'Hermes Workspace',
    ['Hermes', 'Workspace'],
    'Local projects, conversations and file review.',
    'desktop',
    'hermes-workspace-v2751',
    '#08111f',
  ],
  [
    'paseo-kona',
    'Paseo Kona',
    ['Paseo Kona'],
    'A Kona theme and desktop integration for Paseo.',
    'desktop',
    'paseo-kona',
    '#10141c',
  ],
  [
    'janktrace',
    'janktrace',
    ['janktrace'],
    'A streaming Chrome trace analyser.',
    'cli',
    'janktrace',
    '#08111f',
  ],
  [
    'farm-stand',
    'Farm Stand',
    ['Farm Stand'],
    'A photographed farm website demonstration.',
    'web',
    'farm-stand',
    '#171710',
  ],
  [
    'Kattis',
    'Kattis',
    ['Kattis'],
    'C++ solutions to Open Kattis problems.',
    'code',
    'kattis',
    '#08111f',
  ],
  [
    'portfolio',
    'Portfolio',
    ['Portfolio'],
    'Projects, motion and a living ocean.',
    'webgl',
    'portfolio',
    '#020b17',
  ],
  [
    'Denoax',
    'GitHub Profile',
    ['GitHub', 'Profile'],
    'Documentation linking my public work.',
    'documentation',
    'profile',
    '#08111f',
  ],
] as const

const catalogue: Project[] = content.map(
  ([name, title, lines, description, kind, media, background]) => {
    const repo = snapshot.repositories.find((item) => item.name === name)
    if (!repo)
      throw new Error(
        `Public catalogue entry is absent from the verified snapshot: ${name}`,
      )
    const refreshed = previewRefresh.entries.find((entry) => entry.name === name)
    const base = `/assets/previews/${refreshed?.mediaStem ?? media}`
    const native = (nativePreviews.entries as NativePreview[]).find((entry) => entry.name === name)
    const previewMotion = native ? native.hover !== null : refreshed?.motion !== false
    return {
      id: String(repo.id),
      fullName: repo.full_name,
      title,
      titleLines: [...lines],
      description,
      kind,
      presentation:
        name === 'portfolio'
          ? 'gravity'
          : name === 'Denoax'
            ? 'activity'
            : 'media',
      previewMotion,
      accent: order.find((item) => item.id === String(repo.id))!
        .accent,
      publishedRevision: repo.observed_head ?? '',
      capturedSourceRevision:
        native?.sourceRevision ?? refreshed?.sourceRevision ??
        (name === 'codex-hermes-router'
          ? 'ed330a88b60013a0e9377a0d4802331f4ecbd965'
          : name === 'portfolio'
            ? 'local v11 candidate based on 45c06c2; see capture manifest'
            : (repo.observed_head ?? '')),
      repository: repo.html_url,
      upstream: name === 'paseo-kona' ? 'https://github.com/getpaseo/paseo' : undefined,
      action: {
        kind: 'link',
        label:
          name === 'pelagic-jellyfish-webgl'
            ? 'Explore'
            : name === 'visual-music'
              ? 'Play'
              : 'View resource',
        href:
          name === 'visual-music'
            ? 'https://denoax.github.io/visual-music/'
            : name === 'Denoax'
              ? 'https://github.com/Denoax'
              : repo.html_url,
      },
      image: native?.idle.src ?? `${base}-poster.webp`,
      portrait: native ? native.idle.portrait ?? native.idle.src : ['cli', 'code'].includes(kind)
        ? `${base}-portrait.webp`
        : `${base}-poster.webp`,
      video: native ? native.hover?.webm ?? '' : previewMotion ? `${base}.webm` : '',
      mp4: native ? native.hover?.mp4 ?? '' : previewMotion ? `${base}.mp4` : '',
      portraitVideo: native ? native.hover?.portraitWebm ?? native.hover?.webm ?? '' : !previewMotion
        ? ''
        : ['cli', 'code'].includes(kind)
          ? `${base}-portrait.webm`
          : `${base}.webm`,
      portraitMp4: native ? native.hover?.portraitMp4 ?? native.hover?.mp4 ?? '' : !previewMotion
        ? ''
        : ['cli', 'code'].includes(kind)
          ? `${base}-portrait.mp4`
          : `${base}.mp4`,
      gif: native ? native.hover?.gif ?? '' : previewMotion ? `${base}.gif` : '',
      portraitGif: native ? native.hover?.portraitGif ?? native.hover?.gif ?? '' : !previewMotion
        ? ''
        : ['cli', 'code'].includes(kind)
          ? `${base}-portrait.gif`
          : `${base}.gif`,
      background,
    }
  },
)
export const projects: Project[] = order.map((item) => {
  const project = catalogue.find(
    (entry) => entry.id === item.id && entry.fullName === item.full_name,
  )
  if (!project)
    throw new Error(`Project order has an unknown identity: ${item.full_name}`)
  return project
})
if (
  projects.length !== snapshot.repositories.length ||
  new Set(projects.map((p) => p.id)).size !== projects.length
)
  throw new Error(
    'Every catalogue repository must have exactly one factual project and real media',
  )
