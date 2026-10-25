import { pruneIntroRipples, clearIntroRipples, snapEnvelope } from '../../core/introRipples'
import { stepIntroZoom, hintOpacity } from '../../core/introMotion'
import { boundedZoom } from '../../core/introZoom'
import {
  INTRO_PHRASE, INTRO_GLYPHS, INTRO_GLYPHS_PER_BAND, INTRO_LOG_GAP, INTRO_ATLAS,
  introBandLayout, INTRO_FORMATION, introGlyphFormationSeed, INTRO_SECTION, introSectionProjection,
} from '../../core/introBands'
import * as THREE from 'three'
import type { MenuPresentation } from '../../core/menuReel'

const { columns, rows, cell, fontPx } = INTRO_ATLAS
const formation = INTRO_FORMATION

// Original instanced typography using the licensed IBM Plex Mono font. Reference
// footage informs its envelope; neither creator artwork nor renderer is shipped.
export class Ringwriter {
  private canvas = document.createElement('canvas')
  texture: THREE.CanvasTexture
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh
  private viewport = ''
  private charge = 0
  private pressure = 0
  private pulseAges = new Float32Array(4).fill(-1)
  private pointer = new THREE.Vector2(4, 4)
  private ready = false
  private running = false
  private font = { advance: fontPx * 0.6, inkHeight: fontPx * 0.73,
    ascent: fontPx * 0.72, descent: fontPx * 0.01, strokeWidth: fontPx * 0.07 }
  private layout = introBandLayout(1440, 900, this.font.advance, this.font.inkHeight, cell)

  constructor() {
    if (INTRO_GLYPHS.length > columns * rows) throw new Error('Intro glyph table exceeds atlas capacity')
    this.canvas.width = columns * cell
    this.canvas.height = rows * cell
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.name = 'licensed-IBM-Plex-Mono-glyph-atlas'
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.generateMipmaps = true
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      side: THREE.FrontSide, toneMapped: false,
      uniforms: {
        uInk: { value: new THREE.Color('#f4f4f2') }, uAtlas: { value: this.texture },
        uTransitionContour: { value: 0 },
        uPressure: { value: 0 }, uPressureTime: { value: 0 }, uSnap: { value: 0 },
        uTime: { value: 0 }, uZoom: { value: 0 }, uPeriod: { value: this.layout.depthPeriod },
        uLower: { value: this.layout.lower }, uOuterSupportLog: { value: this.layout.outerSupportLog }, uScale: { value: 1 },
        uQuadFactor: { value: this.layout.quadFactor },
        uInkHeight: { value: this.font.inkHeight }, uCssPixelScale: { value: 900 },
        uRenderPixelRatio: { value: 1 }, uStrokeRatio: { value: this.font.strokeWidth / this.font.inkHeight },
        uAtlasGrid: { value: new THREE.Vector2(columns, rows) }, uAtlasCell: { value: cell },
        uAtlasSize: { value: new THREE.Vector2(this.canvas.width, this.canvas.height) },
        uAtlasMaxLod: { value: 0 },
        uShuffle: { value: 0 }, uShuffleSeed: { value: 0 },
        uCenter: { value: new THREE.Vector2() }, uPointer: { value: this.pointer },
        uCharge: { value: 0 }, uPulseAges: { value: this.pulseAges }, uOpacity: { value: 0 },
      },
      vertexShader: `attribute float aLog,aTheta,aChar,aOpacity,aSpeed,aIndex,aFormationRank,aFormationOffset;
      uniform float uTime,uScale,uQuadFactor,uInkHeight,uCharge,uZoom,uPeriod,uLower,uOuterSupportLog,uCssPixelScale,uRenderPixelRatio,uStrokeRatio,uAtlasCell,uShuffle,uShuffleSeed;
      uniform float uPressure,uPressureTime,uSnap;
      uniform float uPulseAges[4];uniform vec2 uCenter,uPointer;
      varying vec2 vUv;varying float vChar,vOpacity;
      float hash(float n){return fract(sin(n*127.1+uShuffleSeed*311.7)*43758.5453);}
      void main(){
        float depth=uLower+mod(aLog+uZoom,uPeriod);
        float radius=exp2(depth);
        float arrival=1.-smoothstep(uOuterSupportLog-${INTRO_SECTION.outerFadeOctaves},uOuterSupportLog,depth);
        // Resolution uses allocated physical pixels; composition uses CSS ink size.
        // Persistent formation reverses with depth, independently of release shuffle.
        float inkCss=radius*uQuadFactor*uInkHeight/uAtlasCell*uCssPixelScale;
        float edge=smoothstep(${formation.strokeStart},${formation.strokeEnd},inkCss*uRenderPixelRatio*uStrokeRatio)
          *smoothstep(${INTRO_SECTION.minInkCss}.,${INTRO_SECTION.fullInkCss}.,inkCss);
        float assembly=smoothstep(${formation.assemblyStart}.,${formation.assemblyEnd}.,inkCss);
        float density=mix(${formation.sparseDensity},1.,assembly);
        float reveal=smoothstep(aFormationRank-${formation.revealWidth},aFormationRank+${formation.revealWidth},density);
        float coverage=mix(reveal,1.,assembly);
        float settle=aFormationOffset*(1.-assembly)*${2 * Math.PI / INTRO_GLYPHS_PER_BAND};
        float pulse=0.;
        for(int i=0;i<4;i++){
          if(uPulseAges[i]>=0.){
            float age=max(0.,uPulseAges[i]-radius*.65);
            pulse+=(1.-exp(-age*4.))*exp(-age*1.2);
          }
        }
        if(pulse>.65)pulse=.65+.30*(1.-exp(-(pulse-.65)/.30));
        float scatter=(hash(aIndex)-.5)*uShuffle;
        float theta=aTheta+settle+aSpeed*uTime+pulse*(.16+radius*.15)+scatter*.075;
        vec2 radial=vec2(cos(theta),sin(theta)),tangent=vec2(radial.y,-radial.x);
        vec2 center=radial*(radius*(1.+scatter*.07)+pulse*.018*(.5+radius))+uCenter;
        vec2 local=(tangent*position.x+radial*position.y)*radius*uQuadFactor;
        // The release kick moves existing glyphs, with a small damped recoil.
        // CSS-pixel bounds keep it legible at every ring scale and viewport.
        center+=radial*uSnap*clamp(inkCss*.16,1.5,8.)/uCssPixelScale;
        local*=1.+uSnap*.045;
        float reach=.10+uCharge*.12;
        vec2 fromPointer=center-uPointer;
        float influence=1.-smoothstep(reach*.25,reach,length(fromPointer));
        // Move existing ink smoothly. Transparent atlas space never acquires ink.
        center+=normalize(fromPointer+vec2(.0001))*influence*.018*(.5+radius);
        float bend=influence*(.04+uCharge*.12);
        local=mat2(cos(bend),sin(bend),-sin(bend),cos(bend))*local;
        // Held transport is stationary. Existing active time drives only this
        // bounded glyph-local tremble, in CSS pixels, without changing ink.
        float pressure=uPressure*uPressure;
        float phase=aFormationRank*${2 * Math.PI};
        vec2 tremble=vec2(
          sin(uPressureTime*43.+phase)+.35*sin(uPressureTime*61.+phase*2.),
          sin(uPressureTime*47.-phase)+.35*sin(uPressureTime*67.+phase*3.))/1.35;
        center+=tremble*pressure*clamp(inkCss*.045,.35,1.8)/uCssPixelScale;
        float tilt=sin(uPressureTime*37.+phase)*pressure*.012;
        local=mat2(cos(tilt),sin(tilt),-sin(tilt),cos(tilt))*local;
        vChar=aChar;vOpacity=aOpacity*edge*coverage*arrival;vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4((center+local)*uScale,0.,1.);
      }`,
      fragmentShader: `uniform vec3 uInk;uniform sampler2D uAtlas;uniform float uOpacity;
      uniform float uTransitionContour,uRenderPixelRatio;
      uniform vec2 uAtlasGrid,uAtlasSize;uniform float uAtlasCell,uAtlasMaxLod;
      varying vec2 vUv;varying float vChar,vOpacity;
      void main(){
        // Interpolation may move a discrete index below an exact row boundary.
        float glyphIndex=floor(vChar+.5);
        vec2 tile=vec2(mod(glyphIndex,uAtlasGrid.x),floor(glyphIndex/uAtlasGrid.x));
        // Half-texel inset and transparent padding isolate every atlas cell.
        vec2 atlas=(vec2(tile.x,uAtlasGrid.y-1.-tile.y)*uAtlasCell+.5+vUv*(uAtlasCell-1.))/uAtlasSize;
        vec2 footprintX=dFdx(atlas*uAtlasSize),footprintY=dFdy(atlas*uAtlasSize);
        float lod=.5*log2(max(max(dot(footprintX,footprintX),dot(footprintY,footprintY)),.000001));
        // Coarser whole-atlas levels lose cell isolation. Limit actual sampling
        // to the last level supported by measured transparent glyph padding.
        lod=clamp(lod,0.,uAtlasMaxLod);
        float letter=texture2DLodEXT(uAtlas,atlas,lod).a;
        vec3 ink=uInk;float coverage=letter;
        if(uTransitionContour>.001){
          // Opposite polarity inks necessarily cross during a continuous theme
          // dissolve. A temporary two-tone edge preserves the glyph silhouette;
          // both endpoint themes retain their exact original atlas treatment.
          vec2 dx=dFdx(atlas)*uRenderPixelRatio,dy=dFdy(atlas)*uRenderPixelRatio;
          vec2 origin=vec2(tile.x,uAtlasGrid.y-1.-tile.y)*uAtlasCell;
          vec2 lower=(origin+.5)/uAtlasSize,upper=(origin+uAtlasCell-.5)/uAtlasSize;
          float nearInk=letter,farInk=letter;
          for(int side=0;side<4;side++){
            vec2 offset=side==0?dx:side==1?-dx:side==2?dy:-dy;
            nearInk=max(nearInk,texture2DLodEXT(uAtlas,clamp(atlas+offset,lower,upper),lod).a);
            farInk=max(farInk,texture2DLodEXT(uAtlas,clamp(atlas+offset*2.,lower,upper),lod).a);
          }
          farInk=max(farInk,nearInk);
          float edge=(farInk-letter)*uTransitionContour;
          vec3 contour=vec3(1.-clamp((nearInk-letter)/max(farInk-letter,.00001),0.,1.));
          coverage=letter+edge;
          ink=(uInk*letter+contour*edge)/max(coverage,.00001);
        }
        gl_FragColor=vec4(ink,coverage*vOpacity*uOpacity);
        #include <colorspace_fragment>
      }`,
    })
    this.mesh = new THREE.Mesh(new THREE.InstancedBufferGeometry(), this.material)
    this.mesh.name = 'Ringwriter-independent-instanced-typography'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1000
    this.mesh.position.z = 0.12
  }

  async prepare() {
    const faces = await document.fonts.load(`${fontPx}px "IBM Plex Mono"`)
    if (!faces.length || !document.fonts.check(`${fontPx}px "IBM Plex Mono"`))
      throw new Error('Ringwriter font unavailable')
    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    context.font = `${fontPx}px "IBM Plex Mono"`
    context.fillStyle = '#fff'
    context.textAlign = 'center'
    context.textBaseline = 'alphabetic'
    const metrics = INTRO_GLYPHS.map(char => context.measureText(char))
    const ascent = Math.max(...metrics.map(metric => metric.actualBoundingBoxAscent))
    const descent = Math.max(...metrics.map(metric => metric.actualBoundingBoxDescent))
    this.font = { advance: metrics[0].width, inkHeight: ascent + descent, ascent, descent, strokeWidth: fontPx * 0.07 }
    INTRO_GLYPHS.forEach((char, index) => context.fillText(char,
      ((index % columns) + 0.5) * cell,
      Math.floor(index / columns) * cell + (cell + ascent - descent) / 2))
    let padding: number = cell
    const glyphBounds = INTRO_GLYPHS.map((glyph, index) => {
      const pixels = context.getImageData(index % columns * cell, Math.floor(index / columns) * cell, cell, cell).data
      let left: number = cell, top: number = cell, right = -1, bottom = -1
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        if (pixels[(y * cell + x) * 4 + 3] === 0) continue
        left = Math.min(left, x); right = Math.max(right, x)
        top = Math.min(top, y); bottom = Math.max(bottom, y)
      }
      if (right >= 0) padding = Math.min(padding, left, top, cell - 1 - right, cell - 1 - bottom)
      if (glyph === 'I') {
        let stem: number = cell
        for (let y = Math.ceil(top + (bottom - top) * 0.35); y <= top + (bottom - top) * 0.65; y++) {
          let width = 0
          for (let x = left; x <= right; x++) if (pixels[(y * cell + x) * 4 + 3] >= 128) width++
          if (width) stem = Math.min(stem, width)
        }
        if (stem < cell) this.font.strokeWidth = stem
      }
      return { glyph, left, top, right, bottom }
    })
    const maxSafeLod = Math.max(0, Math.floor(Math.log2(Math.max(1, padding))))
    this.material.uniforms.uAtlasMaxLod.value = maxSafeLod
    this.texture.userData.atlas = { ...INTRO_ATLAS, padding, maxSafeLod, glyphBounds }
    this.texture.needsUpdate = true
    this.viewport = '' // Font readiness is an explicit geometry transition.
    this.ready = true
  }

  connect(state: () => MenuPresentation['intro']) {
    const move = (event: PointerEvent) => {
      if (!state().active || state().paused || state().inputBlocked) return
      const minimum = Math.min(innerWidth, innerHeight)
      this.pointer.set((event.clientX - innerWidth * 0.5) / minimum,
        (innerHeight * 0.5 - event.clientY) / minimum)
    }
    const resetClock = () => {
      this.running = false
      this.pressure = 0
      this.material.uniforms.uPressure.value = 0
      this.material.uniforms.uSnap.value = 0
    }
    document.addEventListener('visibilitychange', resetClock)
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', resetClock)
      window.removeEventListener('pointermove', move)
    }
  }

  update(dt: number, width: number, height: number, worldScale: number,
    intro: MenuPresentation['intro'], menuReady: boolean, renderPixelRatio = 1) {
    const key = `${width}:${height}`
    if (key !== this.viewport) { this.viewport = key; this.resize(width, height) }
    intro.loopPeriod = this.layout.period
    this.mesh.visible = intro.active
    if (!intro.active) {
      this.running = false; this.charge = 0; this.pressure = 0
      this.material.uniforms.uPressure.value = 0
      clearIntroRipples(intro.ripples); this.pulseAges.fill(-1)
      return
    }
    if (this.ready && menuReady && !intro.paused && !document.hidden) {
      const delta = this.running ? Math.min(dt, 0.05) : 0
      this.running = true
      intro.elapsed += delta
      stepIntroZoom(intro, delta)
      if (intro.cueEpoch === null && intro.cueFontsReady) intro.cueEpoch = intro.elapsed
      if (intro.hint) intro.hint.style.opacity = String(intro.cueEpoch === null
        ? 0 : hintOpacity(intro.elapsed - intro.cueEpoch))
      this.charge = THREE.MathUtils.clamp(this.charge + delta * (intro.holding ? 1.8 : -2.8), 0, 1)
      const held = intro.holding && intro.transport.state === 'HELD'
      this.pressure = intro.inputBlocked || intro.exiting ? 0
        : THREE.MathUtils.damp(this.pressure, held ? 1 : 0, held ? 5 : 16, delta)
    } else {
      this.running = false
      this.pressure = 0
    }
    const uniforms = this.material.uniforms
    uniforms.uZoom.value = introSectionProjection(boundedZoom(intro.zoom, this.layout.period), this.layout)
    uniforms.uTime.value = intro.transport.angularTime
    uniforms.uPressure.value = this.pressure
    uniforms.uSnap.value = intro.holding || intro.exiting || intro.inputBlocked ? 0
      : snapEnvelope(intro.ripples.snapStartedAt === null ? -1 : intro.elapsed - intro.ripples.snapStartedAt)
    // Integer harmonic frequencies make this bounded active-time wrap seamless.
    uniforms.uPressureTime.value = intro.elapsed % (2 * Math.PI)
    uniforms.uShuffle.value = intro.transport.shuffleAmount
    uniforms.uShuffleSeed.value = intro.transport.shuffleSeed
    uniforms.uScale.value = worldScale * (1 + intro.exitProgress * 0.08)
    uniforms.uCssPixelScale.value = Math.min(width, height)
    uniforms.uRenderPixelRatio.value = renderPixelRatio
    uniforms.uCenter.value.set(0, height * 0.025 / Math.min(width, height))
    uniforms.uCharge.value = this.charge
    pruneIntroRipples(intro.ripples, intro.elapsed)
    for (let i = 0; i < 4; i++) {
      const slot = intro.ripples.slots[i]
      this.pulseAges[i] = slot.active ? intro.elapsed - slot.startedAt : -1
    }
    uniforms.uOpacity.value = Math.min(1, intro.elapsed / 0.28) * (1 - intro.exitProgress)
  }

  private resize(width: number, height: number) {
    this.layout = introBandLayout(width, height, this.font.advance, this.font.inkHeight, cell)
    const values: number[][] = Array.from({ length: 8 }, () => [])
    const phrase = Array.from(INTRO_PHRASE)
    for (let ring = 0; ring < this.layout.count; ring++) {
      const speed = (ring % 2 ? -1 : 1) * (INTRO_SECTION.spinBase + ring * INTRO_SECTION.spinStep)
      for (let index = 0; index < INTRO_GLYPHS_PER_BAND; index++) {
        const char = phrase[index % phrase.length]
        if (char === ' ') continue
        values[0].push(ring * INTRO_LOG_GAP)
        values[1].push(-index * this.layout.pitch + ring * 0.18)
        values[2].push(INTRO_GLYPHS.indexOf(char))
        values[3].push(0.82); values[4].push(speed)
        const logicalId = ring * INTRO_GLYPHS_PER_BAND + index
        const seed = introGlyphFormationSeed(logicalId)
        values[5].push(logicalId)
        values[6].push(seed.rank); values[7].push(seed.offsetSlots)
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.attributes.position = plane.attributes.position
    geometry.attributes.uv = plane.attributes.uv
    const names = ['aLog', 'aTheta', 'aChar', 'aOpacity', 'aSpeed', 'aIndex', 'aFormationRank', 'aFormationOffset']
    names.forEach((name, index) => geometry.setAttribute(name,
      new THREE.InstancedBufferAttribute(new Float32Array(values[index]), 1)))
    geometry.instanceCount = values[0].length
    const previous = this.mesh.geometry
    this.mesh.geometry = geometry
    previous.dispose()
    this.material.uniforms.uPeriod.value = this.layout.depthPeriod
    this.material.uniforms.uLower.value = this.layout.lower
    this.material.uniforms.uOuterSupportLog.value = this.layout.outerSupportLog
    this.material.uniforms.uQuadFactor.value = this.layout.quadFactor
    this.material.uniforms.uInkHeight.value = this.font.inkHeight
    this.material.uniforms.uStrokeRatio.value = this.font.strokeWidth / this.font.inkHeight
    this.mesh.userData.introBands = { ...this.layout, fontBounds: this.font,
      glyphs: INTRO_GLYPHS, phrase: INTRO_PHRASE, motifs: 2, columns, rows, cell,
      atlas: { ...INTRO_ATLAS, ...this.texture.userData.atlas }, formation, section: INTRO_SECTION }
  }

  dispose() {
    this.mesh.geometry.dispose(); this.material.dispose(); this.texture.dispose()
  }
}
