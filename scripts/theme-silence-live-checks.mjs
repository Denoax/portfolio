import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {launchCaptureBrowser} from './v27-browser.mjs'
const base=process.env.BASE_URL,out=process.env.OUT
assert(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));assert(out)
await mkdir(out,{recursive:true});const browser=await launchCaptureBrowser(),results=[]
try {
 for(const volume of [35,0]) {
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  await context.addInitScript(volume=>{
   localStorage.setItem('portfolio:experience-settings:v1',JSON.stringify({version:2,theme:'dark',soundVolume:volume,ambienceVolume:0}))
   const counts={contexts:0,resumes:0,decodes:0},events=[];window.themeAudioProbe={counts,events}
   const Native=window.AudioContext
   window.AudioContext=class extends Native {
    constructor(...args){super(...args);counts.contexts++}
    resume(...args){counts.resumes++;return super.resume(...args)}
    decodeAudioData(...args){counts.decodes++;return super.decodeAudioData(...args)}
   }
   addEventListener('portfolio-audio',e=>events.push(e.detail))
  },volume)
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base);await page.waitForSelector('.theme-toggle');await page.waitForFunction(()=>!document.querySelector('#portfolio-boot'))
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.colorTheme),'dark')
  const snapshot=()=>page.evaluate(()=>structuredClone(themeAudioProbe))
  const exercise=async()=>{
   await page.locator('.theme-toggle').hover();await page.waitForTimeout(100);await page.locator('.theme-toggle').click()
   await page.locator('.theme-toggle').press('Enter');await page.locator('.theme-toggle').press('Space')
   for(let i=0;i<3;i++){await page.locator('.theme-toggle').click();await page.waitForTimeout(60)}
   await page.waitForTimeout(650)
  }
  const locked=await snapshot();await exercise();const afterLocked=await snapshot()
  assert.deepEqual(afterLocked.counts,locked.counts,'Theme cannot create/unlock/decode audio')
  assert.equal(afterLocked.counts.contexts,0)
  assert(!afterLocked.events.slice(locked.events.length).some(e=>e.cue),'Theme hover/pointer/keyboard must be silent')
  if(volume) {
   await page.locator('.hub-brand').click();await page.waitForTimeout(2200)
   const unlocked=await snapshot();assert(unlocked.counts.contexts>0,'A separate legitimate interaction still unlocks audio')
   await exercise();const after=await snapshot()
   assert.deepEqual(after.counts,unlocked.counts,'Theme cannot unlock or decode again')
   assert(!after.events.slice(unlocked.events.length).some(e=>e.cue),'Unlocked theme action stays silent')
   results.push({volume,locked,afterLocked,unlocked,after,errors,status:'PASS'})
  } else results.push({volume,locked,afterLocked,errors,status:'PASS'})
  assert.deepEqual(errors,[]);await page.screenshot({path:out+'/theme-volume-'+volume+'.png'});await context.close()
 }
} finally {await browser.close();await writeFile(out+'/receipt.json',JSON.stringify(results,null,2))}
console.log('PASS quiet theme pointer/keyboard/hover in locked, unlocked and muted audio states')
