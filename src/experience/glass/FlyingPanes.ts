import * as THREE from 'three'
import { paneTilePoint, tileSeed } from '../../core/paneFlight'
import type { Point2, TileFlight } from '../../core/paneFlight'
import { paneFlights } from './PaneFlights'
import type { PaneFlightField } from './PaneFlights'
import { themeColor } from '../../core/theme'

const CAPACITY = 32768,
  SLOT = 1024,
  ATLAS = 2048
type GeometryField = {
  epoch: number
  cols: number
  rows: number
  from: Float32Array
  velocity: Float32Array
  flight: TileFlight
}
const shaderSmooth =
  'float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}'

// One instanced draw and one bounded own-content atlas in the existing renderer.
export class FlyingPanes {
  readonly scene = new THREE.Scene()
  readonly geometry = new THREE.InstancedBufferGeometry()
  readonly material: THREE.RawShaderMaterial
  private canvas = document.createElement('canvas')
  private texture: THREE.CanvasTexture
  private fields = new Map<string, GeometryField>()
  private atlasKey = ''
  private attributes: Record<string, THREE.InstancedBufferAttribute>
  private uniforms: Record<string, THREE.IUniform>
  constructor(shared: {
    uBase: THREE.IUniform
    uSize: THREE.IUniform
    uPixelRatio: THREE.IUniform
  }) {
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
      aTarget: new THREE.InstancedBufferAttribute(
        new Float32Array(CAPACITY * 2),
        2,
      ),
      aSeed: new THREE.InstancedBufferAttribute(
        new Float32Array(CAPACITY * 2),
        2,
      ),
      aFrom: new THREE.InstancedBufferAttribute(
        new Float32Array(CAPACITY * 2),
        2,
      ),
      aVelocity: new THREE.InstancedBufferAttribute(
        new Float32Array(CAPACITY * 2),
        2,
      ),
      aField: new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
    }
    for (const [name, attribute] of Object.entries(this.attributes))
      this.geometry.setAttribute(
        name,
        attribute.setUsage(THREE.DynamicDrawUsage),
      )
    this.geometry.instanceCount = 0
    this.uniforms = {
      ...shared,
      uPaint: { value: this.texture },
      uRects: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uAnchors: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uStates: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uCells: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uPaintRects: {
        value: Array.from({ length: 4 }, () => new THREE.Vector4()),
      },
      uFilm: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uRadius: { value: [0, 0, 0, 0] },
      uStartAlpha: { value: [0, 0, 0, 0] },
    }
    this.material = new THREE.RawShaderMaterial({
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `precision highp float;in vec3 position;in vec2 aTarget,aSeed,aFrom,aVelocity;in float aField;uniform vec2 uSize,uCells[4],uAnchors[4];uniform vec4 uRects[4],uStates[4];uniform float uStartAlpha[4];out vec2 vTarget;flat out float vField;out float vAlpha;${shaderSmooth}
      void main(){int i=int(aField);vec4 r=uRects[i],state=uStates[i];float t=state.x;bool opening=state.y>.5;vec2 target=r.xy+aTarget*r.zw;float fanWidth=min(r.z*1.32,uSize.x*.92);float fanCenter=clamp(uAnchors[i].x,fanWidth*.5+8.,uSize.x-fanWidth*.5-8.);vec2 fan=vec2(fanCenter+(aTarget.x-.5)*fanWidth*(1.-aTarget.y*.10)+(aSeed.x-.5)*18.,uAnchors[i].y+18.+(.08+aTarget.y*.92)*(1.-abs((aTarget.x-.5)*2.)*.85)*min(r.w*.42,205.)+(aSeed.y-.5)*28.);vec2 p;
      if(opening){float assemble=ease((t-(.22+aTarget.y*.43+aSeed.y*.08))/.20);p=mix(mix(aFrom,fan,ease(t/.28)),target,assemble);}else{float burst=ease(t/.36),retract=ease((t-.34)/.66);p=mix(mix(aFrom,fan,burst)+vec2((aSeed.x-.5)*r.z*.32,(aSeed.y-.5)*50.)*sin(3.14159265*t),uAnchors[i],retract);}
      p+=aVelocity*t*state.w*pow(1.-t,2.);float cell=opening?mix(.84,1.,ease((t-.38)/.56)):1.;p+=vec2(position.x,-position.y)*uCells[i]*cell;gl_Position=vec4(p.x/uSize.x*2.-1.,1.-p.y/uSize.y*2.,0.,1.);vTarget=aTarget+vec2(position.x,-position.y)*uCells[i]/r.zw;vField=aField;vAlpha=opening?mix(uStartAlpha[i],1.,ease(t/.05)):uStartAlpha[i]*(1.-ease((t-.9)/.1));if(opening&&aTarget.y<state.z)vAlpha=0.;}`,
      fragmentShader: `precision highp float;out vec4 outColor;uniform sampler2D uBase,uPaint;uniform vec2 uSize;uniform vec4 uRects[4],uPaintRects[4],uFilm[4];uniform float uRadius[4];in vec2 vTarget;flat in float vField;in float vAlpha;
      void main(){if(vAlpha<.001)discard;int i=int(vField);vec4 r=uRects[i],paintRect=uPaintRects[i];vec2 local=(vTarget-.5)*r.zw,q=abs(local)-r.zw*.5+uRadius[i];float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius[i];if(d>0.)discard;
      vec2 screen=r.xy+vTarget*r.zw;vec2 samplePoint=r.xy+r.zw*.5+local/1.095;vec3 backdrop=texture(uBase,vec2(samplePoint.x/uSize.x,1.-samplePoint.y/uSize.y)).rgb;
      vec3 glass=mix(backdrop,uFilm[i].rgb,uFilm[i].a);vec2 paintUv=(paintRect.xy+vTarget*paintRect.zw)/2048.;vec4 foreground=texture(uPaint,vec2(paintUv.x,1.-paintUv.y));vec3 color=mix(glass,foreground.rgb,foreground.a);outColor=vec4(color,vAlpha);}`,
    })
    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }
  private snapshot(field: PaneFlightField): TileFlight {
    return {
      ...field.flight,
      rect: { ...field.flight.rect },
      anchor: { ...field.flight.anchor },
    }
  }
  sync(light: number) {
    const active = [...paneFlights.fields.values()]
      .filter((f) => f.flight.progress < 1)
      .slice(-4)
    if (!active.length) {
      this.geometry.instanceCount = 0
      this.fields.clear()
      this.atlasKey = ''
      paneFlights.metrics.tiles = 0
      return 0
    }
    const area = active.reduce(
        (n, f) => n + f.flight.rect.width * f.flight.rect.height,
        0,
      ),
      cell = Math.max(4, Math.ceil(Math.sqrt(area / CAPACITY)))
    paneFlights.metrics.degradedTileSize = cell
    const key = active
      .map((f) => `${f.key}:${f.epoch}:${f.paintVersion}`)
      .join('|')
    if (key !== this.atlasKey) {
      const ctx = this.canvas.getContext('2d')!
      ctx.clearRect(0, 0, ATLAS, ATLAS)
      const next = new Map<string, GeometryField>()
      let offset = 0
      active.forEach((field, slot) => {
        const old = this.fields.get(field.key),
          r = field.flight.rect
        const reserved = active.slice(slot + 1).reduce((n, f) => {
          const kept = this.fields.get(f.key)
          return n + (kept ? kept.cols * kept.rows : 0)
        }, 0)
        const budget = Math.max(1, CAPACITY - offset - reserved)
        let step = cell
        if (!old)
          while (
            Math.ceil(r.width / step) * Math.ceil(r.height / step) >
            budget
          )
            step++
        const cols = old?.cols ?? Math.ceil(r.width / step),
          rows = old?.rows ?? Math.ceil(r.height / step)
        const count = cols * rows,
          from = new Float32Array(count * 2),
          velocity = new Float32Array(count * 2)
        if (offset + count > CAPACITY)
          throw new Error('Pane tile capacity invariant exceeded')
        paneFlights.metrics.degradedTileSize = Math.max(
          paneFlights.metrics.degradedTileSize,
          step,
        )
        for (let tile = 0; tile < count; tile++) {
          const uv = {
              x: ((tile % cols) + 0.5) / cols,
              y: (Math.floor(tile / cols) + 0.5) / rows,
            },
            seed = tileSeed(tile)
          let point: Point2 = field.flight.opening
              ? { ...field.flight.anchor }
              : { x: r.x + uv.x * r.width, y: r.y + uv.y * r.height },
            speed = { x: 0, y: 0 }
          if (
            old &&
            old.epoch === field.epoch &&
            tile * 2 + 1 < old.from.length
          ) {
            point = { x: old.from[tile * 2], y: old.from[tile * 2 + 1] }
            speed = { x: old.velocity[tile * 2], y: old.velocity[tile * 2 + 1] }
          } else if (old && tile * 2 + 1 < old.from.length) {
            const origin = { x: old.from[tile * 2], y: old.from[tile * 2 + 1] },
              v = { x: old.velocity[tile * 2], y: old.velocity[tile * 2 + 1] }
            point = paneTilePoint(old.flight, uv, seed, origin, v)
            const before = paneTilePoint(
                {
                  ...old.flight,
                  progress: Math.max(0, old.flight.progress - 0.001),
                },
                uv,
                seed,
                origin,
                v,
              ),
              after = paneTilePoint(
                {
                  ...old.flight,
                  progress: Math.min(1, old.flight.progress + 0.001),
                },
                uv,
                seed,
                origin,
                v,
              )
            speed = {
              x: Math.max(
                -4000,
                Math.min(
                  4000,
                  (after.x - before.x) / (0.002 * old.flight.duration),
                ),
              ),
              y: Math.max(
                -4000,
                Math.min(
                  4000,
                  (after.y - before.y) / (0.002 * old.flight.duration),
                ),
              ),
            }
          }
          from[tile * 2] = point.x
          from[tile * 2 + 1] = point.y
          velocity[tile * 2] = speed.x
          velocity[tile * 2 + 1] = speed.y
          this.attributes.aTarget.setXY(offset + tile, uv.x, uv.y)
          this.attributes.aSeed.setXY(offset + tile, seed.x, seed.y)
          this.attributes.aFrom.setXY(offset + tile, point.x, point.y)
          this.attributes.aVelocity.setXY(offset + tile, speed.x, speed.y)
          this.attributes.aField.setX(offset + tile, slot)
        }
        next.set(field.key, {
          epoch: field.epoch,
          cols,
          rows,
          from,
          velocity,
          flight: this.snapshot(field),
        })
        offset += count
        const sx = (slot % 2) * SLOT,
          sy = Math.floor(slot / 2) * SLOT
        const scale = Math.min(
            1,
            SLOT / field.paint.width,
            SLOT / field.paint.height,
          ),
          w = field.paint.width * scale,
          h = field.paint.height * scale
        ctx.drawImage(field.paint, sx, sy, w, h)
        ;(this.uniforms.uPaintRects.value as THREE.Vector4[])[slot].set(
          sx,
          sy,
          w,
          h,
        )
      })
      this.geometry.instanceCount = offset
      for (const attribute of Object.values(this.attributes))
        attribute.needsUpdate = true
      this.fields = next
      this.atlasKey = key
      this.texture.needsUpdate = true
      paneFlights.metrics.textureUploads++
    }
    active.forEach((field, slot) => {
      const r = field.flight.rect,
        cached = this.fields.get(field.key)!
      ;(this.uniforms.uRects.value as THREE.Vector4[])[slot].set(
        r.x,
        r.y,
        r.width,
        r.height,
      )
      ;(this.uniforms.uAnchors.value as THREE.Vector2[])[slot].set(
        field.flight.anchor.x,
        field.flight.anchor.y,
      )
      ;(this.uniforms.uStates.value as THREE.Vector4[])[slot].set(
        field.flight.progress,
        Number(field.flight.opening),
        field.front,
        field.flight.duration,
      )
      ;(this.uniforms.uCells.value as THREE.Vector2[])[slot].set(
        r.width / cached.cols,
        r.height / cached.rows,
      )
      const rgb = field.themed
        ? themeColor('080808', 'f3f5f7', light)
            .match(/[\d.]+/g)!
            .map(Number)
        : [16, 19, 24]
      ;(this.uniforms.uFilm.value as THREE.Vector4[])[slot].set(
        rgb[0] / 255,
        rgb[1] / 255,
        rgb[2] / 255,
        field.pane ? 0.64 : 0.2,
      )
      this.uniforms.uStartAlpha.value[slot] = field.fromAlpha
      this.uniforms.uRadius.value[slot] = Math.min(
        parseFloat(getComputedStyle(field.node).borderTopLeftRadius) || 0,
        r.width / 2,
        r.height / 2,
      )
      cached.flight = this.snapshot(field)
    })
    paneFlights.metrics.tiles = this.geometry.instanceCount
    return this.geometry.instanceCount
  }
  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.fields.clear()
  }
}
