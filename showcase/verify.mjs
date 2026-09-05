import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
let checked=0
for(const file of ['README.md','showcase/README.md']){
  const text=readFileSync(resolve(root,file),'utf8')
  const links=[...text.matchAll(/(?:src|href)="([^"]+)"|\]\(([^)]+)\)/g)].map(m=>m[1]||m[2])
  for(const link of links){
    if(/^(https?:|mailto:|#)/.test(link))continue
    if(!existsSync(resolve(root,dirname(file),link.split('#')[0])))throw Error(`Missing ${link} in ${file}`)
    checked++
  }
  for(const image of text.matchAll(/<img\b[^>]*>/g))if(!/alt="[^"]+"/.test(image[0]))throw Error(`Missing image alt text: ${file}`)
}
for(const name of ['gravity-motion','field-motion']){
  const r=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,duration','-of','json',resolve(root,'showcase/assets',`${name}.gif`)],{encoding:'utf8'})
  if(r.status!==0)throw Error(r.stderr)
  const stream=JSON.parse(r.stdout).streams[0]
  if(Number(stream.nb_frames)<2||Number(stream.duration)<10)throw Error(`Invalid animation ${name}`)
  console.log(name,stream)
}
for(const mode of ['screens','banner','motion']){
  const report=JSON.parse(readFileSync(resolve(root,`showcase/${mode}-capture.json`),'utf8'))
  if(report.errors.length||report.observations.some(o=>!o.ready||o.overflow!==0))throw Error(`Capture failed: ${mode}`)
}
console.log(`Verified ${checked} local links, both animated GIFs, image alt text, and capture readiness.`)
