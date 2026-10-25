import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {launchCaptureBrowser} from './v27-browser.mjs'
const base=process.env.BASE_URL,out=process.env.OUT;assert(base&&out);assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));await mkdir(out,{recursive:true})
const browser=await launchCaptureBrowser(),results=[]
try{
 for(const [name,settings,options] of [
  ['ordinary',{motion:'system'},{}],['saved-less',{motion:'less'},{}],['os-less',{motion:'system'},{reducedMotion:'reduce'}],
 ]){
  const c=await browser.newContext({viewport:{width:1008,height:720},...options});await c.addInitScript(settings=>localStorage.setItem('portfolio:experience-settings:v1',JSON.stringify({version:2,theme:'dark',soundVolume:0,graphics:'high',...settings})),settings)
  await c.route(/\/assets\/main-[^/]+\.js/,async route=>{await new Promise(r=>setTimeout(r,2600));try{await route.continue()}catch{}})
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0)
  const sample=()=>p.locator('.terminal-stream').evaluate(n=>({at:performance.now(),y:new DOMMatrixReadOnly(getComputedStyle(n).transform).m42,line:parseFloat(getComputedStyle(n).lineHeight),animations:n.getAnimations().length,nodes:n.childNodes.length,rows:n.textContent.split('\n').length,windowHeight:n.parentElement.getBoundingClientRect().height,words:n.textContent.split('\n').every(x=>/^(resolve|transform|link|prepare) +src\//.test(x)),right:document.getElementById('portfolio-boot').getBoundingClientRect().right,viewport:innerWidth}))
  const a=await sample();await p.waitForTimeout(180);const b=await sample();assert.equal(a.nodes,1);assert.equal(a.rows,416);assert(a.words);assert.equal(a.right,a.viewport)
  assert.equal(await p.locator('#portfolio-boot header,#portfolio-boot .terminal-row').count(),0);assert.equal(await p.locator('#portfolio-boot nav').isVisible(),false)
  if(name==='ordinary'){
   assert.notEqual(a.y,b.y);assert(Math.abs(b.y/b.line-Math.round(b.y/b.line))<1e-6)
   // Labeled visibility fixture, distinct from a physical background-tab test.
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const paused=await sample();await p.waitForTimeout(250);assert.equal((await sample()).y,paused.y)
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(150);assert.notEqual((await sample()).y,paused.y)
  }else{assert.equal(a.animations,0);assert.equal(a.y,b.y);assert(a.windowHeight<=a.line*5+.1)}
  await p.screenshot({path:out+'/'+name+'.png'});await p.waitForFunction(()=>performance.getEntriesByName('portfolio.boot.complete').length===1);assert.deepEqual(errors,[]);results.push({name,status:'PASS',a,b,errors,visibilityScope:name==='ordinary'?'Synthetic document.hidden/visibilitychange fixture, not physical tab evidence':null});await c.close()
 }
 const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:1008,height:720}}),p=await c.newPage();await p.goto(base);assert(await p.locator('#portfolio-boot a[href^="https://github.com"]').isVisible());assert(await p.locator('.terminal-noscript').isVisible());assert.equal(await p.locator('.terminal-stream-window').isVisible(),false);await p.screenshot({path:out+'/no-javascript.png'});results.push({name:'no-javascript-recovery',status:'PASS'});await c.close()
}finally{await browser.close();await writeFile(out+'/receipt.json',JSON.stringify({status:results.length===4?'PASS':'INCOMPLETE',results},null,2))}
console.log('PASS immediate bounded compilation, whole-line motion, saved/OS reduction, visibility ownership and no-JS recovery')
