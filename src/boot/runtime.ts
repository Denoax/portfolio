import {BootSession} from './BootSession'
export const boot = new BootSession((name, snapshot) => {
  performance.mark(`portfolio.boot.${name}`, {detail:{...snapshot}})
})
let fontState: 'pending' | 'ready' | 'failed' = 'pending'
let fonts: Promise<void> | null = null
export function nativeFonts() {
  return fonts ??= Promise.all(['14px "Instrument Sans Variable"','14px "IBM Plex Mono"','italic 22px "Portfolio Instrument Serif"'].map(async face => {
    const loaded = await document.fonts.load(face)
    if (!loaded.length || !document.fonts.check(face)) throw new Error('Required font unavailable')
  })).then(async () => {
    // The native catalogue also requests its existing display faces during
    // layout. FontFaceSet.ready includes those loads and their layout work;
    // waiting only for the atlas face could uncover a late native text swap.
    await document.fonts.ready
    if ([...document.fonts].some(face => face.status === 'error'))
      throw new Error('A requested native font failed')
  }).then(() => {fontState='ready'}, error => {fontState='failed';throw error})
}
export async function nativeTarget(root: HTMLElement, target: string) {
  const token = boot.begin(target)
  if (token === null) return
  const fallback = Boolean(boot.getSnapshot().reason)
  try {
    if (fallback && fontState !== 'ready') throw new Error('Use stable platform text during recovery')
    await nativeFonts()
    boot.resource(token,'native-fonts')
  } catch {
    root.dataset.fontFallback = 'true'
    boot.resource(token,'native-fonts','fallback')
  }
  // Layout of actual native content after the font outcome, not a mounted flag.
  if (!boot.current(token) || !root.getClientRects().length || !root.querySelector('a,button')) return
  boot.resource(token,'native-layout')
  requestAnimationFrame(() => boot.prime(token))
}
