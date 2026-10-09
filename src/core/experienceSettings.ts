import type { ThemePreference, ResolvedTheme } from './theme'
import type { QualityTier } from './quality'

export interface ExperienceSettings {
  version: 1
  theme: ThemePreference
  displayBrightness: number
  cursorSize: number
  scrollPace: number
  cloudDepth: number
  autoScrollSpeed: number
  soundVolume: number
  ambienceVolume: number
  graphics: 'auto' | 'balanced' | 'high'
  motion: 'system' | 'less'
}
export interface ExperiencePreferences {
  settings: ExperienceSettings
  panelOpen: boolean
  theme: ResolvedTheme
}
export const SETTINGS_KEY = 'portfolio:experience-settings:v1'
export const DEFAULT_SETTINGS: Readonly<ExperienceSettings> = Object.freeze({
  version: 1,
  theme: 'light',
  displayBrightness: 100,
  cursorSize: 100,
  scrollPace: 100,
  cloudDepth: 100,
  autoScrollSpeed: 1,
  soundVolume: 35,
  ambienceVolume: 65,
  graphics: 'auto',
  motion: 'system',
})
export const SETTING_BOUNDS = {
  autoScrollSpeed: [0.5, 4],
  displayBrightness: [80, 140],
  cursorSize: [80, 140],
  scrollPace: [75, 125],
  cloudDepth: [100, 150],
  soundVolume: [0, 100],
  ambienceVolume: [0, 100],
} as const
export function quantizeAutoSpeed(value: number) {
  return Number.isFinite(value) ? Math.round(Math.max(.5, Math.min(4, value)) * 10) / 10 : 1
}
export function validateSettings(value: unknown): ExperienceSettings {
  const result = { ...DEFAULT_SETTINGS }
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1
  )
    return result
  const input = value as Record<string, unknown>
  for (const key of Object.keys(
    SETTING_BOUNDS,
  ) as (keyof typeof SETTING_BOUNDS)[]) {
    if (key === 'autoScrollSpeed') continue // Fractional speed is validated below.
    const number = input[key],
      [min, max] = SETTING_BOUNDS[key]
    if (typeof number === 'number' && Number.isFinite(number))
      result[key] = Math.max(min, Math.min(max, Math.round(number)))
  }
  if (
    input.graphics === 'auto' ||
    input.graphics === 'balanced' ||
    input.graphics === 'high'
  )
    result.graphics = input.graphics
  if (
    typeof input.autoScrollSpeed === 'number' &&
    Number.isFinite(input.autoScrollSpeed)
  )
    result.autoScrollSpeed =
      quantizeAutoSpeed(input.autoScrollSpeed)
  // The old mute switch migrates once. Saved v14 values have no switch, so
  // deliberately raising master volume cannot be blocked by a stale flag.
  if (input.soundEnabled === false) result.soundVolume = 0
  if (input.theme === 'light' || input.theme === 'dark')
    result.theme = input.theme
  if (input.motion === 'system' || input.motion === 'less')
    result.motion = input.motion
  return result
}
export function loadSettings(): ExperienceSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    const next = validateSettings(saved)
    // v16 System had no opt-in provenance. Migrate once, retaining all values.
    if (saved?.version === 1 && saved.theme === 'system') saveSettings(next)
    return next
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}
export function saveSettings(settings: ExperienceSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
// CSS pixels, independent of drawing-buffer DPR. Only history is bounded;
// the current segment is analytic at full output resolution.
export function trailBudget(tier: QualityTier, width: number, height: number) {
  const [scale, cap] =
    tier === 'high'
      ? [1, 1920]
      : tier === 'balanced'
        ? [0.75, 1280]
        : [0.5, 960]
  const actual = Math.min(scale, cap / Math.max(1, width, height))
  const w = Math.max(1, Math.round(width * actual)),
    h = Math.max(1, Math.round(height * actual))
  return { width: w, height: h, bytes: w * h * 8 * 2 }
}
