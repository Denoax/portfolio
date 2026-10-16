import * as THREE from 'three'
import { PointerPath } from '../../core/pointerPath'
import { PigmentResponse } from '../../core/projectPigment'
import type { Pigment } from '../../core/projectPigment'
import { screenVertex } from '../atmosphereShaders'

const SEGMENTS = 32
export const WORLDS_IDLE_RATE = 1.15
export const WORLDS_DECAY_SECONDS = .40
export function worldsIdleMix(age: number) {
  const t = Math.max(0, Math.min(1, (age - .08) / .16))
  return t * t * (3 - 2 * t)
}
// Pigment mass in RGB, density in alpha, all linear renderer data. Display
// reconstruction is straight alpha and occurs exactly once in HubScene.
export const worldsTrailOutputGLSL = `
vec4 worldsTrailOutput(vec2 uv){
 vec4 field=texture2D(uTrail,uv);float density=field.a;
 vec2 p=vec2(uv.x*uHeadCss.x,(1.-uv.y)*uHeadCss.y),a=vec2(uHeadPrevious.x*uHeadCss.x,(1.-uHeadPrevious.y)*uHeadCss.y),b=vec2(uHeadPointer.x*uHeadCss.x,(1.-uHeadPointer.y)*uHeadCss.y),ab=b-a;
 float t=clamp(dot(p-a,ab)/max(.01,dot(ab,ab)),0.,1.),distance=length(p-a-ab*t);
 float radius=16.*uHeadSize,head=exp(-distance*distance/(radius*radius))*uHeadEmit;
 float added=max(0.,head*1.35-density);density+=added;vec3 mass=field.rgb+uHeadColor*added;
 vec3 pigment=density>.0001?mass/density:vec3(0.);
 float alpha=1.-exp(-density*mix(2.1,2.8,uSelectionLight));
 return vec4(pigment,alpha);
}`

// Uses CursorTrail's existing two targets/renderer. Owns only the worlds
// material/input/colour policy; no canvas, RAF, fluid solver or extra target.
export class WorldsTrailField {
  readonly scene = new THREE.Scene()
  readonly material: THREE.ShaderMaterial
  readonly path = new PointerPath()
  readonly color = new THREE.Vector3()
  readonly evidence = {
    presentation: 'worlds', bodyRadius: 14, headRadius: 16, outerEnvelope: 56,
    feedbackTargets: 2, inputCapacity: 512, segmentCapacity: SEGMENTS,
    passes: 0, coalescedAvailable: false, selectedId: '', pigment: [0, 0, 0],
    pointerKnown: false, idleStrength: 0, idleDensityInput: 0, idleSeconds: 0, quiet: false,
    headStrength: 0,
  }
  private segments = new Float32Array(SEGMENTS * 4)
  private pigments = new Float32Array(SEGMENTS * 3)
  private weights = new Float32Array(SEGMENTS)
  private pigment = new PigmentResponse()
  private initialized = false
  private x = 0
  private y = 0
  private oldX = 0
  private oldY = 0
  private quiet = false
  private lastMove = -Infinity
  constructor(geometry: THREE.PlaneGeometry) {
    this.material = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: screenVertex,
      uniforms: {
        uHistory: { value: null }, uCss: { value: new THREE.Vector2(1, 1) },
        uGrid: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uDt: { value: 0 }, uSize: { value: 1 }, uCount: { value: 0 },
        uSegments: { value: this.segments }, uPigments: { value: this.pigments },
        uWeights: { value: this.weights }, uStrength: { value: 1 },
        uIdle: { value: new THREE.Vector4() }, uIdleColor: { value: this.color },
      },
      fragmentShader: `varying vec2 vUv;uniform sampler2D uHistory;uniform vec2 uCss,uGrid;uniform float uTime,uDt,uSize,uStrength;uniform int uCount;uniform vec4 uSegments[32],uIdle;uniform vec3 uPigments[32],uIdleColor;uniform float uWeights[32];
      vec2 flow(vec2 p){
       // Curl of two independently authored smooth stream functions. Coarse
       // advection dominates; the smaller field folds edges without sine bands.
       float a=p.x*.014+uTime*.22,b=p.y*.018-uTime*.17,c=p.x*.048-uTime*.16,d=p.y*.043+uTime*.19;
       return vec2(sin(a)*cos(b)*43.2,-cos(a)*sin(b)*33.6)+vec2(cos(c)*cos(d)*16.3,sin(c)*sin(d)*18.2)+vec2(1.,-7.);
      }
      void main(){vec2 css=vec2(vUv.x*uCss.x,(1.-vUv.y)*uCss.y),drift=flow(css),advect=vec2(drift.x,-drift.y)*uDt/uCss;
       vec2 uv=vUv-advect,blur=vec2(.85*sqrt(max(.001,uDt)*60.))/uGrid;
       vec4 old=(texture2D(uHistory,uv)*.52+(texture2D(uHistory,uv+vec2(blur.x,0.))+texture2D(uHistory,uv-vec2(blur.x,0.))+texture2D(uHistory,uv+vec2(0.,blur.y))+texture2D(uHistory,uv-vec2(0.,blur.y)))*.12)*exp(-uDt/${WORLDS_DECAY_SECONDS});
       vec3 mass=old.rgb;float density=old.a;float radius=14.*uSize;
       for(int i=0;i<32;i++){if(i>=uCount)break;vec4 seg=uSegments[i];float envelope=28.*uSize;
        if(any(lessThan(css,min(seg.xy,seg.zw)-envelope))||any(greaterThan(css,max(seg.xy,seg.zw)+envelope)))continue;
        vec2 ab=seg.zw-seg.xy;float t=clamp(dot(css-seg.xy,ab)/max(.01,dot(ab,ab)),0.,1.),distance=length(css-seg.xy-ab*t);
        float body=exp(-distance*distance/(radius*radius)),wisp=exp(-distance*distance/(radius*radius*2.8))*.085;
        float deposit=(body+wisp)*uWeights[i]/(radius*1.77245)*1.3*uStrength;
        mass+=uPigments[i]*deposit;density+=deposit;
       }
       // A time-integrated source feeds the same advection/decay as real paths.
       // No duplicate pointer samples or second draw/target are involved.
       vec2 offset=css-uIdle.xy;
       float idle=exp(-dot(offset,offset)/max(.01,uIdle.w*uIdle.w))*uIdle.z;
       mass+=uIdleColor*idle;density+=idle;
       if(density>2.8){mass*=2.8/density;density=2.8;}
       float edge=smoothstep(0.,.008,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
       gl_FragColor=vec4(mass,density)*edge;
      }`,
    })
    this.scene.add(new THREE.Mesh(geometry, this.material))
  }
  setPigment(id: string, target: Pigment, dt: number) {
    const pigment = this.pigment.step(target, dt)
    this.evidence.selectedId = id
    this.color.fromArray(pigment.rgb)
    for (let i = 0; i < 3; i++) this.evidence.pigment[i] = pigment.rgb[i]
  }
  seedPointer(x: number, y: number, observedAt: number) {
    if (this.initialized || !Number.isFinite(x + y + observedAt)) return
    this.x = this.oldX = x; this.y = this.oldY = y
    this.lastMove = observedAt
    this.initialized = this.evidence.pointerKnown = true
  }
  setQuiet(quiet: boolean) {
    this.quiet = this.evidence.quiet = quiet
  }
  admit(event: PointerEvent) {
    if (!this.pigment.initialized) return
    const now = performance.now()
    if (now - this.lastMove > 250) { this.initialized = false; this.path.clear() }
    this.lastMove = now
    const samples = event.getCoalescedEvents?.() ?? []
    this.evidence.coalescedAvailable = typeof event.getCoalescedEvents === 'function'
    if (samples.length) this.path.evidence.coalesced += samples.length
    if (samples.length) for (const sample of samples) this.admitSample(sample)
    else this.admitSample(event)
    if (!this.initialized) { this.oldX = event.clientX; this.oldY = event.clientY }
    else { this.oldX = this.x; this.oldY = this.y }
    this.x = event.clientX; this.y = event.clientY; this.initialized = this.evidence.pointerKnown = true
    this.quiet = event.target instanceof Element && Boolean(event.target.closest('a:not(.menu-media-action),button,input,textarea,select,dialog,.portfolio-nav-shell,[contenteditable=true]'))
  }
  private admitSample(event: PointerEvent) {
    const time = event.timeStamp > 1e12 ? event.timeStamp - performance.timeOrigin : event.timeStamp
    this.path.admit(event.clientX, event.clientY, time, this.pigment.current.rgb)
  }
  clear() {
    this.path.clear(); this.initialized = false
    this.pigment.reset()
    this.evidence.pointerKnown = false; this.evidence.idleStrength = this.evidence.idleDensityInput = this.evidence.headStrength = 0
    this.lastMove = -Infinity
  }
  update(history: THREE.Texture, width: number, height: number, gridWidth: number, gridHeight: number, dt: number, clock: number, size: number) {
    const u = this.material.uniforms
    u.uHistory.value = history; u.uCss.value.set(width, height); u.uGrid.value.set(gridWidth, gridHeight)
    u.uDt.value = dt; u.uTime.value = clock; u.uSize.value = size / 100
    u.uStrength.value = this.quiet ? .12 : 1
    const idle = this.initialized ? worldsIdleMix((performance.now() - this.lastMove) / 1000) : 0
    const density = WORLDS_IDLE_RATE * WORLDS_DECAY_SECONDS * -Math.expm1(-dt / WORLDS_DECAY_SECONDS) * idle * u.uStrength.value
    u.uIdle.value.set(this.x, this.y, density, 11 * size / 100)
    this.evidence.idleStrength = idle * u.uStrength.value; this.evidence.idleDensityInput = density
    this.evidence.idleSeconds += dt * idle
    u.uCount.value = this.path.consume(this.segments, this.pigments, this.weights, performance.now())
    this.evidence.bodyRadius = 14 * size / 100; this.evidence.headRadius = 16 * size / 100
    this.evidence.passes++
  }
  head(uniforms: { uHeadPointer: THREE.IUniform; uHeadPrevious: THREE.IUniform; uHeadCss: THREE.IUniform; uHeadColor: THREE.IUniform; uHeadSize: THREE.IUniform; uHeadEmit: THREE.IUniform }, width: number, height: number, size: number, age: number) {
    uniforms.uHeadPointer.value.set(this.x / width, 1 - this.y / height)
    // A pointer warp must not paint a synthetic chord across a lost curve.
    const jump = Math.hypot(this.x - this.oldX, this.y - this.oldY) > 240
    const idle = worldsIdleMix(age)
    const previousX = jump ? this.x : this.oldX + (this.x - this.oldX) * idle
    const previousY = jump ? this.y : this.oldY + (this.y - this.oldY) * idle
    uniforms.uHeadPrevious.value.set(previousX / width, 1 - previousY / height)
    uniforms.uHeadCss.value.set(width, height); uniforms.uHeadColor.value.copy(this.color)
    uniforms.uHeadSize.value = size / 100
    // Dwell retracts the last movement chord, not the pointer's visible circle.
    // The wake still advects/decays independently in the feedback field.
    uniforms.uHeadEmit.value = this.initialized ? (this.quiet ? .12 : 1) : 0
    this.evidence.headStrength = uniforms.uHeadEmit.value
  }
  prepare(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
    return gl.compileAsync(this.scene, camera)
  }
  dispose() { this.material.dispose() }
}
