import { themeColor, themePalette } from '../../core/theme'

type Mode = 'dark' | 'light'
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
