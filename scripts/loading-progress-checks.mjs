import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function load(path) {
  const source = await readFile(path, 'utf8')
  const module = await import('node:module')
  let code
  if (module.stripTypeScriptTypes) code = module.stripTypeScriptTypes(source, {mode:'transform'})
  else {
    const ts = await import('typescript')
    code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  }
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
const {BootSession} = await load('src/boot/BootSession.ts')
const b = new BootSession(), renderer = {}, token = b.begin('intro', renderer)
assert.equal(b.getProgress(), 0)
for (const name of ['native-fonts','native-layout','ring-atlas','posters','foreground']) b.resource(token,name)
b.targetDraw(renderer)
assert(b.getProgress() < 100, 'Pending optional outcome still needs a stable result')
b.resource(token,'waves','fallback')
assert(b.getProgress() < 100, 'Resource completion alone must not announce ready')
b.targetDraw(renderer); assert.equal(b.getProgress(),100)
const stale = new BootSession(), old = stale.begin('intro', {})
stale.retire(old); const native = stale.begin('native')
stale.resource(old,'native-fonts'); assert.equal(stale.getProgress(),0)
stale.resource(native,'native-fonts','fallback'); stale.resource(native,'native-layout')
assert(stale.getProgress()<100); stale.prime(native); assert.equal(stale.getProgress(),100)
const failed = new BootSession(), f = failed.begin('intro',{})
failed.fail('font'); failed.resource(f,'native-fonts'); assert(failed.getProgress()<100)

// Exercise the actual presentation adapter without claiming browser rendering.
const nodes = Object.fromEntries(['number','fill','progress'].map(k=>[k,{style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v}}]))
const queue = new Map(); let id=0
globalThis.requestAnimationFrame = cb => {queue.set(++id,cb);return id}
globalThis.cancelAnimationFrame = key => queue.delete(key)
globalThis.matchMedia = () => ({matches:false})
globalThis.document = {hidden:false,documentElement:{dataset:{bootMotion:'less'}},addEventListener(){},removeEventListener(){}}
const {ProgressLoader} = await load('src/boot/ProgressLoader.ts')
const p = new ProgressLoader({querySelector:selector=>nodes[selector.match(/data-boot-(\w+)/)[1]]})
function frame(time) { const callbacks=[...queue.values()];queue.clear();callbacks.forEach(cb=>cb(time)) }
p.update(60);frame(16);assert.equal(nodes.number.textContent,'060');assert.equal(nodes.fill.style.transform,'scaleX(0.6)')
p.update(20);frame(32);assert.equal(nodes.number.textContent,'060','Replacement generation must not rewind the display')
p.update(100);frame(48);assert.equal(nodes.number.textContent,'099','Only actual priming completes the visible meter')
p.dispose();p.update(95);assert.equal(queue.size,0)
p.complete();assert.equal(nodes.number.textContent,'100');assert.equal(nodes.fill.style.transform,'scaleX(1)')
assert.equal(nodes.progress.attrs['aria-valuenow'],'100')
const {loadingMarkup} = await load('src/boot/loadingMarkup.ts')
const html = loadingMarkup({github:'https://github.com/Denoax?x=1&y=2',email:'a@example.com'})
assert(html.includes('data-boot-number aria-hidden="true">000'))
assert(html.includes('role="progressbar"') && html.includes('x=1&amp;y=2'))
assert(!/terminal-stream|SELECTED WORK|PROJECT NOTES|compile|<canvas/.test(html))
console.log('PASS real milestone readiness, optional failure, stale tokens, native readiness, monotone synchronized presentation, disposal, completion and minimal markup')
