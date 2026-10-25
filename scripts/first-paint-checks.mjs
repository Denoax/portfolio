import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import ts from 'typescript'
const root=process.env.SOURCE_ROOT||'.',out=process.env.OUT
const html=await readFile(resolve(root,'index.html'),'utf8')
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('dataset.colorTheme')&&s.includes('portfolio:experience-settings:v1'))
assert(script,'Locate actual production first-paint theme owner')
const source=await readFile(resolve(root,'src/core/experienceSettings.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {validateSettings}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const rows=[]
const cases=[null,{},[],true,'dark',0,{version:3,theme:'dark'},{version:2,theme:'system'},... [1,2].flatMap(version=>['light','dark','invalid',null].map(theme=>({version,theme})))]
for(const saved of cases)for(const storage of ['valid','denied','corrupt']) {
 const root={dataset:{},style:{}},meta={}
 const raw=storage==='corrupt'?'{invalid':JSON.stringify(saved)
 vm.runInNewContext(script,{localStorage:{getItem:()=>{if(storage==='denied')throw Error('Denied');return raw}},document:{documentElement:root,querySelector:()=>meta}})
 const expected=validateSettings(storage==='valid'?saved:null).theme
 const row={saved,storage,firstPaint:root.dataset.colorTheme,expected};rows.push(row)
 assert.equal(row.firstPaint,expected,JSON.stringify(row));assert.equal(root.style.colorScheme,expected)
}
if(out){await mkdir(out,{recursive:true});await writeFile(out+'/receipt.json',JSON.stringify({status:'PASS',cases:rows},null,2))}
console.log('PASS '+rows.length+' actual bootstrap/settings parity cases, including v1/v2 and corrupt/denied storage')
