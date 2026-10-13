import snapshot from './publicRepositories.json'
import order from './projectOrder.json'
import previewRefresh from './previewRefresh.json'

export interface Project {
  id: string
  fullName: string
  title: string
  titleLines: string[]
  description: string
  kind: 'webgl' | 'desktop' | 'cli' | 'web' | 'code' | 'documentation'
  presentation: 'media' | 'gravity' | 'activity'
  accent: string
  publishedRevision: string
  capturedSourceRevision: string
  repository: string
  action:
    | { kind: 'pelagic'; label: string }
    | { kind: 'link'; label: string; href: string }
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
      accent: order.find((item) => item.id === String(repo.id))!
        .accent_preserved,
      publishedRevision: repo.observed_head ?? '',
      capturedSourceRevision:
        refreshed?.sourceRevision ??
        (name === 'codex-hermes-router'
          ? 'ed330a88b60013a0e9377a0d4802331f4ecbd965'
          : name === 'portfolio'
            ? 'local v11 candidate based on 45c06c2; see capture manifest'
            : (repo.observed_head ?? '')),
      repository: repo.html_url,
      action:
        name === 'pelagic-jellyfish-webgl'
          ? { kind: 'pelagic', label: 'Explore' }
          : {
              kind: 'link',
              label: 'View resource',
              href:
                name === 'Denoax' ? 'https://github.com/Denoax' : repo.html_url,
            },
      image: `${base}-poster.webp`,
      portrait: ['cli', 'code'].includes(kind)
        ? `${base}-portrait.webp`
        : `${base}-poster.webp`,
      video: `${base}.webm`,
      mp4: `${base}.mp4`,
      portraitVideo: ['cli', 'code'].includes(kind)
        ? `${base}-portrait.webm`
        : `${base}.webm`,
      portraitMp4: ['cli', 'code'].includes(kind)
        ? `${base}-portrait.mp4`
        : `${base}.mp4`,
      gif: `${base}.gif`,
      portraitGif: ['cli', 'code'].includes(kind)
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
    'Every public repository must have exactly one factual project and real media',
  )
