import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {launchCaptureBrowser,rendererIdentity} from './v27-browser.mjs'

const base=process.env.BASE_URL,out=process.env.OUT
assert(base&&['127.0.0.1','localhost','manimarami.com'].includes(new URL(base).hostname))
assert(out,'Provide task-private OUT')
await mkdir(out,{recursive:true})
const browser=await launchCaptureBrowser(),result={status:'IN_PROGRESS',base,scenarios:[],errors:[]}
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})
 await context.addInitScript(()=>{
  localStorage.setItem('portfolio:experience-settings:v1',JSON.stringify({version:2,theme:'light',graphics:'high',soundVolume:0,ambienceVolume:0}))
  window.tubeShaderSources=0
  const proto=WebGL2RenderingContext.prototype,source=proto.shaderSource
  proto.shaderSource=function(shader,code){if(/vTubePigment|vGlowPigment|uHaloLight/.test(code))tubeShaderSources++;return source.call(this,shader,code)}
 })
 const page=await context.newPage()
 page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text())})
 await page.goto(base);await page.waitForFunction(()=>window.__portfolio?.introZoom.instances>0);await page.waitForTimeout(600)
 assert.equal(await page.evaluate(()=>tubeShaderSources),0,'Smoke-only Worlds must not compile tube or halo shaders')
 await page.screenshot({path:out+'/preserved-waves.png'})
 await page.locator('.identity-intro').press('Enter');await page.waitForSelector('[data-surface=hub]')
 const state=()=>page.evaluate(()=>({smoke:structuredClone(window.__worldsTrail),diagnostic:structuredClone(window.__portfolio),tubeShaders:tubeShaderSources}))
 const before=await state()
 for(let i=0;i<50;i++){await page.mouse.move(310+145*Math.sin(i*.1),740+45*Math.cos(i*.12));await page.waitForTimeout(16)}
 const moving=await state();assert(moving.smoke.field.pointerKnown);assert(moving.smoke.field.passes>before.smoke.field.passes);assert(moving.smoke.path.admitted>before.smoke.path.admitted)
 await page.screenshot({path:out+'/light-smoke.png'})
 await page.waitForTimeout(900);const idle=await state();assert.equal(idle.smoke.path.admitted,moving.smoke.path.admitted,'Stationary smoke cannot receive synthetic orbit input')
 assert(idle.smoke.field.passes>moving.smoke.field.passes)
 await page.locator('.theme-toggle').evaluate(n=>n.click());await page.waitForFunction(()=>Number(document.documentElement.style.getPropertyValue('--theme-mix'))<.01)
 for(let i=0;i<30;i++){await page.mouse.move(310+i*4,740+25*Math.sin(i*.15));await page.waitForTimeout(16)}
 await page.screenshot({path:out+'/dark-smoke.png'})
 const pigments=[]
 for(const [index,id] of [[1,'1357004367'],[8,'1388326955']]){
  await page.getByRole('button',{name:'Projects',exact:true}).click();await page.locator('.projects-index-rows button').nth(index).click();await page.waitForFunction(id=>__portfolio.menu.settledId===id,id)
  await page.mouse.move(310,740);await page.waitForTimeout(450);const observed=await state();assert(observed.smoke.field.pigment.every(Number.isFinite));pigments.push({id,pigment:observed.smoke.field.pigment})
 }
 assert.notDeepEqual(pigments[0].pigment,pigments[1].pigment)
 await page.mouse.move(-20,-20);await page.waitForTimeout(300);assert.equal((await state()).smoke.field.pointerKnown,false)
 await page.mouse.move(500,700);await page.waitForTimeout(200);assert((await state()).smoke.field.pointerKnown)
 await page.getByRole('button',{name:'About me',exact:true}).click();await page.getByRole('button',{name:'Return to the start',exact:true}).click();await page.waitForSelector('.identity-intro')
 assert.equal(await page.evaluate(()=>tubeShaderSources),0)
 result.scenarios.push({name:'native-smoke-only-move-idle-theme-pigment-leave-return',status:'PASS',renderer:await rendererIdentity(page),before,moving,idle,pigments})
 await context.close()
 const portrait=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true,isMobile:true})
 const p=await portrait.newPage();p.on('pageerror',e=>result.errors.push(e.message))
 await p.goto(base);await p.waitForSelector('.intro-static-rings');await p.locator('.identity-intro').press('Enter');await p.waitForSelector('[data-surface=hub] .menu-preview-target')
 assert(await p.locator('.menu-preview-target').first().isVisible());assert.equal(await p.locator('.experience-canvas canvas').count(),0)
 await p.screenshot({path:out+'/portrait-reduced.png'});await portrait.close()
 assert.deepEqual(result.errors,[]);result.scenarios.push({name:'portrait-reduced-entry',status:'PASS',scope:'Browser emulation, not physical device'})
 result.status='PASS';console.log('PASS smoke-only rendering/input/theme/project/return and preserved Waves/static entry')
}catch(error){result.status='FAIL';result.failure=String(error);throw error}
finally{await browser.close();await writeFile(out+'/receipt.json',JSON.stringify(result,null,2))}
