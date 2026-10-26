import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {launchCaptureBrowser,rendererIdentity} from './v27-browser.mjs'

const base=process.env.BASE_URL,out=process.env.OUT
assert(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname));assert(out)
await mkdir(out,{recursive:true})
const browser=await launchCaptureBrowser({ignoreDefaultArgs:['--disable-back-forward-cache']}),receipt={status:'IN_PROGRESS',scope:'Native Chromium automated input and labeled production fault injection; BFCache enabled by removing the automation default flag. No physical-device or assistive-technology approval',cases:[]}
const marks=page=>page.evaluate(()=>performance.getEntriesByType('mark').filter(x=>x.name.startsWith('portfolio.boot')).map(x=>({name:x.name,at:x.startTime,state:x.detail})))
const complete=page=>page.waitForFunction(()=>performance.getEntriesByName('portfolio.boot.complete').length===1,null,{timeout:22000})
async function run(name,{fault='',path='',context:options={},delay=0}={},check=async()=>{}) {
 if(process.env.CASES&&!process.env.CASES.split(',').includes(name))return
 const dir=out+'/'+name;await mkdir(dir,{recursive:true})
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir,size:{width:1440,height:900}},...options})
 const item={name,fault,status:'IN_PROGRESS',errors:[],console:[]};receipt.cases.push(item)
 let page
 try {
  await context.addInitScript(({fault})=>{
   localStorage.setItem('portfolio:experience-settings:v1',JSON.stringify({version:2,theme:'dark',graphics:'high',soundVolume:0,ambienceVolume:0}))
   const contexts=new Set(),original=HTMLCanvasElement.prototype.getContext
   window.bootProbe={contexts:0,frames:[],visibility:[],pageshow:[]}
   HTMLCanvasElement.prototype.getContext=function(type,...args){if(fault==='webgl-unavailable'&&type.startsWith('webgl'))return null;const value=original.call(this,type,...args);if(type==='webgl2'&&value){contexts.add(value);bootProbe.contexts=contexts.size}return value}
   const source=WebGL2RenderingContext.prototype.shaderSource
   if(['optional-wave-shader','required-shader'].includes(fault))WebGL2RenderingContext.prototype.shaderSource=function(shader,text){if((fault==='optional-wave-shader'&&text.includes('uniform float uWaveTime'))||(fault==='required-shader'&&text.includes('licensed-IBM-Plex-Mono')))text+='\n INVALID_INJECTED_SHADER;';return source.call(this,shader,text)}
   // A link-status fault exercises the actual foreground rejection owner.
   if(fault==='required-shader'){const get=WebGL2RenderingContext.prototype.getProgramParameter;WebGL2RenderingContext.prototype.getProgramParameter=function(p,key){return key===this.LINK_STATUS?false:get.call(this,p,key)}}
   if(fault==='fonts-reject')document.fonts.load=()=>Promise.reject(new Error('Labeled required-font rejection fixture'))
   addEventListener('pageshow',e=>bootProbe.pageshow.push({at:performance.now(),persisted:e.persisted}))
   document.addEventListener('visibilitychange',()=>bootProbe.visibility.push({at:performance.now(),hidden:document.hidden}))
   const sample=t=>{if(bootProbe.frames.length<3000)bootProbe.frames.push({at:t,phase:document.getElementById('portfolio-boot')?.dataset.phase,opacity:document.getElementById('portfolio-boot')?.style.opacity,rootInert:document.getElementById('root')?.inert,age:window.__portfolio?.introZoom.age,inputBlocked:window.__portfolio?.introZoom.inputBlocked,gesture:window.__portfolio?.introZoom.transport.gestureSequence,momentum:window.__portfolio?.introZoom.transport.wheelMomentum,contexts:bootProbe.contexts});requestAnimationFrame(sample)};requestAnimationFrame(sample)
  },{fault})
  if(['entry-abort','bootstrap-abort'].includes(fault))await context.route(fault==='entry-abort'?/\/assets\/main-[^/]+\.js/:/\/assets\/index-[^/]+\.js/,route=>route.abort('failed'))
  if(delay)await context.route(/\/assets\/main-[^/]+\.js/,async route=>{await new Promise(resolve=>setTimeout(resolve,delay));await route.continue()})
  if(fault==='fonts-delay')await context.route(/\.(woff2?|ttf)(\?|$)/,async route=>{await new Promise(resolve=>setTimeout(resolve,2800));await route.continue()})
  if(fault==='display-font-delay')await context.route(/\/SixCaps\.ttf$/,async route=>{await new Promise(resolve=>setTimeout(resolve,2800));await route.continue()})
  if(fault==='display-font-failure')await context.route(/\/SixCaps\.ttf$/,route=>route.abort('failed'))
  if(fault==='posters-delay')await context.route(/-poster\.webp/,async route=>{await new Promise(resolve=>setTimeout(resolve,2400));await route.continue()})
  if(fault==='posters-timeout')await context.route(/-poster\.webp/,async route=>{await new Promise(resolve=>setTimeout(resolve,14500));try{await route.continue()}catch{}})
  page=await context.newPage();item.renderer=null
  page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))item.console.push({type:m.type(),text:m.text()})})
  await page.goto(base+path,{waitUntil:'domcontentloaded'})
  await check(page,item,context)
  item.marks=await marks(page);item.probe=await page.evaluate(()=>bootProbe);item.renderer=await rendererIdentity(page)
  await page.screenshot({path:dir+'/final.png'})
  if(!fault)assert.deepEqual(item.errors,[])
  item.status='PASS'
 }catch(error){item.status='FAIL';item.failure=error.stack;console.error(name,item.failure);if(page){item.marks=await marks(page);item.probe=await page.evaluate(()=>({probe:bootProbe,active:document.activeElement?.outerHTML,root:document.getElementById('root')?.outerHTML.slice(0,800)}));await page.screenshot({path:dir+'/failure.png'})}}
 finally{await context.close();await writeFile(dir+'/receipt.json',JSON.stringify(item,null,2));console.log(name,item.status)}
}
try {
 await run('delayed-import-input-fence',{delay:2800},async(page,item)=>{
  await page.waitForSelector('#portfolio-boot');assert.equal(await page.locator('#portfolio-boot [data-boot-number]').textContent(),'000')
  assert.equal(await page.locator('#portfolio-boot pre,#portfolio-boot canvas,#portfolio-boot header').count(),0)
  assert.equal(await page.locator('#portfolio-boot [data-boot-fill]').count(),1)
  assert(await page.locator('#root').evaluate(n=>n.inert));await page.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0);await page.screenshot({path:out+'/delayed-import-input-fence/shell.png'})
  await page.mouse.move(500,500);await page.mouse.wheel(0,900);await page.mouse.down();await page.keyboard.press('Enter');await page.waitForTimeout(400);await page.mouse.up()
  assert.equal(await page.locator('.identity-intro').count(),0,'Main is still delayed while real HTML shell is visible')
  await complete(page);assert(await page.locator('.identity-intro').isVisible());assert.equal(await page.locator('#portfolio-boot').count(),0)
  const frames=await page.evaluate(()=>bootProbe.frames),before=frames.filter(x=>['PREPARING','PRIMED'].includes(x.phase)&&x.age!==undefined)
  assert(before.every(x=>x.age===0&&x.momentum===0&&x.gesture===0));assert.equal(await page.evaluate(()=>__portfolio.introZoom.transport.gestureSequence),0)
  assert.equal(await page.locator('#root').evaluate(n=>n.inert),false);await page.waitForFunction(()=>document.querySelector('.identity-intro')===document.activeElement)
  const m=await marks(page)
  item.paint=await page.evaluate(()=>performance.getEntriesByType('paint').map(x=>({name:x.name,at:x.startTime})))
  assert(item.paint.find(x=>x.name==='first-contentful-paint').at<=m.find(x=>x.name.endsWith('import-start')).at)
  item.sameCanvas={createdWebGLContexts:await page.evaluate(()=>bootProbe.contexts),scope:'One real WebGL renderer; no throwaway availability context and no reveal-time context creation'}
  assert.equal(item.sameCanvas.createdWebGLContexts,1)
  const during=frames.filter(x=>x.phase==='REVEALING');assert(during.length>0);assert.equal(new Set(during.map(x=>x.contexts)).size,1)
  await page.waitForTimeout(700)
 })
 for(const fault of ['fonts-delay','posters-delay'])await run(fault,{fault},async(page)=>{await page.waitForTimeout(900);assert(await page.locator('#portfolio-boot').isVisible());assert.equal((await marks(page)).filter(x=>x.name.endsWith('reveal')).length,0);await complete(page);const m=await marks(page);assert(m.find(x=>x.name.endsWith('reveal')).at>2200)})
 await run('display-font-delay',{fault:'display-font-delay',path:'#worlds'},async(page)=>{await page.waitForTimeout(900);assert(await page.locator('#portfolio-boot').isVisible());assert.equal((await marks(page)).filter(x=>x.name.endsWith('reveal')).length,0);await complete(page);assert((await marks(page)).find(x=>x.name.endsWith('reveal')).at>2200)})
 await run('display-font-failure',{fault:'display-font-failure',path:'#worlds'},async(page)=>{await complete(page);assert((await marks(page)).some(x=>x.name.endsWith('fallback')));assert.equal(await page.locator('.experience-canvas canvas').count(),0);assert.equal(await page.locator('[data-font-fallback=true]').count(),1);assert(await page.locator('.menu-preview-target').first().isVisible())})
 for(const fault of ['entry-abort','bootstrap-abort'])await run(fault,{fault},async(page)=>{
  await page.waitForFunction(()=>document.querySelector('#portfolio-boot')?.dataset.phase==='FALLBACK',null,{timeout:16000});assert(await page.locator('[data-boot-retry]').isVisible());assert(await page.locator('#portfolio-boot a[href^="https://github.com/"]').isVisible());assert.equal(await page.locator('#root').evaluate(n=>n.inert),true)
 })
 for(const fault of ['fonts-reject','required-shader','webgl-unavailable','posters-timeout'])await run(fault,{fault},async(page)=>{await complete(page);assert(await page.locator('.identity-intro').isVisible());assert.equal(await page.locator('.experience-canvas canvas').count(),0);assert((await marks(page)).some(x=>x.name.endsWith('fallback')));await page.locator('.identity-intro').press('Enter');await page.waitForSelector('[data-surface=hub] .menu-preview-target');assert(await page.locator('.menu-preview-target').first().isVisible())})
 await run('optional-wave-shader',{fault:'optional-wave-shader'},async(page)=>{await complete(page);const m=await marks(page);assert(m.some(x=>x.name.endsWith('resource:waves:fallback')));assert(!m.some(x=>x.name.endsWith('.fallback')));assert.equal(await page.locator('.experience-canvas canvas').count(),1)})
 await run('context-loss-preparing',{delay:1500},async(page)=>{await page.waitForSelector('.experience-canvas canvas');await page.locator('.experience-canvas canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await complete(page);assert((await marks(page)).some(x=>x.name.endsWith('fallback')));assert.equal(await page.locator('.experience-canvas canvas').count(),0)})
 await run('direct-worlds',{path:'#worlds'},async(page)=>{await complete(page);assert.equal(await page.locator('.identity-intro').count(),0);assert(await page.locator('[data-surface=hub]').isVisible());assert.equal((await marks(page)).filter(x=>x.name==='portfolio.boot.complete').length,1);await page.getByRole('button',{name:'About me',exact:true}).click();await page.getByRole('button',{name:'Return to the start',exact:true}).click();await page.waitForSelector('.identity-intro');assert.equal(await page.locator('#portfolio-boot').count(),0)})
 for(const path of ['credits','work/pelagic'])await run('direct-'+path.replace('/','-'),{path},async(page)=>{await complete(page);assert.equal(await page.locator('.experience-canvas canvas').count(),0);assert(await page.locator('h1').first().isVisible())})
 await run('portrait-reduced-touch',{context:{viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true,isMobile:true}},async(page)=>{await complete(page);assert(await page.locator('.intro-static-rings').isVisible());await page.locator('.identity-intro').tap();await page.waitForSelector('[data-surface=hub] .menu-preview-target');assert.equal(await page.locator('.experience-canvas canvas').count(),0)})
 await run('hidden-freeze-return',{delay:1500},async(page,item,context)=>{
  const cdp=await context.newCDPSession(page);await page.waitForSelector('.experience-canvas canvas');await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(resolve=>setTimeout(resolve,1500));await cdp.send('Page.setWebLifecycleState',{state:'active'});await complete(page);item.lifecycle='Actual Chromium Page.setWebLifecycleState frozen/active; not physical background-tab test'
 })
 await run('back-forward-restore',{},async(page,item)=>{
  await complete(page);const before=await page.evaluate(()=>performance.timeOrigin);await page.goto(base+'?boot-check-away=1');await complete(page);await page.goBack({waitUntil:'domcontentloaded'});await complete(page);item.restoration=await page.evaluate(()=>({origin:performance.timeOrigin,pageshow:bootProbe.pageshow,navigation:performance.getEntriesByType('navigation').map(n=>({type:n.type,notRestoredReasons:n.notRestoredReasons?.toJSON?.()??null}))}));item.restoration.sameDocumentTimeOrigin=before===item.restoration.origin;item.restoration.bfcacheObserved=item.restoration.pageshow.some(x=>x.persisted);assert.equal(await page.locator('#portfolio-boot').count(),0)
 })
 receipt.status=receipt.cases.every(x=>x.status==='PASS')?'PASS':'FAIL'
}finally{await browser.close();await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2))}
if(receipt.status!=='PASS')process.exitCode=1

