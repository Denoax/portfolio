import { useLayoutEffect, useState } from 'react'
import { CriticalDamper } from './criticalDamper'
import {linear,srgb,themeBase,toLinearThemeMix,fromLinearThemeMix,themeInkMix,themeContour} from './themeMotion'
export {themeInkMix,themeContour} from './themeMotion'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
// One displayed value serves DOM, the existing scene and its glass adapter.
// q=0 is dark; q=1 is light. Preference remains the persisted target.
let mix = Number(document.documentElement.dataset.colorTheme !== 'dark')
let initialized = false
const motion = new CriticalDamper(fromLinearThemeMix(mix))
export const displayedThemeMix = () => mix
const palette = {
  'site-base': themeBase,
  'site-ink': ['f4f4f2', '161a20'],
  'site-muted': ['b1b7c0', '525d68'],
  'hover-ink': ['ffffff', '000000'],
  'hover-surface': ['202020', 'dde1e5'],
  'nav-body': ['262626', 'e2e6ea'],
  'nav-selected': ['f4f4f2', '161a20'],
  'nav-selected-ink': ['141414', 'f3f5f7'],
  'field-base': ['101318', 'eceff2'],
  'activity-zero': ['21272b', 'd7dce0'],
  'settings-ink': ['f4f5f7', '161a20'],
  'settings-muted': ['c2c7d0', '424b56'],
} as const
// Read-only palette access for transient paint; display remains the sole owner.
export { palette as themePalette }
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
  // Retire the fixed inline first-paint background once the display owner
  // starts; the root/scrollbar edge must follow the same live palette too.
  root.style.backgroundColor = themeColor(...themeBase,q)
  root.dataset.themeMix = q.toFixed(5)
  // All native/GL ink uses the same smooth polarity crossover. A restrained
  // continuous edge is present only where foreground and background converge.
  const inkMix = themeInkMix(q)
  for (const [name, [dark, light]] of Object.entries(palette))
    root.style.setProperty(
      `--${name}`,
      themeColor(
        dark,
        light,
        name === 'site-ink' || name === 'nav-selected' || name === 'settings-ink' ? inkMix : q,
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
    '--nav-hover-surface',
    `color-mix(in srgb, ${themeColor(...palette['hover-surface'], q)} ${q * 100}%, transparent)`,
  )
  root.style.setProperty('--theme-contour',String(themeContour(q)))
  root.style.setProperty('--theme-settings-film',
    `color-mix(in srgb, ${themeColor('14171c','e9edf1',q)} ${78+8*q}%, transparent)`)
  root.style.setProperty('--pane-hover-surface',themeColor('202020','e7ebef',q))
  root.style.setProperty('--static-ring-edge',
    `color-mix(in srgb, ${themeColor('ffffff','161a20',q)} 19%, transparent)`)
  if (q===0 || q===1) root.style.colorScheme = q===1 ? 'light' : 'dark'
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
    if (!initialized) {
      initialized = true
      motion.reset(fromLinearThemeMix(target))
      display(target)
      return
    }
    // The displayed mix already owns the dissolve. A second CSS interpolation
    // would delay button bodies and SVG necks by different amounts.
    root.dataset.themeTransitioning = 'true'
    let raf = 0,
      last = 0
    const response =
      motionLess || shortDissolve || preference === 'system' ? 0.028 : 0.24
    // Exact critically damped integration is partition independent. Retargeting
    // starts at the displayed color; no overlay, duplicate renderer or queues.
    const tick = (now: number) => {
      const dt =
        last && !document.hidden ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      // CriticalDamper's smoothTime uses omega=2/smoothTime. The 0.24s
      // response is a time constant, not the complete transition duration.
      const next = motion.step(target,response*2,dt)
      motion.value = Math.max(0,Math.min(1,next))
      if (motion.value!==next) motion.velocity=0
      display(toLinearThemeMix(motion.value))
      if (Math.abs(motion.value - target) < 0.0002 && Math.abs(motion.velocity) < 0.003) {
        motion.reset(target)
        display(target)
        delete root.dataset.themeTransitioning
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
      delete root.dataset.themeTransitioning
    }
  }, [theme, motionLess, shortDissolve, preference])
  return theme
}
