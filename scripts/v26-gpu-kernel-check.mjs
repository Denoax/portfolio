import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import ts from 'typescript'
import {launchCaptureBrowser} from './v15-capture-browser.mjs'
const code=ts.transpileModule(await readFile('src/core/paneFlight.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const cases=[]
for(const opening of [true,false])for(const fresh of [true,false])for(const elapsed of [.0167,.04,.16,.35,.60,.84]) {
  const duration=opening?m.MENU_OPEN_SECONDS:m.MENU_CLOSE_SECONDS
  const flight={rect:{x:14,y:102,width:362,height:580},anchor:{x:315,y:80},opening,fresh,progress:Math.min(1,elapsed/duration),duration,viewportWidth:390}
  const inputs=[],expected=[]
  for(let i=0;i<256;i++) {
    const uv={x:(i%16+.5)/16,y:(Math.floor(i/16)+.5)/16},seed=m.tileSeed(i)
    const from={x:200+seed.x*100,y:82+seed.y*12},v=fresh?{x:0,y:0}:{x:(seed.x-.5)*300,y:(seed.y-.5)*100},alpha=opening&&fresh?0:seed.x
    inputs.push(uv.x,uv.y,seed.x,seed.y,from.x,from.y,v.x,v.y,alpha)
    const p=m.paneTilePose(flight,uv,seed,from,v,alpha);expected.push(p.x,p.y,p.alpha)
  }
  cases.push({flight,inputs,expected})
}
const browser=await launchCaptureBrowser(),page=await browser.newPage()
let result
try {
  result=await page.evaluate(({kernel,cases})=>{
    const gl=document.createElement('canvas').getContext('webgl2');if(!gl)throw new Error('WebGL2 unavailable')
    const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
    const program=gl.createProgram()
    gl.attachShader(program,compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;in vec2 aUV,aSeed,aFrom,aVelocity;in float aAlpha;uniform vec4 uRect;uniform vec2 uAnchor;uniform float uProgress,uDuration,uViewport;uniform bool uOpening,uFresh;out vec3 pose;float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}\n'+kernel+'\nvoid main(){pose=tilePose(uProgress,uOpening,uFresh,uDuration,uRect,uAnchor,aUV,aSeed,aFrom,aVelocity,aAlpha,uViewport,ceil(uRect.z/4.)*ceil(uRect.w/4.));gl_Position=vec4(0.,0.,0.,1.);}'))
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.);}'))
    gl.transformFeedbackVaryings(program,['pose'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program)
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program))
    gl.useProgram(program)
    const input=gl.createBuffer(),output=gl.createBuffer(),feedback=gl.createTransformFeedback(),vao=gl.createVertexArray()
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,input)
    let offset=0
    for(const [name,size] of [['aUV',2],['aSeed',2],['aFrom',2],['aVelocity',2],['aAlpha',1]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,36,offset*4);offset+=size}
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.enable(gl.RASTERIZER_DISCARD)
    const rows=[]
    for(const c of cases){const f=c.flight,r=f.rect,u=n=>gl.getUniformLocation(program,n)
      gl.uniform4f(u('uRect'),r.x,r.y,r.width,r.height);gl.uniform2f(u('uAnchor'),f.anchor.x,f.anchor.y)
      gl.uniform1f(u('uProgress'),f.progress);gl.uniform1f(u('uDuration'),f.duration);gl.uniform1f(u('uViewport'),f.viewportWidth);gl.uniform1i(u('uOpening'),f.opening);gl.uniform1i(u('uFresh'),f.fresh)
      gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c.inputs),gl.STATIC_DRAW)
      gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,c.expected.length*4,gl.STREAM_READ)
      gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,c.expected.length/3);gl.endTransformFeedback()
      const actual=new Float32Array(c.expected.length);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,actual)
      let position=0,alpha=0;for(let i=0;i<actual.length;i++)if(i%3===2)alpha=Math.max(alpha,Math.abs(actual[i]-c.expected[i]));else position=Math.max(position,Math.abs(actual[i]-c.expected[i]))
      rows.push({opening:f.opening,fresh:f.fresh,progress:f.progress,maxPositionErrorCssPx:position,maxAlphaError:alpha})
    }
    const error=gl.getError();gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteTransformFeedback(feedback);gl.deleteVertexArray(vao);gl.deleteProgram(program)
    return {rows,error,scope:'Actual WebGL2 transform feedback on authored render kernel; CPU doubles vs GPU float32. No physical display or presentation timing claim.'}
  },{kernel:m.paneFlightGLSL,cases})
  assert.equal(result.error,0)
  for(const r of result.rows){assert(r.maxPositionErrorCssPx<.005);assert(r.maxAlphaError<.0001)}
  await mkdir('showcase/v26-evidence/checks',{recursive:true});await writeFile('showcase/v26-evidence/checks/gpu-kernel.json',JSON.stringify(result,null,2)+'\n')
  console.log('PASS actual CPU/GPU pane kernel equivalence',result.rows.length,'x256 tile cases')
}finally{await browser.close()}
