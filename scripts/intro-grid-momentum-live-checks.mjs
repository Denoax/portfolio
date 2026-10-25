import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {launchCaptureBrowser, rendererIdentity} from './v27-browser.mjs'

const base=process.env.BASE_URL,out=process.env.OUT
assert(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname))
assert(out,'Provide task-private OUT')
await mkdir(out,{recursive:true})
const browser=await launchCaptureBrowser(),receipt={status:'IN_PROGRESS',scenarios:[],errors:[]}
try {
 for(const theme of ['light','dark']) {
  const dir=out+'/'+theme;await mkdir(dir,{recursive:true})
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir,size:{width:1440,height:900}}})
  await context.addInitScript(theme=>{
   localStorage.setItem('portfolio:experience-settings:v1',JSON.stringify({version:2,theme,graphics:'high',soundVolume:0,ambienceVolume:0}))
   const proto=WebGL2RenderingContext.prototype,location=proto.getUniformLocation,use=proto.useProgram,locations={},wavePrograms=new WeakSet(),current=new WeakMap()
   let waveDraws=0
   proto.getUniformLocation=function(program,name){const l=location.call(this,program,name);if(name.startsWith('uWave'))locations[name]={gl:this,program,l};if(name==='uWaveTime')wavePrograms.add(program);return l}
   proto.useProgram=function(program){current.set(this,program);return use.call(this,program)}
   for(const method of ['drawArrays','drawElements']){const draw=proto[method];proto[method]=function(...args){if(wavePrograms.has(current.get(this)))waveDraws++;return draw.apply(this,args)}}
   window.readGridWaves=()=>({draws:waveDraws,uniforms:Object.fromEntries(Object.entries(locations).map(([name,{gl,program,l}])=>{const v=gl.getUniform(program,l);return[name,ArrayBuffer.isView(v)?[...v]:v]}))})
   const trace=[];window.gridMomentumTrace=trace
   const observe=input=>{
    const s=window.__portfolio?.introZoom;if(!s||trace.length>=6000)return
    trace.push({at:performance.now(),active:s.age,mode:s.transport.state,velocity:s.velocity,octave:s.octave,phase:s.phase,direction:s.transport.lastDirection,momentum:s.transport.wheelMomentum,input})
   }
   addEventListener('wheel',e=>{const mode=e.deltaMode,raw=e.deltaY,line=parseFloat(getComputedStyle(document.querySelector('.identity-intro')).lineHeight)||16;observe({raw,mode,pixels:-raw*(mode===1?line:mode===2?innerHeight:1),trusted:e.isTrusted,ctrl:e.ctrlKey})},{capture:true})
   const frame=()=>{observe(null);requestAnimationFrame(frame)};requestAnimationFrame(frame)
  },theme)
  const page=await context.newPage()
  page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text())})
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#portfolio-boot'));await page.waitForFunction(()=>window.__portfolio?.introZoom.instances>0&&readGridWaves().draws>2)
  const state=()=>page.evaluate(()=>structuredClone(__portfolio.introZoom))
  const initial=await state();assert.equal(initial.transport.state,'AUTO_OUT')
  assert(Math.abs((await page.evaluate(()=>readGridWaves())).uniforms.uWaveCellFrequency-900/40)<1e-6)
  await page.screenshot({path:dir+'/intro.png'})
  await page.mouse.move(240,660)
  for(let i=0;i<8;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(150)}
  const buildup=await state();assert.equal(buildup.transport.state,'COASTING');assert(buildup.velocity<-.1625)
  const startReverse=await page.evaluate(()=>performance.now())
  await page.mouse.wheel(0,-120);await page.waitForTimeout(50)
  assert((await state()).velocity<0,'Opposite wheel first brakes existing motion')
  for(let i=0;i<13;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(120)}
  const reversed=await state();assert(reversed.velocity>0);assert.equal(reversed.transport.lastDirection,1)
  await page.screenshot({path:dir+'/reversed.png'})
  await page.waitForTimeout(8000)
  const endReverse=await page.evaluate(()=>performance.now())
  const coast=await state();assert(coast.velocity>=0&&coast.velocity<.02);assert.equal(coast.transport.state,'COASTING')
  // These untrusted fixtures check event ownership only. Trusted wheel motion
  // and its observed input/velocity trace above remain separately identified.
  const ownership=await page.locator('.identity-intro').evaluate(node=>{
   const results=[]
   for(const props of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{deltaX:100,deltaY:1}]) {
    const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120,...props});node.dispatchEvent(e);results.push(e.defaultPrevented)
   }
   const button=document.createElement('button');button.textContent='Private scroll fixture';node.append(button)
   const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});button.dispatchEvent(e);results.push(e.defaultPrevented);button.remove()
   return results
  });assert(ownership.every(x=>x===false))
  await page.mouse.down();await page.waitForTimeout(450)
  const held=await state();assert.equal(held.transport.state,'HELD');assert.equal(held.velocity,0)
  await page.mouse.wheel(0,120);await page.waitForTimeout(150)
  const still=await state();assert.equal(still.phase,held.phase);assert.equal(still.octave,held.octave)
  await page.mouse.up();await page.waitForTimeout(1000)
  const released=await state();assert.equal(released.transport.lastDirection,-1)
  assert.equal(released.transport.committedToken,released.transport.releaseToken)
  await page.keyboard.press('+');await page.waitForTimeout(350);assert((await state()).velocity>0)
  const trace=await page.evaluate(()=>gridMomentumTrace)
  await writeFile(dir+'/input-velocity-trace.json',JSON.stringify(trace,null,2))
  const reversing=trace.filter(x=>x.at>=startReverse&&x.at<=endReverse&&!x.input)
  let crossings=0;for(let i=1;i<reversing.length;i++)if(reversing[i-1].velocity<0&&reversing[i].velocity>0)crossings++
  assert.equal(crossings,1)
  const trusted=trace.filter(x=>x.input?.trusted&&!x.input.ctrl);assert(trusted.length>=22)
  // Rapid theme retargets preserve the continuously increasing wave clock.
  const beforeTheme=await page.evaluate(()=>readGridWaves())
  for(let i=0;i<3;i++){await page.locator('.theme-toggle').click();await page.waitForTimeout(90)}
  await page.waitForTimeout(400);assert((await page.evaluate(()=>readGridWaves())).uniforms.uWaveTime>beforeTheme.uniforms.uWaveTime)
  await page.locator('.identity-intro').press('Enter');await page.waitForSelector('[data-surface=hub]')
  const worldsWave=await page.evaluate(()=>readGridWaves());await page.waitForTimeout(400)
  assert.deepEqual(await page.evaluate(()=>readGridWaves()),worldsWave,'No wave draws/uniform work in Worlds')
  await writeFile(dir+'/input-velocity-trace.json',JSON.stringify(trace,null,2))
  receipt.scenarios.push({theme,status:'PASS',renderer:await rendererIdentity(page),initial,buildup,reversed,coast,held,released,crossings,trustedWheelPackets:trusted.length,eventOwnership:ownership,scope:'Trusted automated Chromium wheel input; no physical mouse or trackpad claim'})
  await context.close()
 }
 assert.deepEqual(receipt.errors,[]);receipt.status='PASS'
 console.log('PASS native signed wheel buildup/brake/reverse/coast, hold/release, keyboard, event scope, theme and Worlds ownership')
} catch(error) {receipt.status='FAIL';receipt.failure=String(error);throw error}
finally {await browser.close();await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2))}
