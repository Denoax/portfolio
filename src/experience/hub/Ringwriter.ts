import { pruneIntroRipples, clearIntroRipples } from '../../core/introRipples'
import { stepIntroZoom, hintOpacity } from '../../core/introMotion'
import { boundedZoom } from '../../core/introZoom'
import * as THREE from 'three'
import type { MenuPresentation } from '../../core/menuReel'

const text = 'MANI MARAMI MILANI · SELECT A PROJECT · '
const columns = 16,
  cell = 64

// Independent glyph instancing, adapted from the observed Ringwriter envelope.
// The creator's renderer/source is not available. This atlas rasterizes our
// licensed IBM Plex Mono text; it is typography rendering, not an image asset.
export class Ringwriter {
  private canvas = document.createElement('canvas')
  texture: THREE.CanvasTexture
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh
  private viewport = ''
  private holding = false
  private charge = 0
  private pulseAges = new Float32Array(4).fill(-1)
  private pointer = new THREE.Vector2(4, 4)
  private ready = false
  private running = false
  private ringCount = 24
  private primaryRadii = new Float32Array(24)

  constructor() {
    this.canvas.width = columns * cell
    this.canvas.height = 8 * cell
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.name = 'licensed-IBM-Plex-Mono-glyph-atlas'
    this.texture.colorSpace = THREE.NoColorSpace
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Clockwise placement and its orthonormal basis keep glyphs readable.
      side: THREE.FrontSide,
      toneMapped: false,
      uniforms: {
        uInk: { value: new THREE.Color('#f4f4f2') },
        uAtlas: { value: this.texture },
        uPrimaryRadii: { value: this.primaryRadii },
        uDetachedBase: { value: 2 ** (-5 + 23 * 0.25) },
        uRingCount: { value: 24 },
        uTime: { value: 0 },
        uZoom: { value: 0 },
        uScale: { value: 1 },
        uGlyph: { value: 0.03 },
        uCenter: { value: new THREE.Vector2() },
        uPointer: { value: this.pointer },
        uCharge: { value: 0 },
        uPulseAges: { value: this.pulseAges },
        uOpacity: { value: 0 },
      },
      vertexShader: `attribute float aRadius,aTheta,aChar,aOpacity,aSpeed,aKind,aFamily;
      uniform float uDetachedBase;uniform float uPrimaryRadii[24];uniform int uRingCount;
      uniform float uTime,uScale,uGlyph,uCharge,uZoom;uniform float uPulseAges[4];uniform vec2 uCenter,uPointer;
      varying vec2 vUv;varying float vChar,vOpacity,vDissolve,vKind;
      void main(){
        float radius=exp2(mod(log2(aRadius)+uZoom+5.,6.)-5.);
        // Recycle only in faded inner/outer bands; GPU coordinates stay bounded.
        float edge=smoothstep(.03125,.05,radius)*(1.-smoothstep(1.25,2.,radius));
        float glyph=min(uGlyph*radius/aRadius,.055);
        if(aFamily>.5){
          float nearest=2.;
          for(int i=0;i<24;i++){
            if(i<uRingCount)nearest=min(nearest,abs(radius-uPrimaryRadii[i]));
          }
          // Full circles enter only empty bands. Main typography owns its bands.
          edge*=smoothstep(.05,.085,nearest);
          // v16 live diagnostic: filler 23 becomes a detached complete band at
          // zoom -2. Keep its normal outer role and all other recycled rings.
          // Continuous radius/gap envelopes avoid a hard wrap or wheel rebuild.
          if(abs(aRadius-uDetachedBase)<.001){
            float detached=smoothstep(.18,.25,nearest/max(.001,radius));
            edge*=1.-detached*(1.-smoothstep(.65,.85,radius));
          }
          glyph=min(glyph,uGlyph*1.15);
        }
        float pulse=0.;
        for(int i=0;i<4;i++){
          if(uPulseAges[i]>=0.){
            float age=max(0.,uPulseAges[i]-radius*.65);
            pulse+=(1.-exp(-age*4.))*exp(-age*1.2);
          }
        }
        // A single wave retains the original envelope. Additional waves combine
        // continuously; their ages are never overwritten by later admissions.
        if(pulse>.65)pulse=.65+.30*(1.-exp(-(pulse-.65)/.30));
        float theta=aTheta+aSpeed*uTime+pulse*(.16+radius*.15);
        vec2 radial=vec2(cos(theta),sin(theta)),tangent=vec2(radial.y,-radial.x);
        vec2 center=radial*(radius+pulse*.018*(.5+radius))+uCenter;
        vec2 local=tangent*position.x*glyph*.94+radial*position.y*glyph;
        if(aKind>.5)local=position.xy*min(uGlyph,glyph)*.055;
        float reach=.10+uCharge*.12;
        vDissolve=1.-smoothstep(reach*.25,reach,length(center-uPointer));
        vChar=aChar;vOpacity=aOpacity*edge;vKind=aKind;vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4((center+local)*uScale,0.,1.);
      }`,
      fragmentShader: `uniform vec3 uInk;uniform sampler2D uAtlas;uniform float uOpacity;varying vec2 vUv;varying float vChar,vOpacity,vDissolve,vKind;
      void main(){
        vec2 tile=vec2(mod(vChar,16.),floor(vChar/16.));
        vec2 atlas=(vec2(tile.x,7.-tile.y)+vUv)/vec2(16.,8.);
        float letter=texture2D(uAtlas,atlas).a;
        vec2 dot=fract(vUv*vec2(3.,4.))-.5;
        float stipple=1.-smoothstep(.10,.23,length(dot));
        float coverage=mix(letter,stipple*.42,vDissolve);
        if(vKind>.5)coverage=1.-smoothstep(.2,.5,length(vUv-.5));
        gl_FragColor=vec4(uInk,coverage*vOpacity*uOpacity);
        #include <colorspace_fragment>
      }`,
    })
    this.mesh = new THREE.Mesh(
      new THREE.InstancedBufferGeometry(),
      this.material,
    )
    this.mesh.name = 'Ringwriter-independent-instanced-typography'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1000
    this.mesh.position.z = 0.12
  }

  async prepare() {
    await document.fonts.load('48px "IBM Plex Mono"')
    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    context.font = '48px "IBM Plex Mono"'
    context.fillStyle = '#fff'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    for (let code = 0; code < 128; code++)
      context.fillText(
        String.fromCharCode(code),
        ((code % columns) + 0.5) * cell,
        (Math.floor(code / columns) + 0.5) * cell,
      )
    this.texture.needsUpdate = true
    this.ready = true
  }

  connect(state: () => MenuPresentation['intro']) {
    const move = (event: PointerEvent) => {
      if (!state().active || state().paused) return
      const minimum = Math.min(innerWidth, innerHeight)
      this.pointer.set(
        (event.clientX - innerWidth * 0.5) / minimum,
        (innerHeight * 0.5 - event.clientY) / minimum,
      )
    }
    const resetClock = () => {
      this.running = false
    }
    document.addEventListener('visibilitychange', resetClock)
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', resetClock)
      window.removeEventListener('pointermove', move)
    }
  }

  update(
    dt: number,
    width: number,
    height: number,
    worldScale: number,
    intro: MenuPresentation['intro'],
    menuReady: boolean,
  ) {
    const key = `${width}:${height}`
    if (key !== this.viewport) {
      this.viewport = key
      this.resize(width, height)
    }
    this.mesh.visible = intro.active
    if (!intro.active) {
      this.running = false
      this.holding = false
      this.charge = 0
      clearIntroRipples(intro.ripples)
      this.pulseAges.fill(-1)
      return
    }
    if (this.ready && menuReady && !intro.paused && !document.hidden) {
      // Active time is independent of the finite DOM-owned exit.
      const delta = this.running ? dt : 0
      this.running = true
      intro.elapsed += Math.min(delta, 0.05)
      stepIntroZoom(intro, Math.min(delta, 0.05))
      if (intro.cueEpoch === null && intro.cueFontsReady)
        intro.cueEpoch = intro.elapsed
      if (intro.hint)
        intro.hint.style.opacity = String(
          intro.cueEpoch === null
            ? 0
            : hintOpacity(intro.elapsed - intro.cueEpoch),
        )
      this.material.uniforms.uZoom.value = boundedZoom(intro.zoom)
      this.holding = intro.holding
      this.charge = THREE.MathUtils.clamp(
        this.charge +
          (this.holding
            ? Math.min(delta, 0.1) * 1.8
            : -Math.min(delta, 0.1) * 2.8),
        0,
        1,
      )
    } else this.running = false
    const zoom = boundedZoom(intro.zoom)
    for (let i = 0; i < this.ringCount; i++) {
      this.primaryRadii[i] =
        2 ** (((((Math.log2(0.065 + i * 0.05) + zoom + 5) % 6) + 6) % 6) - 5)
    }
    this.material.uniforms.uRingCount.value = this.ringCount
    const uniforms = this.material.uniforms
    uniforms.uTime.value = intro.elapsed % (Math.PI * 2000)
    uniforms.uScale.value = worldScale * (1 + intro.exitProgress * 0.08)
    uniforms.uGlyph.value =
      Math.max(13.5, Math.min(20, width * 0.016)) /
      Math.min(width, height) /
      0.75
    uniforms.uCenter.value.set(0, (height * 0.025) / Math.min(width, height))
    uniforms.uCharge.value = this.charge
    pruneIntroRipples(intro.ripples, intro.elapsed)
    for (let i = 0; i < 4; i++) {
      const slot = intro.ripples.slots[i]
      this.pulseAges[i] = slot.active ? intro.elapsed - slot.startedAt : -1
    }
    uniforms.uOpacity.value =
      Math.min(1, intro.elapsed / 0.28) * (1 - intro.exitProgress)
  }

  private resize(width: number, height: number) {
    const values: number[][] = [[], [], [], [], [], [], []]
    const advance =
      (Math.max(13.5, Math.min(20, width * 0.016)) * 0.62) /
      Math.min(width, height)
    const rings = width < 720 ? 19 : 24
    this.ringCount = rings
    for (let ring = 0; ring < rings; ring++) {
      const radius = 0.065 + ring * 0.05,
        count = Math.max(12, Math.round((2 * Math.PI * radius) / advance))
      for (let index = 0; index < count; index++) {
        const char = text[(index + ring * 7) % text.length]
        values[0].push(radius)
        values[1].push(-(index / count) * Math.PI * 2 + ring * 0.18)
        values[2].push(char.charCodeAt(0) < 128 ? char.charCodeAt(0) : 46)
        values[3].push(
          (0.08 + 0.84 * Math.pow(1 - ring / rings, 1.6)) *
            (0.78 + 0.22 * Math.cos(ring * 0.9)),
        )
        values[4].push((ring % 2 ? -1 : 1) * (0.045 + ring * 0.004))
        values[5].push(0)
        values[6].push(0)
      }
      const dotCount = Math.round((2 * Math.PI * (radius + 0.025)) / 0.009)
      for (let index = 0; index < dotCount; index++) {
        values[0].push(radius + 0.025)
        values[1].push((index / dotCount) * Math.PI * 2)
        values[2].push(46)
        values[3].push(0.19)
        values[4].push(0)
        values[5].push(1)
        values[6].push(0)
      }
    }
    // Complete fixed rings replace the partial prefix reservoir. Their visibility
    // is computed against the primary bands, without wheel-driven allocations.
    for (let ring = 0; ring < 24; ring++) {
      const radius = 2 ** (-5 + ring * 0.25)
      const count = Math.max(24, Math.round((2 * Math.PI * radius) / advance))
      for (let index = 0; index < count; index++) {
        const char = text[(index + ring * 7) % text.length]
        values[0].push(radius)
        values[1].push((-index / count) * Math.PI * 2 + ring * 0.18)
        values[2].push(char.charCodeAt(0) < 128 ? char.charCodeAt(0) : 46)
        values[3].push(0.32)
        values[4].push((ring % 2 ? -1 : 1) * (0.045 + ring * 0.004))
        values[5].push(0)
        values[6].push(1)
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1),
      geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.attributes.position = plane.attributes.position
    geometry.attributes.uv = plane.attributes.uv
    const names = [
      'aRadius',
      'aTheta',
      'aChar',
      'aOpacity',
      'aSpeed',
      'aKind',
      'aFamily',
    ]
    names.forEach((name, index) =>
      geometry.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(new Float32Array(values[index]), 1),
      ),
    )
    geometry.instanceCount = values[0].length
    const previous = this.mesh.geometry
    this.mesh.geometry = geometry
    previous.dispose()
  }
  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
  }
}
