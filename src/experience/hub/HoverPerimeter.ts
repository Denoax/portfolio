import * as THREE from 'three'
import type { MenuPresentation } from '../../core/menuReel'
// One analytic emitter shares the menu draw. No extra particles, RAF, target or
// invisible GlassField hit regions. Alpha owns brief retirement independently.
export class HoverPerimeter {
  readonly uniforms = {
    uBoxInverse: { value: new THREE.Matrix3() },
    uBoxSize: { value: new THREE.Vector2(1, 1) },
    uBoxRadius: { value: 0 },
    uBoxAlpha: { value: 0 },
  }
  readonly evidence = {
    targetId: '',
    projectId: '',
    emitting: false,
    alpha: 0,
    retiredMs: 0,
    targets: 1,
  }
  private x = NaN
  private y = NaN
  private target: HTMLElement | null = null
  private leaveAge = 0
  private transform = ''
  connect() {
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.x = e.clientX
        this.y = e.clientY
      } else this.clear()
    }
    const clear = () => this.clear()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', clear)
    window.addEventListener('resize', clear)
    document.addEventListener('visibilitychange', clear)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', clear)
      window.removeEventListener('resize', clear)
      document.removeEventListener('visibilitychange', clear)
      this.clear()
    }
  }
  clear() {
    this.x = this.y = NaN
    this.target = null
    this.uniforms.uBoxAlpha.value = 0
    this.evidence.emitting = false
    this.evidence.alpha = 0
  }
  step(dt: number, menu: MenuPresentation) {
    let target: HTMLElement | null = null
    if (
      !document.hidden &&
      !menu.intro.active &&
      !menu.paused &&
      Number.isFinite(this.x)
    ) {
      const hit = document.elementFromPoint(this.x, this.y)
      target = hit?.closest<HTMLElement>('[data-smoke-target]') ?? null
      if (
        target?.dataset.smokeTarget === 'media' &&
        target.dataset.ready !== 'true'
      )
        target = null
      if (
        target?.closest('dialog') ||
        !matchMedia('(pointer:fine) and (hover:hover)').matches
      )
        target = null
    }
    const u = this.uniforms
    if (target) {
      if (target !== this.target) {
        u.uBoxAlpha.value = 0
        this.transform = ''
        this.target = target
      }
      this.leaveAge = 0
      const style = getComputedStyle(target),
        r = target.getBoundingClientRect(),
        size = new THREE.Vector2(target.offsetWidth, target.offsetHeight)
      const matrix =
        target.dataset.smokeTarget === 'media' ? style.transform : 'none'
      const key = `${matrix}:${r.x}:${r.y}:${size.x}:${size.y}`
      if (key !== this.transform) {
        this.transform = key
        if (matrix !== 'none') {
          const m = new DOMMatrixReadOnly(matrix)
          u.uBoxInverse.value
            .set(m.m11, m.m21, m.m41, m.m12, m.m22, m.m42, m.m14, m.m24, m.m44)
            .invert()
        } else u.uBoxInverse.value.set(1, 0, -r.left, 0, 1, -r.top, 0, 0, 1)
        u.uBoxSize.value.copy(size)
        u.uBoxRadius.value = Math.min(
          size.x / 2,
          size.y / 2,
          parseFloat(style.borderRadius) || 22,
        )
      }
      u.uBoxAlpha.value +=
        (1 - u.uBoxAlpha.value) * (1 - Math.exp(-Math.min(dt, 0.05) / 0.05))
    } else {
      this.leaveAge += Math.min(dt, 0.05)
      u.uBoxAlpha.value *= Math.exp(-Math.min(dt, 0.05) / 0.045)
      if (this.leaveAge >= 0.4) u.uBoxAlpha.value = 0
    }
    if (document.hidden || menu.paused) u.uBoxAlpha.value = 0
    this.evidence.targetId = target?.dataset.smokeTarget ?? ''
    this.evidence.projectId = target?.dataset.projectId ?? menu.selectedId
    this.evidence.emitting = Boolean(target)
    this.evidence.alpha = u.uBoxAlpha.value
    this.evidence.retiredMs = this.leaveAge * 1000
    return u.uBoxAlpha.value > 0.0001
  }
}
export const perimeterGLSL = `
uniform mat3 uBoxInverse;uniform vec2 uBoxSize;uniform float uBoxRadius,uBoxAlpha;
float boxSmoke(vec2 uv){
 vec2 pixel=vec2(uv.x*uHeadCss.x,(1.-uv.y)*uHeadCss.y);
 vec3 projected=uBoxInverse*vec3(pixel,1.);vec2 local=projected.xy/projected.z-uBoxSize*.5;
 vec2 q=abs(local)-(uBoxSize*.5-vec2(uBoxRadius));float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uBoxRadius;
 float outer=max(0.,d);
 float near=(exp(-outer*outer/12.)*.60+exp(-outer*outer/120.)*.22)*(1.-smoothstep(14.,18.,outer));
 near*=smoothstep(-2.,0.,d);
 return near*uBoxAlpha;
}`
