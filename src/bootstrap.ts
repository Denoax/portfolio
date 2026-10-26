import {boot} from './boot/runtime'
import {ProgressLoader} from './boot/ProgressLoader'

const shell = document.getElementById('portfolio-boot')!
const root = document.getElementById('root')!
const status = document.getElementById('portfolio-boot-status')!
const retry = shell.querySelector<HTMLAnchorElement>('[data-boot-retry]')!
retry.href = location.href
window.dispatchEvent(new Event('portfolio:boot-connected'))
delete document.documentElement.dataset.bootHidden
const progress = new ProgressLoader(shell)
let raf = 0, last = 0, elapsed = 0, revealing = -1
const deadline = setTimeout(() => boot.fail('Preparation took too long'), Math.max(0,12000-performance.now()))
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches || (() => {
  try { return JSON.parse(localStorage.getItem('portfolio:experience-settings:v1') || 'null')?.motion === 'less' } catch { return false }
})()
const focusContent = () => {
  const active = document.activeElement
  if (active === document.body || (active instanceof Element && shell.contains(active)))
    (root.querySelector<HTMLElement>('.identity-intro') || root.querySelector<HTMLElement>('.hub-brand') || root.querySelector<HTMLElement>('h1,a'))?.focus({preventScroll:true})
}
const finish = (token: number) => {
  if (!boot.current(token)) return
  root.inert = false; root.removeAttribute('aria-busy')
  progress.dispose(); shell.remove()
  clearTimeout(deadline); document.removeEventListener('visibilitychange', visibility)
  unsubscribe(); boot.complete(token)
  // The React surface also owns an input fence. Focus after its COMPLETE
  // commit releases that fence, rather than attempting focus on an inert node.
  requestAnimationFrame(focusContent)
}
const frame = (now: number) => {
  const state = boot.getSnapshot()
  if (document.hidden || state.phase !== 'REVEALING' || state.generation !== revealing) return
  elapsed += last ? Math.min(50,now-last) : 0; last=now
  const duration = reduced() ? 100 : document.documentElement.dataset.colorTheme === 'light' ? 650 : 420
  const progress = Math.max(0,Math.min(1,elapsed/duration))
  // One cover dissolve. Release formation/transport only in the final third,
  // so loading never consumes the original opening's initial state.
  shell.style.opacity=String(1-progress)
  if (progress>=.65) boot.releaseMotion(revealing)
  if (progress===1) finish(revealing)
  else raf=requestAnimationFrame(frame)
}
const visibility = () => {
  cancelAnimationFrame(raf);last=0
  if (!document.hidden && boot.getSnapshot().phase==='REVEALING') raf=requestAnimationFrame(frame)
}
document.addEventListener('visibilitychange',visibility)
const unsubscribe = boot.subscribe(() => {
  const state=boot.getSnapshot();shell.dataset.phase=state.phase
  progress.update(boot.getProgress())
  if(state.phase==='PREPARING') status.textContent=state.target.startsWith('intro')?'Preparing the opening':'Preparing the portfolio'
  if(state.phase==='FALLBACK') {
    cancelAnimationFrame(raf);shell.style.opacity='1';progress.dispose()
    status.textContent='The interactive view is unavailable. Preparing a simpler view, or use the links below.'
    window.dispatchEvent(new Event('portfolio:boot-fallback'))
  }
  if(state.phase==='PRIMED') {
    revealing=state.generation;elapsed=last=0;progress.complete()
    boot.reveal(revealing)
    raf=requestAnimationFrame(frame)
  }
})

// Real paint scheduling only: readiness is exclusively the prepared target and
// complete render path. Hidden tabs can prepare without waiting for a paint.
async function shellPaint() {
  if (!document.hidden && typeof PerformanceObserver!=='undefined' && PerformanceObserver.supportedEntryTypes.includes('paint') &&
    !performance.getEntriesByName('first-contentful-paint').length) {
    await new Promise<void>(resolve=>{
      const done=()=>{observer.disconnect();document.removeEventListener('visibilitychange',hidden);resolve()}
      const hidden=()=>{if(document.hidden)done()}
      const observer=new PerformanceObserver(list=>{if(list.getEntries().some(e=>e.name==='first-contentful-paint'))done()})
      observer.observe({type:'paint',buffered:true})
      document.addEventListener('visibilitychange',hidden)
    })
  }
  await new Promise<void>(resolve=>setTimeout(resolve,0))
}
void shellPaint().then(async()=>{
  performance.mark('portfolio.boot.import-start')
  try { await import('./main');performance.mark('portfolio.boot.import-complete') }
  catch { boot.fail('Application import failed') }
})
