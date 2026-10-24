import * as THREE from 'three'
import { TubeOrbit } from '../../core/tubeOrbit'
import { PigmentResponse } from '../../core/projectPigment'
import type { Pigment } from '../../core/projectPigment'

// Reference: Kevin Levron, Tubes Cursor / threejs-components 0.0.19.
// Independently authored geometry, follower, shading and host integration;
// no creator bundle or engine code is included. See the source/rights record.
const STRANDS = 9
const SAMPLES = 72
const SIDES = 8
const RING = SIDES + 1
const STEP = 1 / 60
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
       vec3 body=vTubePigment*(mix(.28,.17,uTubeLight)+diffuse*mix(.52,.43,uTubeLight));
       vec3 reflection=mix(vTubePigment,vec3(1.),.26)*(spec*.65+secondary*.24);
       body+=reflection+vTubePigment*rim*mix(.17,.06,uTubeLight);
       gl_FragColor=vec4(body*uTubeBrightness,uTubeOpacity);
       #include <colorspace_fragment>
      }`,
  })
  readonly mesh = new THREE.Mesh(this.geometry, this.material)
  private fine = window.matchMedia('(pointer: fine) and (hover: hover)')
  private points = new Float32Array(STRANDS * SAMPLES * 3)
  private previous = new Float32Array(this.points.length)
  private history = new Float32Array(this.points.length)
  private oldHistory = new Float32Array(this.points.length)
  private positions = new Float32Array(STRANDS * SAMPLES * RING * 3)
  private normals = new Float32Array(this.positions.length)
  private colors = new Float32Array(this.positions.length)
  private centers = new Float32Array(SAMPLES * 3)
  private pigment = new PigmentResponse()
  private tangent = new THREE.Vector3()
  private normal = new THREE.Vector3()
  private binormal = new THREE.Vector3()
  private axis = new THREE.Vector3(0, 0, 1)
  private viewport = new THREE.Vector4()
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
    const out = (event: PointerEvent) => { if (!event.relatedTarget) { this.orbit.leave(); this.dragging = false } }
    const blur = () => { this.orbit.leave(); this.dragging = false }
    const clear = () => { this.orbit.clear(); this.running = false; this.dragging = false }
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
      const context = gl.getContext()
      const program = gl.info.programs?.find(program => program.name === this.material.name)?.program
      if (!program || !context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Tube shader did not link')
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
      this.previous.set(this.points); this.oldHistory.set(this.history)
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
    for (let s = 0; s < STRANDS; s++) for (let i = 0; i < SAMPLES; i++) {
      const p = (s * SAMPLES + i) * 3
      this.points[p] = x - this.width / 2
      this.points[p + 1] = this.height / 2 - y
      this.points[p + 2] = 0
      this.history.set(rgb, p)
    }
    this.previous.set(this.points); this.oldHistory.set(this.history)
  }

  private follow(x: number, y: number, rgb: readonly number[]) {
    for (let s = 0; s < STRANDS; s++) {
      const start = s * SAMPLES * 3
      // Back-to-front stepping gives every link the previous simulation state.
      const response = .36 + s * .045
      for (let i = SAMPLES - 1; i > 0; i--) for (let axis = 0; axis < 3; axis++) {
        const p = start + i * 3 + axis
        this.points[p] += (this.points[p - 3] - this.points[p]) * response
        this.history[p] += (this.history[p - 3] - this.history[p]) * response
      }
      const phase = s * 2.3999632297
      // The reference's wandering stays subordinate to the requested compact
      // idle circle; a moving-size offset here would knot up a 22px orbit.
      const spread = (4 + s * 1.6) * (1 - .8 * this.orbit.mix)
      this.points[start] = x - this.width / 2 + Math.cos(this.time * .83 + phase) * spread
      this.points[start + 1] = this.height / 2 - y + Math.sin(this.time * 1.07 + phase) * spread
      this.points[start + 2] = Math.sin(this.time * .65 + phase) * 12 * (1 - .5 * this.orbit.mix)
      this.history.set(rgb, start)
    }
  }

  private writeGeometry(mix: number) {
    for (let s = 0; s < STRANDS; s++) {
      const start = s * SAMPLES * 3
      for (let i = 0; i < SAMPLES * 3; i++) this.centers[i] = this.previous[start + i] + (this.points[start + i] - this.previous[start + i]) * mix
      for (let i = 0; i < SAMPLES; i++) {
        const p = i * 3, before = Math.max(0, i - 1) * 3, after = Math.min(SAMPLES - 1, i + 1) * 3
        this.tangent.set(this.centers[after] - this.centers[before], this.centers[after + 1] - this.centers[before + 1], this.centers[after + 2] - this.centers[before + 2])
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
        const radius = Math.sin(Math.PI * i / (SAMPLES - 1)) * (.9 + (s % 4) * .45)
        for (let j = 0; j < RING; j++) {
          const angle = j / SIDES * Math.PI * 2, a = Math.cos(angle), b = Math.sin(angle)
          const v = ((s * SAMPLES + i) * RING + j) * 3
          for (let axis = 0; axis < 3; axis++) {
            const n = this.normal.getComponent(axis) * a + this.binormal.getComponent(axis) * b
            this.normals[v + axis] = n
            this.positions[v + axis] = this.centers[p + axis] + n * radius
            const c = start + p + axis
            this.colors[v + axis] = this.oldHistory[c] + (this.history[c] - this.oldHistory[c]) * mix
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
    gl.getViewport(this.viewport); gl.getScissor(this.scissor)
    try {
      gl.autoClear = false
      // The subsequent GlassLayer is a depth-independent screen pass. Clearing
      // depth here admits tubes over media/smoke while retaining self occlusion.
      gl.clearDepth()
      gl.render(this.scene, this.camera)
    } finally {
      gl.setRenderTarget(target); gl.setViewport(this.viewport); gl.setScissor(this.scissor)
      gl.setScissorTest(test); gl.autoClear = clear
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.disconnect?.()
    this.geometry.dispose(); this.material.dispose()
    this.scene.clear()
  }
}
