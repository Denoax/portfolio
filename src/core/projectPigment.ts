export type LinearRGB = [number, number, number]
export interface Pigment {
  lightness: number
  chroma: number
  hue: number
  rgb: LinearRGB
}
// D65 linear sRGB/Oklab equations: Björn Ottosson's public-domain derivation.
// https://bottosson.github.io/posts/oklab/ . UI accents are never changed here.
export function linearToLab([r, g, b]: readonly number[]) {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b)
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b)
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
  return [.2104542553 * l + .793617785 * m - .0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .808675766 * s] as LinearRGB
}
function labToLinear(lightness: number, a: number, b: number): LinearRGB {
  const l = (lightness + .3963377774 * a + .2158037573 * b) ** 3
  const m = (lightness - .1055613458 * a - .0638541728 * b) ** 3
  const s = (lightness - .0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
}
function gamut(lightness: number, chroma: number, hue: number): Pigment {
  let low = 0, high = chroma
  const within = (rgb: LinearRGB) => rgb.every(channel => channel >= 0 && channel <= 1)
  let rgb = labToLinear(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue))
  if (!within(rgb)) {
    for (let i = 0; i < 18; i++) {
      const c = (low + high) / 2
      if (within(labToLinear(lightness, c * Math.cos(hue), c * Math.sin(hue)))) low = c
      else high = c
    }
    chroma = low
    rgb = labToLinear(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue))
  }
  return { lightness, chroma, hue, rgb }
}
export function deriveProjectPigment(hex: string, neutral = false): Pigment {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Invalid project accent')
  const srgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = srgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  const [l, a, b] = linearToLab(linear)
  const chroma = Math.hypot(a, b), hue = Math.atan2(b, a)
  return gamut(Math.max(.53, Math.min(.66, l - .17)), neutral ? chroma : Math.min(.23, chroma * 1.7 + .035), hue)
}
export function mixProjectPigment(from: Pigment, to: Pigment, progress: number): Pigment {
  const t = Math.max(0, Math.min(1, progress))
  const delta = Math.atan2(Math.sin(to.hue - from.hue), Math.cos(to.hue - from.hue))
  return gamut(from.lightness + (to.lightness - from.lightness) * t,
    from.chroma + (to.chroma - from.chroma) * t, from.hue + delta * t)
}
