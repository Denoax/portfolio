import { useLayoutEffect, useState } from 'react'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
// One displayed value serves DOM, the existing scene and its glass adapter.
// q=0 is dark; q=1 is light. Preference remains the persisted target.
let mix = Number(document.documentElement.dataset.colorTheme !== 'dark')
let initialized = false
let velocity = 0
export const displayedThemeMix = () => mix
const linear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
const srgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
const palette = {
  'site-base': ['080808', 'f3f5f7'],
  'site-ink': ['f4f4f2', '161a20'],
  'site-muted': ['b1b7c0', '525d68'],
  'hover-ink': ['a8d8f2', '15202b'],
  'hover-surface': ['182631', 'c9e8f8'],
  'nav-body': ['262626', 'e2e6ea'],
  'nav-selected': ['f4f4f2', '161a20'],
  'nav-selected-ink': ['141414', 'f3f5f7'],
  'field-base': ['101318', 'eceff2'],
  'activity-zero': ['21272b', 'd7dce0'],
} as const
export function themeColor(dark: string, light: string, q: number) {
  const values = [0, 2, 4].map((i) =>
    Math.round(
      255 *
        srgb(
          linear(parseInt(dark.slice(i, i + 2), 16) / 255) * (1 - q) +
            linear(parseInt(light.slice(i, i + 2), 16) / 255) * q,
        ),
    ),
  )
  return `rgb(${values.join(' ')})`
}
function display(q: number) {
  mix = q
  const root = document.documentElement
  root.style.setProperty('--theme-mix', String(q))
  root.dataset.themeMix = q.toFixed(5)
  // Ink crosses sooner than the linear-light substrate. A bounded opposite
  // contour keeps semantic text legible during the unavoidable polarity change.
  const inkMix = Math.min(1, Math.max(0, (q - 0.08) / 0.3))
  for (const [name, [dark, light]] of Object.entries(palette))
    root.style.setProperty(
      `--${name}`,
      themeColor(
        dark,
        light,
        name === 'site-ink' || name === 'nav-selected' ? inkMix : q,
      ),
    )
  root.style.setProperty(
    '--line',
    `color-mix(in srgb, ${themeColor('ffffff', '161a20', q)} 22%, transparent)`,
  )
  root.style.setProperty(
    '--button',
    `color-mix(in srgb, ${themeColor('ffffff', '161a20', q)} 3%, transparent)`,
  )
  root.style.setProperty(
    '--ink-contour',
    `color-mix(in srgb, ${q < 0.23 ? '#080808' : '#f3f5f7'} ${Math.sin(Math.PI * q) * 75}%, transparent)`,
  )
  root.style.setProperty('--buddy-body', themeColor('101010', 'e0e5e9', q))
  root.style.setProperty('--buddy-rim', themeColor('626262', 'ffffff', q))
  root.style.setProperty('--buddy-face', themeColor('ffffff', '171c22', q))
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColor('080808', 'f3f5f7', q))
}
export function useSiteTheme(
  preference: ThemePreference,
  shortDissolve = false,
) {
  const [systemLight, setSystemLight] = useState(
    () => matchMedia('(prefers-color-scheme: light)').matches,
  )
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: light)')
    const change = () => setSystemLight(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const theme: ResolvedTheme =
    preference === 'system' ? (systemLight ? 'light' : 'dark') : preference
  const [motionLess, setMotionLess] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setMotionLess(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useLayoutEffect(() => {
    const root = document.documentElement,
      target = Number(theme === 'light')
    root.dataset.colorTheme = theme
    root.style.colorScheme = theme
    if (!initialized) {
      initialized = true
      display(target)
      return
    }
    let raf = 0,
      last = 0
    const duration =
      motionLess || shortDissolve || preference === 'system' ? 0.028 : 0.12
    // Exact critically damped integration is partition independent. Retargeting
    // starts at the displayed color; no overlay, duplicate renderer or queues.
    const tick = (now: number) => {
      const dt =
        last && !document.hidden ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      const omega = 1 / duration,
        offset = mix - target,
        a = velocity + omega * offset,
        e = Math.exp(-omega * dt)
      const next = target + (offset + a * dt) * e
      velocity = (velocity - omega * a * dt) * e
      display(Math.max(0, Math.min(1, next)))
      if (Math.abs(mix - target) < 0.0002 && Math.abs(velocity) < 0.003) {
        display(target)
        return
      }
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    const visibility = () => {
      last = 0
      cancelAnimationFrame(raf)
      if (!document.hidden) tick(performance.now())
    }
    tick(performance.now())
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [theme, motionLess, shortDissolve, preference])
  return theme
}
