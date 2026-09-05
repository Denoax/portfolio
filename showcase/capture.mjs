// Real browser captures. Does not change the portfolio's source or rendering.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const output = resolve(root, 'assets')
const mode = process.argv[2] || 'screens'
const url = process.argv[3] || 'http://127.0.0.1:4194/'
const chrome = process.env.CHROME_BIN
if (!chrome) throw Error('Set CHROME_BIN to a Chromium-compatible browser or wrapper.')
const profile = mkdtempSync('/tmp/portfolio-capture-browser-')
const frames = mkdtempSync('/tmp/portfolio-capture-frames-')
const port = Number(process.env.CDP_PORT || 9273)
mkdirSync(output, { recursive: true })
const browser = spawn(chrome, ['--headless=new','--no-sandbox','--hide-scrollbars','--use-gl=angle','--use-angle=gl',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let socket
const errors = []
const observations = []
try {
  let page
  for (let i=0;i<100;i++) {
    try { page=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method:'PUT'})).json(); break } catch { await sleep(100) }
  }
  if (!page) throw Error('Browser did not start')
  socket=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r=>socket.addEventListener('open',r,{once:true}))
  let id=0
  const pending=new Map()
  socket.addEventListener('message',({data})=>{
    const m=JSON.parse(data)
    if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}
    else if(m.method==='Runtime.exceptionThrown'||(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'))errors.push(m.params)
  })
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const n=++id
    const timeout=setTimeout(()=>{pending.delete(n);reject(Error(`Timeout: ${method}`))},25000)
    pending.set(n,m=>{clearTimeout(timeout);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)})
    socket.send(JSON.stringify({id:n,method,params}))
  })
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
    if(r.exceptionDetails)throw Error(r.exceptionDetails.text)
    return r.result?.value
  }
  const viewport=(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  const screenshot=async name=>{
    const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
    writeFileSync(resolve(output,`${name}.png`),Buffer.from(s.data,'base64'))
    console.log(`Saved ${name}.png`)
  }
  const open=async()=>{
    await send('Page.navigate',{url})
    let ready=false
    for(let i=0;i<140;i++){
      ready=await evaluate("!!document.querySelector('.site.is-ready')")
      if(ready)break
      await sleep(100)
    }
    if(!ready)throw Error('Portfolio did not reach ready state')
    await evaluate('document.fonts.ready')
    await sleep(1300)
  }
  const scroll=async p=>{
    await evaluate(`window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${p})`)
    await sleep(1500)
  }
  const observe=async label=>{
    observations.push({label,...await evaluate(`({title:document.title,viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth-innerWidth,ready:!!document.querySelector('.site.is-ready'),path:document.documentElement.dataset.gpuPath,chapter:document.querySelector('.frame-ui__chapter')?.innerText,links:[...document.querySelectorAll('a[href]')].map(e=>({text:e.textContent,href:e.getAttribute('href')}))})`)})
  }
  await send('Page.enable');await send('Runtime.enable')
  await viewport(1440,900)
  await open()
  if(mode==='screens'){
    for(const [name,p] of [['signal',0],['identity',1/7],['orbital-history',2/7],['infrastructure',3/7],['algorithm',4/7],['dual-system',5/7],['human-signal',6/7],['horizon',1]]){
      await scroll(p);await screenshot(`desktop-${name}`);await observe(name)
    }
    await viewport(390,844);await open()
    for(const [name,p] of [['signal',0],['infrastructure',3/7],['horizon',1]]){
      await scroll(p);await screenshot(`portrait-${name}`);await observe(`portrait-${name}`)
    }
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await open();await observe('reduced-motion')
  } else if(mode==='banner'){
    await viewport(1800,800);await open()
    // A designed repository cover, not an unaltered application screenshot.
    // Retain the actual live WebGL canvas; replace only DOM for the cover.
    const css=readFileSync(resolve(root,'banner.css'),'utf8')
    const markup=readFileSync(resolve(root,'banner.html'),'utf8')
    await evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);const cover=document.createElement('div');cover.innerHTML=${JSON.stringify(markup)};document.body.append(cover)})()`)
    await sleep(1000);await screenshot('banner');await observe('designed-cover')
  } else if(mode==='motion'){
    await viewport(1120,700);await open()
    const fps=12
    // Two genuinely animated chapters. Return along the scroll path for a soft loop.
    for(const [name,start,end,duration] of [['gravity-motion',0,1/7,12],['field-motion',3/7,4/7,12]]){
      await scroll(start)
      const count=duration*fps
      const began=performance.now()
      for(let i=0;i<count;i++){
        const t=i/fps
        const travel=t<6.5?Math.max(0,Math.min(1,(t-1.5)/3.5)):1-Math.max(0,Math.min(1,(t-6.5)/3.5))
        const p=start+(end-start)*travel*travel*(3-2*travel)
        await evaluate(`window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${p})`)
        const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
        writeFileSync(resolve(frames,`${name}-${String(i).padStart(4,'0')}.png`),Buffer.from(s.data,'base64'))
        await sleep(Math.max(0,began+(i+1)*1000/fps-performance.now()))
      }
      const mp4=resolve(output,`${name}.mp4`)
      const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr)}
      run(['-framerate',String(fps),'-i',resolve(frames,`${name}-%04d.png`),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',mp4])
      run(['-i',mp4,'-filter_complex','fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',resolve(output,`${name}.gif`)])
      await observe(name);console.log(`Saved ${name}.gif + .mp4`)
    }
  } else throw Error(`Unknown mode ${mode}`)
  writeFileSync(resolve(root,`${mode}-capture.json`),JSON.stringify({url,mode,observations,errors},null,2)+'\n')
  if(errors.length)throw Error(`${errors.length} browser errors; inspect ${mode}-capture.json`)
}finally{
  socket?.close();browser.kill('SIGTERM');await sleep(500)
  rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})
  rmSync(frames,{recursive:true,force:true,maxRetries:5,retryDelay:200})
}
