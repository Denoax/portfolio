import * as THREE from 'three'
import { narrative } from '../../core/narrative'
import { descentPhase } from '../../core/descent'
import { smoothstep } from '../../core/math'
import { trailBudget } from '../../core/experienceSettings'
import type { QualityTier } from '../../core/quality'
import { screenVertex } from '../atmosphereShaders'
import { WorldsTrailField } from './WorldsTrailField'
import type { Pigment } from '../../core/projectPigment'

const colors = [
  [0.63, 0.65, 0.63],
  [0.17, 0.31, 0.36],
  [0.51, 0.39, 0.23],
  [0.31, 0.45, 0.6],
  [0.49, 0.5, 0.46],
  [0.42, 0.36, 0.25],
  [0.3, 0.3, 0.28],
]
export interface TrailEvidence {
  supported: boolean
  enabled: boolean
  active: boolean
  mode: number
  width: number
  height: number
  targets: number
  resets: number
  bytes: number
  headRadius: number
  emitting: boolean
  presentation?: 'legacy' | 'worlds'
}
declare global {
  interface Window {
    __cursorTrail?: TrailEvidence
  }
}
// Original feedback implementation. One owner (DescentComposite) advances it.
// RGB history retains its emitted colour across mode changes; alpha is unused.
export const trailOutputGLSL = `
uniform sampler2D uTrail;uniform vec2 uHeadPointer,uHeadPrevious,uHeadCss;
uniform vec3 uHeadColor;uniform float uHeadEmit,uHeadMode,uHeadSize,uHeadMenu;
vec3 trailOutput(vec2 uv){
  vec3 history=texture2D(uTrail,uv).rgb;
  vec2 p=uv*uHeadCss,a=uHeadPrevious*uHeadCss,b=uHeadPointer*uHeadCss,ab=b-a;
  float len=length(ab),t=clamp(dot(p-a,ab)/max(.01,dot(ab,ab)),0.,1.);
  float distance=length(p-a-ab*t);
  float base=uHeadMode<.5?3.2:uHeadMode<1.5?2.8:uHeadMode<2.5?2.:uHeadMode<3.5?1.8:uHeadMode<4.5?1.6:1.5;
  float radius=mix(base,base*1.625,1.-smoothstep(0.,32.,(1.-t)*len))*uHeadSize;
  float source=exp(-distance*distance/(radius*radius))*(uHeadMenu>.5?max(.7,min(1.,len/3.)):min(1.,len/3.));
  if((uHeadMode>.5&&uHeadMode<2.5)||(uHeadMode>3.5&&uHeadMode<4.5)){
    float spacing=uHeadMode<1.5?11.:uHeadMode<2.5?16.:9.;
    source*=pow(max(0.,cos(t*len*6.283185/spacing)),12.);
  }
  // Maximum shares the history's energy rather than adding a second bright head.
  return max(history,uHeadColor*source*uHeadEmit);
}`
export class CursorTrail {
  readonly evidence: TrailEvidence
  readonly outputUniforms = {
    uHeadPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uHeadPrevious: { value: new THREE.Vector2(0.5, 0.5) },
    uHeadCss: { value: new THREE.Vector2(1, 1) },
    uHeadColor: { value: new THREE.Vector3() },
    uHeadEmit: { value: 0 },
    uHeadMode: { value: 0 },
    uHeadSize: { value: 1 },
    uHeadMenu: { value: 0 },
  }
  private read: THREE.WebGLRenderTarget
  private write: THREE.WebGLRenderTarget
  private material: THREE.ShaderMaterial
  private geometry = new THREE.PlaneGeometry(2, 2)
  private scene = new THREE.Scene()
  private camera = new THREE.Camera()
  private colorTarget = new THREE.Vector3()
  private savedColor = new THREE.Color()
  private savedViewport = new THREE.Vector4()
  private savedScissor = new THREE.Vector4()
  private desired = new THREE.Vector2(0.5, 0.5)
  private pointer = new THREE.Vector2(0.5, 0.5)
  private previous = new THREE.Vector2(0.5, 0.5)
  private inside = false
  private quietControl = false
  private needsClear = true
  private lastRealInput = -100
  private menuColor = new THREE.Color()
  private menuInitialized = false
  private lastInput = -100
  private previousState = 0
  private previousTarget = 0
  private worlds: WorldsTrailField | null
  private worldsActive = false
  private fine = window.matchMedia('(pointer: fine) and (hover: hover)')
  constructor(private gl: THREE.WebGLRenderer, worlds = false) {
    this.worlds = worlds ? new WorldsTrailField(this.geometry) : null
    const supported = Boolean(gl.extensions.get('EXT_color_buffer_float'))
    this.evidence = {
      supported,
      enabled: false,
      active: false,
      mode: 0,
      width: 1,
      height: 1,
      targets: supported ? 2 : 0,
      resets: 0,
      bytes: 0,
      headRadius: 5.2,
      emitting: false,
    }
    const options = {
      type: supported ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }
    this.read = new THREE.WebGLRenderTarget(1, 1, options)
    this.write = new THREE.WebGLRenderTarget(1, 1, options)
    this.material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      vertexShader: screenVertex,
      uniforms: {
        uHistory: { value: this.read.texture },
        uCss: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: this.pointer },
        uPrevious: { value: this.previous },
        uColor: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uDt: { value: 0 },
        uMode: { value: 0 },
        uEmit: { value: 0 },
        uSize: { value: 1 },
        uMenu: { value: 0 },
      },
      fragmentShader: `varying vec2 vUv;uniform sampler2D uHistory;uniform vec2 uCss,uPointer,uPrevious;uniform vec3 uColor;uniform float uTime,uDt,uMode,uEmit,uSize,uMenu;
    void main(){vec2 css=vUv*uCss;float curl=1.-smoothstep(.1,.9,uMode);vec2 drift=vec2(sin(css.y*.037+uTime*.7),-cos(css.x*.031-uTime*.5))*18.*curl+vec2(2.,3.);
    vec2 spread=vec2(sin(css.y*.14+uTime),cos(css.x*.13-uTime))*(uMenu>.5?9.:0.);
    vec3 old=texture2D(uHistory,vUv-(drift+spread)*uDt/uCss).rgb*exp(-uDt/(uMenu>.5?.58:mix(.42,.25,min(1.,uMode))));
    vec2 a=uPrevious*uCss,b=uPointer*uCss,ab=b-a;float len=length(ab);float t=clamp(dot(css-a,ab)/max(.01,dot(ab,ab)),0.,1.);float distance=length(css-a-ab*t);
    float radius=uMode<.5?3.2:uMode<1.5?2.8:uMode<2.5?2.0:uMode<3.5?1.8:uMode<4.5?1.6:1.5;
    radius*=uSize;
    if(uMenu>.5)radius*=1.2;
    float source=exp(-distance*distance/(radius*radius))*(uMenu>.5?max(.7,min(1.,len/3.)):min(1.,len/3.));
    if((uMode>.5&&uMode<2.5)||(uMode>3.5&&uMode<4.5)){float spacing=uMode<1.5?11.:uMode<2.5?16.:9.;source*=pow(max(0.,cos(t*len*6.283185/spacing)),12.);}
    float halo=exp(-distance*distance/(uMenu>.5?260.:70.))*(uMenu>.5?.055:uMode<.5?.035:.015);
    float border=smoothstep(0.,.015,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
    vec3 emission=uColor*(source+halo)*uEmit*uDt*60.;
    gl_FragColor=vec4((uMenu>.5?max(old*.98,emission)+old*.025:old+emission)*border,1.);}`,
    })
    this.scene.add(new THREE.Mesh(this.geometry, this.material))
  }
  connect() {
    window.__cursorTrail = this.evidence
    const diagnostic = window as unknown as { __worldsTrail?: unknown }
    const worldDiagnostic = this.worlds ? { field: this.worlds.evidence, path: this.worlds.path.evidence } : null
    if (worldDiagnostic) diagnostic.__worldsTrail = worldDiagnostic
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !this.fine.matches) return
      if (this.worldsActive) this.worlds?.admit(e)
      const x = e.clientX / innerWidth,
        y = 1 - e.clientY / innerHeight
      if (!this.inside) {
        this.pointer.set(x, y)
        this.previous.copy(this.pointer)
      }
      this.desired.set(x, y)
      this.inside = true
      this.lastInput = narrative.elapsed
      this.lastRealInput = performance.now() / 1000
      this.quietControl = Boolean(
        (e.target as Element)?.closest(
          'a,button:not(.menu-preview-target),input,textarea,select,[contenteditable=true]',
        ),
      )
    }
    const leave = () => {
      this.inside = false
      this.needsClear = true
      this.worlds?.clear()
    }
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) leave()
    }
    const preference = () => {
      this.needsClear = true
      this.worlds?.clear()
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', out)
    window.addEventListener('blur', leave)
    window.addEventListener('keydown', leave)
    window.addEventListener('touchstart', leave, { passive: true })
    document.addEventListener('visibilitychange', leave)
    this.fine.addEventListener('change', preference)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', out)
      window.removeEventListener('blur', leave)
      window.removeEventListener('keydown', leave)
      window.removeEventListener('touchstart', leave)
      document.removeEventListener('visibilitychange', leave)
      this.fine.removeEventListener('change', preference)
      if (window.__cursorTrail === this.evidence) delete window.__cursorTrail
      if (diagnostic.__worldsTrail === worldDiagnostic) delete diagnostic.__worldsTrail
      if (this.worlds) delete diagnostic.__worldsTrail
    }
  }
  get texture() {
    return this.read.texture
  }
  step(
    dt: number,
    width: number,
    height: number,
    tier: QualityTier,
    cursorSize: number,
    panelOpen: boolean,
    menu?: { clock: number; color: THREE.Color; reduced: boolean; style?: 'intro' | 'worlds'; pigment?: Pigment; projectId?: string },
  ) {
    // v25 exception is explicit. The legacy shader and all code below this
    // branch retain the approved intro/descent behavior.
    if (menu?.style === 'worlds' && this.worlds && menu.pigment) {
      if (!this.worldsActive) { this.worldsActive = true; this.needsClear = true }
      return this.stepWorlds(dt, width, height, tier, cursorSize, menu)
    }
    if (this.worldsActive) {
      this.worldsActive = false; this.worlds?.clear(); this.needsClear = true
    }
    this.evidence.presentation = 'legacy'
    const s = menu ? 0 : narrative.state,
      now = menu?.clock ?? narrative.elapsed,
      inputAge = menu
        ? performance.now() / 1000 - this.lastRealInput
        : now - this.lastInput,
      e = this.evidence
    if (menu && !this.menuInitialized) {
      this.menuColor.copy(menu.color)
      this.menuInitialized = true
    }
    if (!e.supported) return false
    e.enabled =
      e.supported &&
      this.fine.matches &&
      !(menu?.reduced ?? narrative.reducedMotion) &&
      !document.hidden
    // Read controller intent too: at high refresh rates the displayed damper
    // can hide even a whole-chapter seek from a per-frame position threshold.
    if (
      !menu &&
      (Math.abs(narrative.target - this.previousTarget) > 0.12 ||
        Math.abs(s - this.previousState) > 0.12)
    )
      this.needsClear = true
    this.previousState = s
    this.previousTarget = narrative.target
    const budget = trailBudget(tier, width, height)
    const tw = menu
      ? Math.min(Math.round(width * this.gl.getPixelRatio()), 1200)
      : budget.width
    const th = menu ? Math.round((tw * height) / width) : budget.height
    const bytes = menu ? tw * th * 16 : budget.bytes
    e.bytes = bytes
    e.headRadius = ((menu ? 8.5 : 5.2) * cursorSize) / 100
    this.outputUniforms.uHeadEmit.value = 0
    e.emitting = false
    if (e.width !== tw || e.height !== th) {
      this.read.setSize(tw, th)
      this.write.setSize(tw, th)
      e.width = tw
      e.height = th
      this.needsClear = true
    }
    const target = this.gl.getRenderTarget(),
      scissorTest = this.gl.getScissorTest(),
      alpha = this.gl.getClearAlpha()
    this.gl.getViewport(this.savedViewport)
    this.gl.getScissor(this.savedScissor)
    this.gl.getClearColor(this.savedColor)
    try {
      if (this.needsClear) {
        this.gl.setScissorTest(false)
        this.gl.setClearColor(0, 0)
        for (const t of [this.read, this.write]) {
          this.gl.setRenderTarget(t)
          this.gl.clear()
        }
        this.gl.setClearColor(this.savedColor, alpha)
        this.needsClear = false
        e.resets++
        this.previous.copy(this.pointer)
      }
      e.active = e.enabled && this.inside && inputAge < 2.6
      if (!e.active) return false
      // Opening progress includes the solar and atmosphere beats. Palette
      // changes follow the actual marine reveal rather than half a chapter.
      const marinePresence = s <= 1 ? narrative.frame.pelagic : 0,
        semantic = s <= 1 ? marinePresence : s,
        index = Math.max(0, Math.min(6, Math.round(semantic))),
        previousIndex = Math.max(0, Math.min(6, Math.floor(semantic))),
        nextIndex = Math.min(6, previousIndex + 1),
        blend = smoothstep((semantic - previousIndex - 0.35) / 0.3)
      const color = this.material.uniforms.uColor.value as THREE.Vector3
      color
        .fromArray(colors[previousIndex])
        .lerp(this.colorTarget.fromArray(colors[nextIndex]), blend)
      if (menu) {
        this.menuColor.lerp(menu.color, 1 - Math.exp(-Math.min(dt, 0.05) / 0.6))
        color.set(this.menuColor.r, this.menuColor.g, this.menuColor.b)
      }
      e.mode = index
      const q = s <= 1 ? descentPhase(s) : 1
      const strength =
        s <= 1
          ? 1 - smoothstep((q - 0.52) / 0.08) + 0.65 * marinePresence
          : s < 1.65
            ? 0.65
            : 1
      this.previous.copy(this.pointer)
      this.pointer.lerp(this.desired, 1 - Math.exp(-20 * Math.min(0.05, dt)))
      const u = this.material.uniforms
      u.uHistory.value = this.read.texture
      u.uCss.value.set(width, height)
      u.uTime.value = now
      u.uDt.value = Math.min(0.05, dt)
      u.uMode.value = index
      u.uEmit.value =
        (menu ? 1.2 : strength) *
        (panelOpen ? 0 : this.quietControl ? 0.12 : 1) *
        (inputAge < 0.12 ? 1 : 0)
      u.uSize.value = (cursorSize / 100) * (menu ? 2.0 : 1)
      u.uMenu.value = menu ? 1 : 0
      const head = this.outputUniforms
      head.uHeadPointer.value.copy(this.pointer)
      head.uHeadPrevious.value.copy(this.previous)
      head.uHeadCss.value.set(width, height)
      head.uHeadColor.value.copy(color)
      head.uHeadMode.value = index
      head.uHeadSize.value = (cursorSize / 100) * (menu ? 1.64 : 1)
      head.uHeadMenu.value = menu ? 1 : 0
      head.uHeadEmit.value = u.uEmit.value
      e.emitting = u.uEmit.value > 0
      this.gl.setScissorTest(false)
      this.gl.setRenderTarget(this.write)
      this.gl.render(this.scene, this.camera)
      const old = this.read
      this.read = this.write
      this.write = old
      return true
    } finally {
      this.gl.setRenderTarget(target)
      this.gl.setViewport(this.savedViewport)
      this.gl.setScissor(this.savedScissor)
      this.gl.setScissorTest(scissorTest)
      this.gl.setClearColor(this.savedColor, alpha)
    }
  }
  private stepWorlds(
    dt: number, width: number, height: number, tier: QualityTier, cursorSize: number,
    menu: { clock: number; reduced: boolean; pigment?: Pigment; projectId?: string },
  ) {
    const field = this.worlds!, e = this.evidence
    e.presentation = 'worlds'
    field.setPigment(menu.projectId ?? '', menu.pigment!, menu.clock)
    e.enabled = e.supported && this.fine.matches && !menu.reduced && !document.hidden
    e.active = e.enabled && this.inside && performance.now() / 1000 - this.lastRealInput < 1.65
    e.emitting = false; this.outputUniforms.uHeadEmit.value = 0
    if (!e.supported) return false
    const budget = trailBudget(tier, width, height)
    const tw = Math.min(Math.round(width * this.gl.getPixelRatio()), 1200, budget.width)
    const th = Math.max(1, Math.round(tw * height / width))
    if (e.width !== tw || e.height !== th) {
      this.read.setSize(tw, th); this.write.setSize(tw, th)
      e.width = tw; e.height = th; this.needsClear = true
    }
    e.bytes = tw * th * 16; e.headRadius = 16 * cursorSize / 100
    const target = this.gl.getRenderTarget(), scissorTest = this.gl.getScissorTest(), alpha = this.gl.getClearAlpha()
    this.gl.getViewport(this.savedViewport); this.gl.getScissor(this.savedScissor); this.gl.getClearColor(this.savedColor)
    try {
      this.gl.setScissorTest(false)
      if (this.needsClear || !e.enabled) {
        this.gl.setClearColor(0, 0)
        for (const t of [this.read, this.write]) { this.gl.setRenderTarget(t); this.gl.clear() }
        this.gl.setClearColor(this.savedColor, alpha)
        field.clear(); this.needsClear = false; e.resets++
      }
      if (!e.active) return false
      const delta = Math.max(0, Math.min(.15, dt))
      const steps = Math.max(1, Math.min(3, Math.floor((delta + .001) * 60)))
      for (let i = 0; i < steps; i++) {
        field.update(this.read.texture, width, height, tw, th, delta / steps, menu.clock, cursorSize)
        this.gl.setRenderTarget(this.write); this.gl.render(field.scene, this.camera)
        const old = this.read; this.read = this.write; this.write = old
      }
      const age = performance.now() / 1000 - this.lastRealInput
      field.head(this.outputUniforms, width, height, cursorSize, age)
      e.emitting = this.outputUniforms.uHeadEmit.value > 0
      return true
    } finally {
      this.gl.setRenderTarget(target); this.gl.setViewport(this.savedViewport); this.gl.setScissor(this.savedScissor)
      this.gl.setScissorTest(scissorTest); this.gl.setClearColor(this.savedColor, alpha)
    }
  }
  prepare() {
    return this.evidence.supported
      ? Promise.all([this.gl.compileAsync(this.scene, this.camera), this.worlds?.prepare(this.gl, this.camera)]).then(() => {})
      : Promise.resolve()
  }
  dispose() {
    this.worlds?.dispose()
    this.read.dispose()
    this.write.dispose()
    this.material.dispose()
    this.geometry.dispose()
  }
}
