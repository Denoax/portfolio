import { themeColor, themePalette } from '../../core/theme'

type Mode = 'dark' | 'light'
let settings: Record<Mode, Map<string, string>> | undefined

// Read the existing stylesheet's pane variables rather than duplicate colours
// or temporarily switch the page's displayed theme to capture an endpoint.
function settingsColors() {
  if (settings) return settings
  settings = { dark: new Map(), light: new Map() }
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      // Inactive accessibility rules must not replace the normal endpoint
      // palette with system CanvasText/Canvas colours.
      if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue
      if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) continue
      if (rule instanceof CSSStyleRule && rule.selectorText.includes('.experience-settings')) {
        const mode = rule.selectorText.includes('light') ? 'light' : 'dark'
        for (const name of ['--settings-ink', '--settings-muted']) {
          const value = rule.style.getPropertyValue(name).trim()
          if (value) settings![mode].set(name, value)
        }
      } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of document.styleSheets) {
    if (sheet.href && new URL(sheet.href).origin !== location.origin) continue
    visit(sheet.cssRules)
  }
  return settings
}

export function panePaintColor(node: HTMLElement, mode: Mode) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const rgba = (value: string) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    return ctx.getImageData(0, 0, 1, 1).data
  }
  const style = getComputedStyle(node)
  const pairs: { current: Uint8ClampedArray; target: Uint8ClampedArray }[] = []
  for (const [name, endpoints] of Object.entries(themePalette)) {
    const current = style.getPropertyValue(`--${name}`).trim()
    if (current) pairs.push({ current: rgba(current), target: rgba(themeColor(endpoints[0], endpoints[1], Number(mode === 'light'))) })
  }
  for (const [name, target] of settingsColors()[mode]) {
    const current = style.getPropertyValue(name).trim()
    if (current) pairs.push({ current: rgba(current), target: rgba(target) })
  }
  const cache = new Map<string, string>()
  return (value: string) => {
    const known = cache.get(value)
    if (known) return known
    const color = rgba(value)
    const pair = color[3] && pairs.find(pair =>
      [0, 1, 2].every(channel => Math.abs(pair.current[channel] - color[channel]) <= 1),
    )
    const result = pair ? `rgba(${pair.target[0]},${pair.target[1]},${pair.target[2]},${color[3] / 255})` : value
    cache.set(value, result)
    return result
  }
}
