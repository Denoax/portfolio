// Re-encode existing real browser recordings without capturing the site again.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('./assets/',import.meta.url))
for(const name of ['gravity-motion','field-motion']){
  const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${root}${name}.mp4`,'-filter_complex','fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',`${root}${name}.gif`],{encoding:'utf8'})
  if(r.status!==0)throw Error(r.stderr)
  console.log(`Encoded ${name}.gif`)
}
