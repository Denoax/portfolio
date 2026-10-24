import * as THREE from 'three'
import { TubeOrbit } from '../../core/tubeOrbit'
import { TubeTrail, TUBE_STRANDS as STRANDS, TUBE_SECTIONS as SAMPLES, TUBE_STEP as STEP } from '../../core/tubeTrail'
import { TubeGlow } from './TubeGlow'
import { PigmentResponse } from '../../core/projectPigment'
import type { Pigment } from '../../core/projectPigment'

// Reference: Kevin Levron, Tubes Cursor / threejs-components 0.0.19.
// Independently authored geometry, follower, shading and host integration;
// no creator bundle or engine code is included. See the source/rights record.
const SIDES = 8
const RING = SIDES + 1
const QUIET = 'a:not(.menu-media-action),button:not(.menu-preview-target),input,textarea,select,dialog,.portfolio-nav-shell,[contenteditable=true]'

export class WorldsTubes {
  readonly orbit = new TubeOrbit()
  readonly geometry = new THREE.BufferGeometry()
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(45, 1, .1, 4000)
  readonly material = new THREE.ShaderMaterial({
    name: 'WorldsTubes', vertexColors: true, transparent: true,
    depthTest: true, depthWrite: true, toneMapped: false,
    uniforms: { uTubeLight: { value: 1 }, uTubeOpacity: { value: 1 }, uTubeBrightness: { value: 1 } },
    vertexShader: `varying vec3 vTubeNormal,vTubeView,vTubePigment;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);
       vTubeNormal=normalize(normalMatrix*normal);vTubeView=-p.xyz;vTubePigment=color;
       gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float uTubeLight,uTubeOpacity,uTubeBrightness;
      varying vec3 vTubeNormal,vTubeView,vTubePigment;
      void main(){
       vec3 n=normalize(vTubeNormal),v=normalize(vTubeView);
       vec3 key=normalize(vec3(-.45,.65,1.)),fill=normalize(vec3(.7,-.4,.65));
       float diffuse=max(0.,dot(n,key)),rim=pow(1.-max(0.,dot(n,v)),2.);
       float spec=pow(max(0.,dot(n,normalize(key+v))),42.);
       float secondary=pow(max(0.,dot(n,normalize(fill+v))),65.);
       // A shaded saturated body survives white; narrow tinted reflections
       // describe the round section without a clipped white/rainbow core.
       float core=pow(max(0.,dot(n,v)),16.);
       vec3 body=vTubePigment*(mix(.65,.24,uTubeLight)+diffuse*mix(.8,.55,uTubeLight));
       vec3 reflection=mix(vTubePigment,vec3(1.),.18)*(spec*.8+secondary*.28);
       body+=reflection+vTubePigment*(core*mix(1.3,.9,uTubeLight)+rim*.2);
       gl_FragColor=vec4(body*uTubeBrightness,uTubeOpacity);
       #include <colorspace_fragment>
      }`,
  })
  readonly mesh = new THREE.Mesh(this.geometry, this.material)
  private fine = window.matchMedia('(pointer: fine) and (hover: hover)')
  readonly trail = new TubeTrail()
  readonly glow = new TubeGlow(this.geometry)
  private readonly heads = new Float32Array(STRANDS * 3)
  private positions = new Float32Array(STRANDS * SAMPLES * RING * 3)
  private normals = new Float32Array(this.positions.length)
  private colors = new Float32Array(this.positions.length)
  private pigment = new PigmentResponse()
  private tangent = new THREE.Vector3()
  private normal = new THREE.Vector3()
  private binormal = new THREE.Vector3()
  private axis = new THREE.Vector3(0, 0, 1)
  private viewport = new THREE.Vector4()
  private clearColor = new THREE.Color()
  private readonly ringCos = Float32Array.from({ length: RING }, (_, j) => Math.cos(j / SIDES * Math.PI * 2))
  private readonly ringSin = Float32Array.from({ length: RING }, (_, j) => Math.sin(j / SIDES * Math.PI * 2))
  private scissor = new THREE.Vector4()
  private accumulator = 0
  private time = 0
  private width = 0
  private height = 0
  private running = false
  private ready = false
  private disposed = false
  private dragging = false
  private quiet = false
  private opacity = 0
  private disconnect: (() => void) | null = null

  constructor() {
    const indices = new Uint16Array(STRANDS * (SAMPLES - 1) * SIDES * 6)
    let offset = 0
    for (let s = 0; s < STRANDS; s++) for (let i = 0; i < SAMPLES - 1; i++) for (let j = 0; j < SIDES; j++) {
      const a = (s * SAMPLES + i) * RING + j, b = a + RING
      indices[offset++] = a; indices[offset++] = a + 1; indices[offset++] = b
      indices[offset++] = b; indices[offset++] = a + 1; indices[offset++] = b + 1
    }
    const taper = new Float32Array(STRANDS * SAMPLES * RING)
    for (let s = 0; s < STRANDS; s++) for (let i = 0; i < SAMPLES; i++)
      taper.fill(Math.sin(Math.PI * i / (SAMPLES - 1)), (s * SAMPLES + i) * RING, (s * SAMPLES + i + 1) * RING)
    this.geometry.setAttribute('aTubeTaper', new THREE.BufferAttribute(taper, 1))
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))
    this.mesh.frustumCulled = false
    this.mesh.raycast = () => {}
    this.scene.add(this.mesh)
  }

  connect(isWorlds: () => boolean) {
    if (this.disconnect) return this.disconnect
    const move = (event: PointerEvent) => {
      if (!isWorlds() || document.hidden || !this.fine.matches || event.pointerType !== 'mouse') return
      if (event.clientX < 0 || event.clientY < 0 || event.clientX >= innerWidth || event.clientY >= innerHeight) return
      this.orbit.observe(event.clientX, event.clientY)
      this.dragging = event.buttons !== 0
      this.quiet = event.target instanceof Element && Boolean(event.target.closest(QUIET))
    }
    const out = (event: PointerEvent) => { if (!event.relatedTarget) { this.orbit.leave(); this.dragging = this.quiet = false } }
    const blur = () => { this.orbit.leave(); this.dragging = this.quiet = false }
    const clear = () => { this.orbit.clear(); this.running = false; this.dragging = this.quiet = false }
    const visibility = () => { this.running = false; this.orbit.reseed() }
    const down = (event: PointerEvent) => { move(event); this.dragging = true }
    const up = () => { this.dragging = false }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', out)
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    window.addEventListener('pointercancel', blur)
    window.addEventListener('blur', blur)
    window.addEventListener('keydown', clear)
    window.addEventListener('touchstart', clear, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    this.fine.addEventListener('change', clear)
    this.disconnect = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', out)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', blur)
      window.removeEventListener('blur', blur)
      window.removeEventListener('keydown', clear)
      window.removeEventListener('touchstart', clear)
      document.removeEventListener('visibilitychange', visibility)
      this.fine.removeEventListener('change', clear)
      this.disconnect = null
    }
    return this.disconnect
  }

  async prepare(gl: THREE.WebGLRenderer) {
    try {
      await gl.compileAsync(this.scene, this.camera)
      if (this.disposed) return
      const context = gl.getContext()
      const program = gl.info.programs?.find(program => program.name === this.material.name)?.program
      if (!program || !context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Tube shader did not link')
      await this.glow.prepare(gl, this.camera)
      if (!this.disposed) this.ready = true
    } catch (error) {
      console.warn('Optional Worlds tubes unavailable; smoke remains active.', error)
    }
  }

  update(dt: number, width: number, height: number, active: boolean, light: number,
    targetPigment: Pigment, smokePigment: Readonly<Pigment> | null, brightness: number) {
    if (!active) {
      this.orbit.clear()
      this.running = false
      return false
    }
    if (!this.ready || this.disposed || document.hidden || !this.fine.matches || !this.orbit.known) {
      this.running = false
      return false
    }
    const resized = this.width !== width || this.height !== height
    if (resized) {
      this.width = width; this.height = height
      this.camera.aspect = width / height
      this.camera.position.set(0, 0, height / (2 * Math.tan(Math.PI / 8)))
      this.camera.far = Math.max(4000, this.camera.position.z * 2)
      this.camera.updateProjectionMatrix()
    }
    const delta = this.running ? Math.max(0, Math.min(.05, dt)) : 0
    const target = this.orbit.step(delta, this.dragging)
    const pigment = smokePigment ? this.pigment.current : this.pigment.step(targetPigment, delta)
    if (smokePigment) {
      // Active smoke's *displayed* linear pigment is authoritative. The same
      // response runs only as a fallback during retained-anchor pointer leave.
      for (let i = 0; i < 3; i++) pigment.rgb[i] = smokePigment.rgb[i]
      pigment.lightness = smokePigment.lightness
      pigment.chroma = smokePigment.chroma
      pigment.hue = smokePigment.hue
      this.pigment.initialized = true
    }
    if (!this.running || resized || target.resetChain) {
      this.accumulator = 0
      this.seed(target.x, target.y, pigment.rgb)
    }
    this.running = true
    this.accumulator += delta
    while (this.accumulator >= STEP) {
      this.time += STEP
      this.follow(target.x, target.y, pigment.rgb)
      this.accumulator -= STEP
    }
    this.opacity += ((this.quiet ? .18 : 1) - this.opacity) * -Math.expm1(-delta / .14)
    this.material.uniforms.uTubeLight.value = light
    this.material.uniforms.uTubeOpacity.value = this.opacity
    this.material.uniforms.uTubeBrightness.value = brightness / 100
    this.writeGeometry(this.accumulator / STEP)
    return true
  }

  private seed(x: number, y: number, rgb: readonly number[]) {
    for (let s = 0; s < STRANDS; s++) {
      this.heads[s * 3] = x - this.width / 2
      this.heads[s * 3 + 1] = this.height / 2 - y
      this.heads[s * 3 + 2] = 0
    }
    this.trail.seed(this.time, this.heads, rgb)
  }

  private follow(x: number, y: number, rgb: readonly number[]) {
    for (let s = 0; s < STRANDS; s++) {
      const start = s * 3, phase = s * 2.3999632297
      // Subordinate weave keeps the short idle arc dimensional, without
      // creating independent targets or a second orbit animation owner.
      const spread = (4 + s * 1.3) * (1 - .4 * this.orbit.mix)
      this.heads[start] = x - this.width / 2 + Math.cos(this.time * .83 + phase) * spread
      this.heads[start + 1] = this.height / 2 - y + Math.sin(this.time * 1.07 + phase) * spread
      this.heads[start + 2] = Math.sin(this.time * .65 + phase) * 8
    }
    this.trail.append(this.time, this.heads, rgb, .32 + .85 * this.orbit.mix)
  }

  private writeGeometry(mix: number) {
    for (let s = 0; s < STRANDS; s++) {
      this.trail.sample(s, mix, Math.min(200, this.width * .45))
      const centers = this.trail.centers
      for (let i = 0; i < SAMPLES; i++) {
        const p = i * 3, before = Math.max(0, i - 1) * 3, after = Math.min(SAMPLES - 1, i + 1) * 3
        this.tangent.set(centers[after] - centers[before], centers[after + 1] - centers[before + 1], centers[after + 2] - centers[before + 2])
        if (this.tangent.lengthSq() < 1e-8) this.tangent.set(1, 0, 0)
        else this.tangent.normalize()
        // Parallel transport the previous section frame through reversals and
        // straight/zero segments. Avoid Frenet-frame flips on idle circles.
        if (i === 0) {
          this.axis.set(0, Math.abs(this.tangent.z) > .9 ? 1 : 0, Math.abs(this.tangent.z) > .9 ? 0 : 1)
          this.normal.crossVectors(this.tangent, this.axis).normalize()
        } else {
          this.normal.addScaledVector(this.tangent, -this.normal.dot(this.tangent))
          if (this.normal.lengthSq() < 1e-8) {
            this.axis.set(0, Math.abs(this.tangent.z) > .9 ? 1 : 0, Math.abs(this.tangent.z) > .9 ? 0 : 1)
            this.normal.crossVectors(this.tangent, this.axis)
          }
          this.normal.normalize()
        }
        this.binormal.crossVectors(this.tangent, this.normal).normalize()
        const radius = Math.sin(Math.PI * i / (SAMPLES - 1)) * (.9 + (s % 4) * .45) * Math.min(1, this.trail.arcLengths[s] / 18)
        for (let j = 0; j < RING; j++) {
          const a = this.ringCos[j], b = this.ringSin[j]
          const v = ((s * SAMPLES + i) * RING + j) * 3
          for (let axis = 0; axis < 3; axis++) {
            const n = this.normal.getComponent(axis) * a + this.binormal.getComponent(axis) * b
            this.normals[v + axis] = n
            this.positions[v + axis] = centers[p + axis] + n * radius
            this.colors[v + axis] = this.trail.colors[p + axis]
          }
        }
      }
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.needsUpdate = true
    this.geometry.attributes.color.needsUpdate = true
  }

  render(gl: THREE.WebGLRenderer) {
    const clear = gl.autoClear, target = gl.getRenderTarget(), test = gl.getScissorTest()
    const face = gl.getActiveCubeFace(), mip = gl.getActiveMipmapLevel(), alpha = gl.getClearAlpha()
    gl.getClearColor(this.clearColor)
    gl.getViewport(this.viewport); gl.getScissor(this.scissor)
    try {
      gl.autoClear = false
      this.glow.renderEmission(gl, this.camera, this.width, this.height)
      gl.setRenderTarget(target, face, mip); gl.setViewport(this.viewport); gl.setScissor(this.scissor)
      gl.setScissorTest(test)
      this.glow.renderComposite(gl, this.material.uniforms.uTubeLight.value, this.opacity, this.material.uniforms.uTubeBrightness.value)
      // The subsequent GlassLayer is a depth-independent screen pass. Clearing
      // depth here admits tubes over media/smoke while retaining self occlusion.
      gl.clearDepth()
      gl.render(this.scene, this.camera)
    } finally {
      gl.setClearColor(this.clearColor, alpha)
      gl.setRenderTarget(target, face, mip); gl.setViewport(this.viewport); gl.setScissor(this.scissor)
      gl.setScissorTest(test); gl.autoClear = clear
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.disconnect?.()
    this.glow.dispose()
    this.geometry.dispose(); this.material.dispose()
    this.scene.clear()
  }
}
