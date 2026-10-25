import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import ts from 'typescript'
const moduleFrom=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'))
const {toLinearThemeMix:toQ,fromLinearThemeMix:toP,themeInkMix,themeContour}=await moduleFrom('src/core/themeMotion.ts')
const {CriticalDamper}=await moduleFrom('src/core/criticalDamper.ts')
for(let i=0;i<=1000;i++){const p=i/1000;assert(Math.abs(toP(toQ(p))-p)<1e-12);assert(toQ(p)>=toQ(Math.max(0,p-.001)));assert(themeInkMix(p)>=0&&themeInkMix(p)<=1);assert(themeContour(p)>=0&&themeContour(p)<=.45)}
assert.equal(toQ(-1),0);assert.equal(toQ(2),1);assert.equal(themeContour(0),0);assert.equal(themeContour(1),0)
const runs=[]
for(const direction of [0,1])for(const hz of [30,60,120,240]){
 const spring=new CriticalDamper(1-direction),samples=[]
 for(let i=0;i<=hz*3;i++){const p=i?spring.step(direction,.48,1/hz):spring.value,q=toQ(p);assert(p>=0&&p<=1);samples.push({at:i/hz,p,q})}
 for(let i=1;i<samples.length;i++)assert((samples[i].p-samples[i-1].p)*(direction?1:-1)>=0)
 runs.push({direction,hz,end:samples.at(-1),peakLightnessStep:Math.max(...samples.slice(1).map((x,i)=>Math.abs(x.p-samples[i].p)))})
}
for(const direction of [0,1]){const a=runs.filter(x=>x.direction===direction);for(const x of a)assert(Math.abs(x.end.p-a[0].end.p)<1e-12)}
for(const run of runs.filter(x=>x.hz===60))assert(run.peakLightnessStep<.026)
const spring=new CriticalDamper(1);spring.step(0,.48,.05);spring.step(0,.48,.05);const before={value:spring.value,velocity:spring.velocity};const p=spring.step(1,.48,0);assert.equal(p,before.value);assert.equal(spring.velocity,before.velocity)
for(let i=0;i<2400;i++){const q=toQ(spring.step(Math.floor(i/13)%2,.48,1/240));assert(q>=0&&q<=1&&Number.isFinite(q))}
const out=process.env.OUT;if(out){await mkdir(out,{recursive:true});await writeFile(out+'/receipt.json',JSON.stringify({status:'PASS',scope:'Actual production mapping and existing exact damper; neutral-lightness proxy only, not a comfort or GPU claim',runs,reversalPreservesCoordinateAndVelocity:before},null,2))}
console.log('PASS production lightness mapping, bounded endpoints, monotonicity, frame partitions and rapid reversal state')
