// Neutral cube-root luminance is a temporal coordinate, not a new palette or
// full Oklab transform. Published q still means the existing linear-light mix.
export const themeBase = ['080808', 'f3f5f7'] as const
export const linear = (value: number) => value <= 0.04045
  ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
export const srgb = (value: number) => value <= 0.0031308
  ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
const clamp = (value: number) => Math.max(0,Math.min(1,value))
const luminance = (hex: string) => [0,2,4].reduce((sum,index,channel) =>
  sum + linear(parseInt(hex.slice(index,index+2),16)/255) * [0.2126,0.7152,0.0722][channel],0)
const darkY = luminance(themeBase[0]), lightY = luminance(themeBase[1])
const darkL = Math.cbrt(darkY), lightL = Math.cbrt(lightY)
export const toLinearThemeMix = (p: number) => p <= 0 ? 0 : p >= 1 ? 1 :
  clamp(((darkL + (lightL-darkL)*p) ** 3-darkY)/(lightY-darkY))
export const fromLinearThemeMix = (q: number) => q <= 0 ? 0 : q >= 1 ? 1 :
  clamp((Math.cbrt(darkY+(lightY-darkY)*q)-darkL)/(lightL-darkL))
const smooth = (low: number, high: number, value: number) => {
  const t = clamp((value-low)/(high-low))
  return t*t*(3-2*t)
}
export const themeInkMix = (q: number) => smooth(0.08,0.38,q)
// Only support the polarity crossover, instead of outlining most of the fade.
export const themeContour = (q: number) => 0.45 * smooth(0.14,0.23,q) * (1-smooth(0.34,0.43,q))
