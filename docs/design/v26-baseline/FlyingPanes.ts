import * as THREE from 'three'
import { paneTilePose, paneFlightGLSL, tileSeed } from '../../core/paneFlight'
import type { Point2, TileFlight, TilePose } from '../../core/paneFlight'
import { paneFlights } from './PaneFlights'
import type { PaneFlightField } from './PaneFlights'
import { themeColor } from '../../core/theme'

const CAPACITY = 32768, SLOT = 1024, ATLAS = 2048
type GeometryField = {
  epoch: number
  cols: number
  rows: number
  from: Float32Array
  velocity: Float32Array
  alpha: Float32Array
  spareFrom: Float32Array
  spareVelocity: Float32Array
  spareAlpha: Float32Array
  seeds: Float32Array
  flight: TileFlight
  nativeFront: number
  paintVersion: number
  paint: HTMLCanvasElement
  slot: number
}
const emptyPose = (): TilePose => ({ x: 0, y: 0, alpha: 0, born: false, settled: false, vx: 0, vy: 0 })

// One bounded atlas/draw. Paint revisions never rebuild trajectories or attributes.
export class FlyingPanes {
  readonly scene = new THREE.Scene()
  readonly geometry = new THREE.InstancedBufferGeometry()
  readonly material: THREE.RawShaderMaterial
  private canvas = document.createElement('canvas')
  private texture: THREE.CanvasTexture
  private fields = new Map<string, GeometryField>()
  private geometryKey = ''
  private compilation: Promise<void> | null = null
  private attributes: Record<string, THREE.InstancedBufferAttribute>
  private uniforms: Record<string, THREE.IUniform>
  private pose = emptyPose()
  private uv = { x: 0, y: 0 }
  private seed = { x: 0, y: 0 }
  private origin: Point2 = { x: 0, y: 0 }
  private speed: Point2 = { x: 0, y: 0 }
  constructor(shared: { uBase: THREE.IUniform; uSize: THREE.IUniform; uPixelRatio: THREE.IUniform }) {
    this.canvas.width = this.canvas.height = ATLAS
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.generateMipmaps = false
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter
    const plane = new THREE.PlaneGeometry(1, 1)
    this.geometry.index = plane.index
    this.geometry.setAttribute('position', plane.attributes.position)
    this.geometry.setAttribute('uv', plane.attributes.uv)
    this.attributes = {
      aTarget: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2),
      aSeed: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2),
      aFrom: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2),
      aVelocity: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2),
      aAlpha: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
      aField: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
    }
    for (const [name, attribute] of Object.entries(this.attributes))
      this.geometry.setAttribute(name, attribute.setUsage(THREE.DynamicDrawUsage))
    this.geometry.instanceCount = 0
    this.uniforms = {
      ...shared,
      uPaint: { value: this.texture },
      uRects: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uAnchors: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uStates: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uFresh: { value: [0, 0, 0, 0] },
      uCells: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uPaintRects: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uFilm: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uRadius: { value: [0, 0, 0, 0] },
    }
    this.material = new THREE.RawShaderMaterial({
      uniforms: this.uniforms, glslVersion: THREE.GLSL3,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: `precision highp float;in vec3 position;in vec2 aTarget,aSeed,aFrom,aVelocity;in float aField,aAlpha;uniform vec2 uSize,uCells[4],uAnchors[4];uniform vec4 uRects[4],uStates[4];uniform float uFresh[4];out vec2 vTarget;flat out float vField;out float vAlpha;
      float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
      ${paneFlightGLSL}
      void main(){int i=int(aField);vec4 r=uRects[i],state=uStates[i];bool opening=state.y>.5;
       vec3 pose=tilePose(state.x,opening,uFresh[i]>.5,state.w,r,uAnchors[i],aTarget,aSeed,aFrom,aVelocity,aAlpha,uSize.x);
       vec2 p=pose.xy+vec2(position.x,-position.y)*uCells[i];gl_Position=vec4(p.x/uSize.x*2.-1.,1.-p.y/uSize.y*2.,0.,1.);
       vTarget=aTarget+vec2(position.x,-position.y)*uCells[i]/r.zw;vField=aField;vAlpha=pose.z;}`,
      fragmentShader: `precision highp float;out vec4 outColor;uniform sampler2D uBase,uPaint;uniform vec2 uSize;uniform vec4 uRects[4],uStates[4],uPaintRects[4],uFilm[4];uniform float uRadius[4];in vec2 vTarget;flat in float vField;in float vAlpha;
      void main(){if(vAlpha<.001)discard;int i=int(vField);vec4 r=uRects[i],paintRect=uPaintRects[i];
       // Coverage is cut in final-cell coordinates only after every cell at the
       // native front has arrived. No center-based row discard leaves half cells.
       float seam=min(10.,(1.-uStates[i].z)*r.w);
       float takeover=uStates[i].y>.5?(seam>.001?smoothstep(0.,seam,(uStates[i].z-vTarget.y)*r.w):float(vTarget.y<uStates[i].z)):0.;
       if(takeover>.999)discard;
       vec2 local=(vTarget-.5)*r.zw,q=abs(local)-r.zw*.5+uRadius[i];float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius[i];if(d>0.)discard;
       vec2 samplePoint=r.xy+r.zw*.5+local/1.095;vec3 backdrop=texture(uBase,vec2(samplePoint.x/uSize.x,1.-samplePoint.y/uSize.y)).rgb;
       vec3 glass=mix(backdrop,uFilm[i].rgb,uFilm[i].a);vec2 paintUv=(paintRect.xy+vTarget*paintRect.zw)/2048.;vec4 foreground=texture(uPaint,vec2(paintUv.x,1.-paintUv.y));
       outColor=vec4(mix(glass,foreground.rgb,foreground.a),vAlpha*(1.-takeover));}`,
    })
    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }
  private snapshot(field: PaneFlightField): TileFlight {
    return { ...field.flight, rect: { ...field.flight.rect }, anchor: { ...field.flight.anchor } }
  }
  sync(light: number) {
    const active = [...paneFlights.fields.values()].filter(f => f.flight.progress < 1).slice(-4)
    if (!active.length) {
      this.geometry.instanceCount = 0
      this.fields.clear()
      this.geometryKey = ''
      paneFlights.metrics.tiles = 0
      return 0
    }
    const area = active.reduce((n, f) => n + f.flight.rect.width * f.flight.rect.height, 0)
    const cell = Math.max(4, Math.ceil(Math.sqrt(area / CAPACITY)))
    const key = active.map(f => `${f.key}:${f.epoch}`).join('|')
    const ctx = this.canvas.getContext('2d')!
    let atlasDirty = false
    if (key !== this.geometryKey) {
      const next = new Map<string, GeometryField>()
      let offset = 0
      paneFlights.metrics.geometryBuilds++
      active.forEach((field, slot) => {
        const old = this.fields.get(field.key), r = field.flight.rect
        const reserved = active.slice(slot + 1).reduce((n, f) => {
          const kept = this.fields.get(f.key)
          return n + (kept ? kept.cols * kept.rows : 0)
        }, 0)
        // Keep at least one slot for each possible overlapping future field.
        // Otherwise one exact-capacity pane can make the next field overflow.
        const budget = Math.max(1, CAPACITY - (4 - active.length) - offset - reserved)
        let step = cell
        if (!old) while (Math.ceil(r.width / step) * Math.ceil(r.height / step) > budget) step++
        const cols = old?.cols ?? Math.ceil(r.width / step), rows = old?.rows ?? Math.ceil(r.height / step)
        const count = cols * rows
        if (offset + count > CAPACITY) throw new Error('Pane tile capacity invariant exceeded')
        const reused = old && old.epoch === field.epoch
        // Ping-pong per-field pose storage. An interruption reads the previous
        // epoch while writing its spare; repeated reversals allocate no points.
        const from = reused ? old.from : old?.spareFrom ?? new Float32Array(count * 2)
        const velocity = reused ? old.velocity : old?.spareVelocity ?? new Float32Array(count * 2)
        const alpha = reused ? old.alpha : old?.spareAlpha ?? new Float32Array(count)
        const spareFrom = reused ? old.spareFrom : old?.from ?? new Float32Array(count * 2)
        const spareVelocity = reused ? old.spareVelocity : old?.velocity ?? new Float32Array(count * 2)
        const spareAlpha = reused ? old.spareAlpha : old?.alpha ?? new Float32Array(count)
        const seeds = old?.seeds ?? new Float32Array(count * 2)
        for (let tile = 0; tile < count; tile++) {
          this.uv.x = ((tile % cols) + 0.5) / cols
          this.uv.y = (Math.floor(tile / cols) + 0.5) / rows
          if (!old) {
            const seed = tileSeed(tile)
            seeds[tile * 2] = seed.x; seeds[tile * 2 + 1] = seed.y
          }
          this.seed.x = seeds[tile * 2]; this.seed.y = seeds[tile * 2 + 1]
          if (!reused) {
            this.origin.x = field.flight.opening ? field.flight.anchor.x + (this.seed.x - .5) * (field.flight.apertureWidth ?? 36) : r.x + this.uv.x * r.width
            this.origin.y = field.flight.opening ? field.flight.anchor.y + 3 : r.y + this.uv.y * r.height
            this.speed.x = this.speed.y = 0
            let startAlpha = field.flight.opening ? 0 : 1
            if (old) {
              this.origin.x = old.from[tile * 2]; this.origin.y = old.from[tile * 2 + 1]
              this.speed.x = old.velocity[tile * 2]; this.speed.y = old.velocity[tile * 2 + 1]
              paneTilePose(old.flight, this.uv, this.seed, this.origin, this.speed, old.alpha[tile], this.pose)
              this.origin.x = this.pose.x; this.origin.y = this.pose.y
              this.speed.x = this.pose.vx; this.speed.y = this.pose.vy
              startAlpha = old.flight.opening && this.uv.y < old.nativeFront ? 1 : this.pose.alpha
            }
            from[tile * 2] = this.origin.x; from[tile * 2 + 1] = this.origin.y
            velocity[tile * 2] = this.speed.x; velocity[tile * 2 + 1] = this.speed.y
            alpha[tile] = startAlpha
          }
          const instance = offset + tile
          this.attributes.aTarget.setXY(instance, this.uv.x, this.uv.y)
          this.attributes.aSeed.setXY(instance, this.seed.x, this.seed.y)
          this.attributes.aFrom.setXY(instance, from[tile * 2], from[tile * 2 + 1])
          this.attributes.aVelocity.setXY(instance, velocity[tile * 2], velocity[tile * 2 + 1])
          this.attributes.aAlpha.setX(instance, alpha[tile])
          this.attributes.aField.setX(instance, slot)
        }
        next.set(field.key, {
          epoch: field.epoch, cols, rows, from, velocity, alpha, spareFrom, spareVelocity, spareAlpha, seeds,
          flight: this.snapshot(field), nativeFront: field.front,
          paintVersion: old?.paintVersion ?? -1, paint: old?.paint ?? field.paint,
          slot: old?.slot ?? -1,
        })
        offset += count
      })
      this.fields = next
      this.geometry.instanceCount = offset
      for (const attribute of Object.values(this.attributes)) attribute.needsUpdate = true
      this.geometryKey = key
      paneFlights.metrics.geometryUploads++
    }
    paneFlights.metrics.degradedTileSize = cell
    active.forEach((field, slot) => {
      const r = field.flight.rect, cached = this.fields.get(field.key)!
      if (cached.slot !== slot || cached.paintVersion !== field.paintVersion || cached.paint !== field.paint) {
        const sx = (slot % 2) * SLOT, sy = Math.floor(slot / 2) * SLOT
        ctx.clearRect(sx, sy, SLOT, SLOT)
        const scale = Math.min(1, SLOT / field.paint.width, SLOT / field.paint.height)
        const w = field.paint.width * scale, h = field.paint.height * scale
        ctx.drawImage(field.paint, sx, sy, w, h)
        ;(this.uniforms.uPaintRects.value as THREE.Vector4[])[slot].set(sx, sy, w, h)
        cached.slot = slot; cached.paintVersion = field.paintVersion; cached.paint = field.paint
        atlasDirty = true
      }
      ;(this.uniforms.uRects.value as THREE.Vector4[])[slot].set(r.x, r.y, r.width, r.height)
      ;(this.uniforms.uAnchors.value as THREE.Vector2[])[slot].set(field.flight.anchor.x, field.flight.anchor.y)
      ;(this.uniforms.uStates.value as THREE.Vector4[])[slot].set(field.flight.progress, Number(field.flight.opening), field.front, field.flight.duration)
      ;(this.uniforms.uCells.value as THREE.Vector2[])[slot].set(r.width / cached.cols, r.height / cached.rows)
      this.uniforms.uFresh.value[slot] = Number(field.flight.fresh !== false)
      const rgb = field.themed ? themeColor('080808', 'f3f5f7', light).match(/[\d.]+/g)!.map(Number) : [16, 19, 24]
      ;(this.uniforms.uFilm.value as THREE.Vector4[])[slot].set(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, field.pane ? 0.64 : 0.2)
      this.uniforms.uRadius.value[slot] = Math.min(field.radius, r.width / 2, r.height / 2)
      paneFlights.metrics.degradedTileSize = Math.max(paneFlights.metrics.degradedTileSize, r.width / cached.cols, r.height / cached.rows)
      cached.flight = this.snapshot(field); cached.nativeFront = field.front
    })
    if (atlasDirty) {
      this.texture.needsUpdate = true
      paneFlights.metrics.textureUploads++
    }
    paneFlights.metrics.tiles = this.geometry.instanceCount
    return this.geometry.instanceCount
  }
  sample(key: string, indices: number[]) {
    const field = this.fields.get(key)
    if (!field) return []
    return indices.slice(0, 256).filter(index => index >= 0 && index < field.alpha.length).map(index => {
      const uv = { x: ((index % field.cols) + .5) / field.cols, y: (Math.floor(index / field.cols) + .5) / field.rows }
      const seed = { x: field.seeds[index * 2], y: field.seeds[index * 2 + 1] }
      const from = { x: field.from[index * 2], y: field.from[index * 2 + 1] }
      const velocity = { x: field.velocity[index * 2], y: field.velocity[index * 2 + 1] }
      return { index, uv, seed, from, velocity, fromAlpha: field.alpha[index], native: uv.y < field.nativeFront,
        pose: paneTilePose(field.flight, uv, seed, from, velocity, field.alpha[index]) }
    })
  }
  prepare(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
    const preparation = this.compilation ?? gl.compileAsync(this.scene, camera).then(() => {})
    this.compilation = preparation
    return preparation
  }
  dispose() {
    const release = () => {
      this.geometry.dispose(); this.material.dispose(); this.texture.dispose(); this.fields.clear()
    }
    // Three polls program uniforms after asynchronous compilation. Keep owned
    // resources alive until that poll completes, even on immediate unmount.
    if (this.compilation) void this.compilation.then(release, release)
    else release()
  }
}
