import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile('src/boot/BootSession.ts','utf8'),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {BootSession}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const events=[],b=new BootSession((name,snapshot)=>events.push({name,...snapshot})),renderer={}
const a=b.begin('intro',renderer);b.targetDraw(renderer);assert.equal(b.getSnapshot().phase,'PREPARING')
for(const name of ['native-fonts','native-layout','ring-atlas','posters','foreground'])b.resource(a,name)
b.targetDraw(renderer);assert.equal(b.getSnapshot().phase,'PREPARING','Optional wave must resolve ready or stable fallback')
b.resource(a,'waves','fallback');b.targetDraw(renderer);assert.equal(b.getSnapshot().phase,'PRIMED')
assert.equal(b.getSnapshot().resources.waves,'fallback');b.targetDraw(renderer);assert.equal(events.filter(x=>x.name==='target-draw').length,1)
b.reveal(a);assert(!b.getSnapshot().motionAllowed);b.releaseMotion(a);assert(b.getSnapshot().motionAllowed);b.complete(a)
assert.equal(b.begin('another',{}),null);b.fail('late');b.retire(a);assert.equal(b.getSnapshot().phase,'COMPLETE')
const stale=new BootSession(),oldRenderer={},newRenderer={},old=stale.begin('intro',oldRenderer)
stale.retire(old);const next=stale.begin('worlds',newRenderer)
for(const name of ['native-fonts','native-layout','ring-atlas','posters','foreground','waves'])stale.resource(old,name)
stale.targetDraw(oldRenderer);stale.reveal(old);stale.complete(old);assert.equal(stale.getSnapshot().phase,'PREPARING');assert.deepEqual(stale.getSnapshot().resources,{})
for(const name of ['native-fonts','native-layout','ring-atlas','posters','foreground','waves'])stale.resource(next,name)
stale.targetDraw(newRenderer);assert.equal(stale.getSnapshot().phase,'PRIMED')
const failure=new BootSession(),failedToken=failure.begin('intro',{})
failure.fail('font');failure.resource(failedToken,'native-fonts');failure.prime(failedToken);assert.equal(failure.getSnapshot().phase,'FALLBACK')
const native=failure.begin('hub-static');failure.resource(native,'native-fonts','fallback');failure.resource(native,'native-layout');failure.prime(native);failure.reveal(native);failure.complete(native)
assert.equal(failure.getSnapshot().phase,'COMPLETE');assert.equal(failure.getSnapshot().reason,'font')
if(process.env.OUT){await mkdir(process.env.OUT,{recursive:true});await writeFile(process.env.OUT+'/receipt.json',JSON.stringify({status:'PASS',scope:'Actual production boot owner; resource/target dependencies, optional stable failure, stale generation, exactly-once reveal, late failure, native recovery',events},null,2))}
console.log('PASS actual boot prerequisites, token identity, optional stability, exactly-once completion and native fallback')
