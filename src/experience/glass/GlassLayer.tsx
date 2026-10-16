import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { displayedThemeMix } from '../../core/theme'
import { GlassDomMirror } from './GlassDomMirror'
import { glassOptics } from '../../core/glassOptics'
import { FlyingPanes } from './FlyingPanes'
import { paneFlights } from './PaneFlights'
import { bindDefaultFramebuffer } from '../defaultFramebuffer'
import { projectedActionBox } from '../../core/projectedElementBox'

const CAPACITY = 16
const selectors =
  '[data-glass-lens],.utility-toggle,.menu-actions>.ui-action,.auto-scroll-control,.world-controls button:not(.speed-endpoint)'

// An additive final-output adapter: one renderer, one shared GPU copy, one
// instanced lens draw. The protected world continues to own its final frame.
export function GlassLayer({
  world,
  baseFrame,
}: {
  world: boolean
  baseFrame: RefObject<number>
}) {
  const { gl } = useThree()
  const surface = useRef<HTMLElement[]>([])
  const mirror = useMemo(() => new GlassDomMirror(), [])
  const state = useMemo(() => {
    const geometry = new THREE.InstancedBufferGeometry()
    const plane = new THREE.PlaneGeometry(1, 1)
    geometry.index = plane.index
    geometry.attributes.position = plane.attributes.position
    geometry.attributes.uv = plane.attributes.uv
    const rect = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 4),
      4,
    ).setUsage(THREE.DynamicDrawUsage)
    const shape = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 4),
      4,
    ).setUsage(THREE.DynamicDrawUsage)
    const optics = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 4),
      4,
    ).setUsage(THREE.DynamicDrawUsage)
    const front = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 2),
      2,
    ).setUsage(THREE.DynamicDrawUsage)
    const parentOptics = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 4),
      4,
    ).setUsage(THREE.DynamicDrawUsage)
    const localSize = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 2), 2,
    ).setUsage(THREE.DynamicDrawUsage)
    const boxInverse = [0, 1, 2].map(() => new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY * 3), 3,
    ).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aLocalSize', localSize)
    boxInverse.forEach((attribute, index) => geometry.setAttribute(`aBoxInverse${index}`, attribute))
    geometry.setAttribute('aParent', parentOptics)
    geometry.setAttribute('aFront', front)
    geometry.setAttribute('aOptics', optics)
    geometry.setAttribute('aRect', rect)
    geometry.setAttribute('aShape', shape)
    geometry.instanceCount = 0
    const uniforms = {
      uLight: { value: 0 },
      uBase: { value: null as THREE.Texture | null },
      uSize: { value: new THREE.Vector2() },
      uPixelRatio: { value: new THREE.Vector2(1, 1) },
    }
    const material = new THREE.RawShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
      vertexShader: `precision highp float;attribute vec3 position,aBoxInverse0,aBoxInverse1,aBoxInverse2;attribute vec4 aRect,aShape,aOptics,aParent;attribute vec2 aFront,aLocalSize;uniform vec2 uSize;varying vec4 vRect,vShape,vOptics,vParent;varying vec2 vFront,vLocalSize;varying mat3 vBoxInverse;void main(){vRect=aRect;vShape=aShape;vOptics=aOptics;vParent=aParent;vFront=aFront;vLocalSize=aLocalSize;vBoxInverse=mat3(aBoxInverse0,aBoxInverse1,aBoxInverse2);vec2 p=aRect.xy-vec2(2.)+(position.xy+.5)*(aRect.zw+vec2(4.));gl_Position=vec4(p/uSize*2.-1.,0.,1.);}`,
      fragmentShader: `precision highp float;uniform sampler2D uBase;uniform vec2 uSize,uPixelRatio;uniform float uLight;varying vec4 vRect,vShape,vOptics,vParent;varying vec2 vFront,vLocalSize;varying mat3 vBoxInverse;
      void main(){
        vec2 p=gl_FragCoord.xy/uPixelRatio;
        float arrival=p.y-(vRect.y+vRect.w-vFront.x);
        if(arrival<0.)discard;
        float ownership=vFront.y>.001?smoothstep(0.,vFront.y,arrival):1.;
        vec2 halfSize=vRect.zw*.5;
        vec2 local=p-vRect.xy-halfSize;
        vec2 backdropLocal=local;
        if(vLocalSize.x>0.){
          vec3 mapped=vBoxInverse*vec3(p.x,uSize.y-p.y,1.);
          halfSize=vLocalSize*.5;
          local=vec2(mapped.x/mapped.z,vLocalSize.y-mapped.y/mapped.z)-halfSize;
        }
        float radius=vShape.x,bevel=vShape.y;
        vec2 q=abs(local)-halfSize+radius;
        float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
        float aa=1./min(uPixelRatio.x,uPixelRatio.y);
        if(distance>aa)discard;
        vec2 normal;
        if(q.x>0.&&q.y>0.)normal=normalize(max(q,0.))*sign(local);
        else normal=q.x>q.y?vec2(sign(local.x),0.):vec2(0.,sign(local.y));
        float rim=clamp(1.+distance/bevel,0.,1.);
        // A bounded smooth rim keeps the sampling Jacobian positive. The
        // former steep Snell edge could fold small text at the outer bevel.
        float shift=bevel*vOptics.y*rim*rim*(3.-2.*rim);
        // The center magnifies the actual clean backdrop about this pane;
        // rim displacement is continuous with that affine sample map.
        float magnification=vOptics.x;
        vec2 center=vRect.xy+vRect.zw*.5;
        vec2 samplePoint=center+backdropLocal/magnification;
        if(vParent.w>.5)samplePoint=vParent.xy+(samplePoint-vParent.xy)/vParent.z;
        vec2 uv=samplePoint/uSize;
        vec2 bend=normal*shift/uSize;
        float fringe=vOptics.z*rim*rim;
        vec2 rgbOffset=normal*fringe/uSize;
        vec3 color=vec3(texture2D(uBase,clamp(uv-bend-rgbOffset,0.,1.)).r,
          texture2D(uBase,clamp(uv-bend,0.,1.)).g,
          texture2D(uBase,clamp(uv-bend+rgbOffset,0.,1.)).b);
        vec2 rough=vec2(vOptics.w)/uSize;
        vec3 softened=(texture2D(uBase,clamp(uv-bend+vec2(rough.x,0.),0.,1.)).rgb+texture2D(uBase,clamp(uv-bend-vec2(rough.x,0.),0.,1.)).rgb+texture2D(uBase,clamp(uv-bend+vec2(0.,rough.y),0.,1.)).rgb+texture2D(uBase,clamp(uv-bend-vec2(0.,rough.y),0.,1.)).rgb)*.25;
        color=mix(color,softened,.24);
        bool panel=vShape.z>.5;
        // Neutral absorption preserves the source detail instead of lifting
        // light-mode image luma toward white. Panels own white text in both modes.
        vec3 film=panel?vec3(.018,.025,.035):mix(vec3(.025,.032,.044),vec3(.55,.59,.63),uLight);
        color=mix(color,film,panel?0.:vShape.z);
        // Pane absorption is applied once above both the GL and native DOM layers.
        float lighting=max(0.,dot(normal,normalize(vec2(-.5,1.))));
        float rimLight=pow(rim,3.)*(.012+.07*lighting);
        color+=vec3(rimLight);
        color+=pow(rim,2.)*.005;
        gl_FragColor=vec4(color,vShape.w*(1.-smoothstep(-aa,aa,distance))*ownership);
      }`,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(mesh)
    const restoreMaterial = new THREE.RawShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader:
        'precision highp float;attribute vec3 position;varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:
        'precision highp float;uniform sampler2D uBase;varying vec2 vUv;void main(){gl_FragColor=texture2D(uBase,vUv);}',
    })
    const restoreGeometry = new THREE.PlaneGeometry(2, 2)
    const restoreScene = new THREE.Scene()
    restoreScene.add(new THREE.Mesh(restoreGeometry, restoreMaterial))
    return {
      geometry,
      rect,
      shape,
      optics,
      front,
      parentOptics,
      localSize,
      boxInverse,
      projectionInverse: new THREE.Matrix3(),
      flying: new FlyingPanes(uniforms),
      material,
      scene,
      restoreScene,
      restoreGeometry,
      restoreMaterial,
      uniforms,
      camera: new THREE.Camera(),
      viewport: new THREE.Vector4(),
      scissor: new THREE.Vector4(),
      texture: null as THREE.FramebufferTexture | null,
      lastFrame: -1,
      metrics: {
        captures: 0,
        allocations: 0,
        activeLenses: 0,
        textureBytes: 0,
        lensDraws: 0,
        mirrorMaps: 0,
        mirrorMapCache: 0,
        mirrorContentBuilds: 0,
        mirrorFrameMs: 0,
        mirrorMaxMs: 0,
        mirrorTotalMs: 0,
        flightTextureBytes: 2048 * 2048 * 4,
        flightCapacity: 32768,
        lensTextureReads: 7,
        mode: 'inactive',
      },
    }
  }, [])
  useEffect(() => {
    const update = () => {
      surface.current = Array.from(
        document.querySelectorAll<HTMLElement>(selectors),
      )
        .sort((a, b) => {
          const order = (element: HTMLElement) =>
            Number(
              element.closest<HTMLElement>('[data-pane-order]')?.dataset
                .paneOrder ?? 0,
            )
          return (
            order(a) - order(b) || (a.contains(b) ? -1 : b.contains(a) ? 1 : 0)
          )
        })
        .slice(0, 40)
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'open',
        'class',
        'hidden',
        'data-surface',
        'data-pane-order',
      ],
    })
    update()
    const diagnostic = window as unknown as { __glass?: typeof state.metrics }
    diagnostic.__glass = state.metrics
    ;(
      window as unknown as { __paneFlights: typeof paneFlights.metrics }
    ).__paneFlights = paneFlights.metrics
    const flightDiagnostic = window as unknown as {
      __paneFlightState?: () => unknown
      __paneFlightTiles?: (key: string, indices: number[]) => unknown
    }
    flightDiagnostic.__paneFlightState = () =>
      [...paneFlights.fields.values()].map((f) => ({
        key: f.key,
        epoch: f.epoch,
        phase: f.flight.opening ? 'opening' : 'closing',
        progress: f.flight.progress,
        front: f.front,
        rect: { ...f.flight.rect },
        anchor: { ...f.flight.anchor },
        paintVersion: f.paintVersion,
        duration: f.flight.duration,
        elapsed: f.elapsed,
        fresh: f.flight.fresh,
        apertureWidth: f.flight.apertureWidth,
        connected: f.node.isConnected,
      }))
    flightDiagnostic.__paneFlightTiles = (key, indices) => state.flying.sample(key, indices)
    void state.flying.prepare(gl, state.camera).catch(error => {
      console.warn('Pane shader prewarm failed; normal rendering will report its actual status', error)
    })
    paneFlights.available = true
    const hide = () => {
      if (document.hidden) paneFlights.finish()
    }
    const pagehide = () => paneFlights.finish()
    const clicked = (event: MouseEvent) => paneFlights.captureOrigin(event)
    const contextLost = () => {
      // Native fallback can appear before R3F finishes asynchronous unmount.
      // Release its masks/input ownership at the actual loss boundary.
      if (diagnostic.__glass === state.metrics) {
        paneFlights.available = false
        paneFlights.finish()
      }
      mirror.clear()
      for (const element of surface.current) delete element.dataset.glassMode
    }
    document.addEventListener('visibilitychange', hide)
    document.addEventListener('click', clicked, true)
    window.addEventListener('pagehide', pagehide)
    gl.domElement.addEventListener('webglcontextlost', contextLost)
    return () => {
      observer.disconnect()
      for (const element of surface.current) delete element.dataset.glassMode
      mirror.dispose()
      const ownsRegistry = diagnostic.__glass === state.metrics
      if (ownsRegistry) {
        delete flightDiagnostic.__paneFlightState
        delete flightDiagnostic.__paneFlightTiles
        paneFlights.available = false
        paneFlights.finish()
        delete (window as unknown as { __paneFlights?: unknown }).__paneFlights
        delete diagnostic.__glass
      }
      state.flying.dispose()
      document.removeEventListener('visibilitychange', hide)
      document.removeEventListener('click', clicked, true)
      window.removeEventListener('pagehide', pagehide)
      gl.domElement.removeEventListener('webglcontextlost', contextLost)
      state.texture?.dispose()
      state.geometry.dispose()
      state.material.dispose()
      state.restoreMaterial.dispose()
      state.restoreGeometry.dispose()
    }
  }, [state, mirror])
  const fallback = useMemo(
    () =>
      matchMedia(
        '(prefers-reduced-transparency: reduce), (forced-colors: active)',
      ),
    [],
  )
  useFrame((_, dt) => {
    const opticsEnabled =
      (window as unknown as { __glassOpticsEnabled?: boolean })
        .__glassOpticsEnabled !== false
    paneFlights.step(dt)
    const flyingCount = state.flying.sync(displayedThemeMix())
    state.uniforms.uLight.value = displayedThemeMix()
    const width = gl.domElement.clientWidth,
      height = gl.domElement.clientHeight
    let count = 0
    const windowSurfaces: HTMLElement[] = []
    const modal = document.querySelector<HTMLDialogElement>('dialog:modal')
    for (const element of surface.current) {
      if (
        !element.isConnected ||
        !element.getClientRects().length ||
        element.closest('[hidden],[inert]') ||
        (modal && !modal.contains(element))
      )
        continue
      if (element instanceof HTMLDialogElement && !element.open) continue
      const utility = element.closest<HTMLElement>(
        '.hub-utilities[data-glass-lens]',
      )
      if (utility) {
        const popup = getComputedStyle(utility).flexDirection === 'column'
        if ((element === utility && !popup) || (element !== utility && popup))
          continue
      }
      const r = element.getBoundingClientRect()
      if (
        r.width < 1 ||
        r.height < 1 ||
        r.bottom < 0 ||
        r.top > height ||
        r.right < 0 ||
        r.left > width ||
        count === CAPACITY
      )
        continue
      if (fallback.matches) {
        element.dataset.glassMode = 'solid'
        continue
      }
      element.dataset.glassMode = 'gpu'
      const flight = paneFlights.fieldFor(element)
      const front =
        flight && flight.flight.opening
          ? Math.max(
              0,
              Math.min(
                r.height,
                flight.flight.rect.y +
                  flight.front * flight.flight.rect.height -
                  r.top,
              ),
            )
          : r.height
      if (front <= 0) continue
      const panel = element.dataset.glassLens === 'window'
      if (panel) windowSurfaces.push(element)
      const computed = getComputedStyle(element)
      const projected = projectedActionBox(element, computed, r)
      state.localSize.setXY(count, projected?.width ?? 0, projected?.height ?? 0)
      if (projected) state.projectionInverse.set(...projected.matrix).invert()
      else state.projectionInverse.identity()
      const inverse = state.projectionInverse.elements
      for (let column = 0; column < 3; column++)
        state.boxInverse[column].setXYZ(
          count, inverse[column * 3], inverse[column * 3 + 1], inverse[column * 3 + 2],
        )
      const radius = Math.min(
        (projected?.width ?? r.width) / 2,
        (projected?.height ?? r.height) / 2,
        parseFloat(computed.borderTopLeftRadius) || 0,
      )
      state.rect.setXYZW(count, r.left, height - r.bottom, r.width, r.height)
      const parent = panel
        ? null
        : element.closest<HTMLElement>('.glass-window[data-glass-mode="gpu"]')
      const profile = glassOptics(
        r.width,
        r.height,
        radius,
        panel,
        Boolean(parent),
      )
      if (parent) {
        const pr = parent.getBoundingClientRect(),
          profile = glassOptics(
            pr.width,
            pr.height,
            parseFloat(getComputedStyle(parent).borderTopLeftRadius) || 0,
            true,
          )
        state.parentOptics.setXYZW(
          count,
          pr.left + pr.width / 2,
          height - pr.top - pr.height / 2,
          profile.magnification,
          1,
        )
      } else state.parentOptics.setXYZW(count, 0, 0, 1, 0)
      state.front.setXY(count, front, flight && flight.flight.opening && flight.flight.progress < 1 ? Math.min(10, (1 - flight.front) * flight.flight.rect.height) : 0)
      state.optics.setXYZW(
        count,
        profile.magnification,
        profile.bend,
        profile.fringe,
        profile.roughness,
      )
      state.shape.setXYZW(
        count,
        radius,
        profile.bevel,
        panel
          ? 0.68
          : parent
            ? 0
            : element.dataset.glassLens === 'runner'
              ? 0.45
              : 0.2,
        Number(computed.opacity),
      )
      count++
    }
    state.metrics.activeLenses = count
    state.metrics.mode = fallback.matches
      ? 'solid'
      : count
        ? 'gpu-final-output'
        : 'inactive'
    if (!count && !flyingCount) {
      mirror.clear()
      // Modal close can expose one frame before React removes reel inertness.
      // Retain the one bounded copy for this canvas lifetime to avoid allocating
      // again on every close. Resize and unmount still dispose it explicitly.
      return
    }
    const context = gl.getContext(),
      bw = context.drawingBufferWidth,
      bh = context.drawingBufferHeight
    if (!bw || !bh || !width || !height) return
    if (
      !state.texture ||
      state.texture.image.width !== bw ||
      state.texture.image.height !== bh
    ) {
      state.texture?.dispose()
      state.texture = new THREE.FramebufferTexture(bw, bh)
      state.texture.name = 'glass-shared-final-output-GPU-copy'
      state.texture.colorSpace = THREE.NoColorSpace
      state.texture.minFilter = state.texture.magFilter = THREE.LinearFilter
      state.uniforms.uBase.value = state.texture
      state.lastFrame = -1
      state.metrics.allocations++
      state.metrics.textureBytes = bw * bh * 4
    }
    // A paused hub restores its last settled base before painting moving lenses.
    // It does not simulate the scene or recapture a lens into itself.
    const fresh = world || state.lastFrame !== baseFrame.current
    if (fresh) {
      gl.copyFramebufferToTexture(state.texture)
      state.metrics.captures++
      state.lastFrame = baseFrame.current
    }
    state.uniforms.uSize.value.set(width, height)
    state.uniforms.uPixelRatio.value.set(bw / width, bh / height)
    state.geometry.instanceCount = count
    state.localSize.needsUpdate = true
    for (const attribute of state.boxInverse) attribute.needsUpdate = true
    state.rect.needsUpdate =
      state.shape.needsUpdate =
      state.optics.needsUpdate =
      state.front.needsUpdate =
      state.parentOptics.needsUpdate =
        true
    const clear = gl.autoClear,
      target = gl.getRenderTarget()
    const viewport = gl.getViewport(state.viewport),
      scissor = gl.getScissor(state.scissor),
      scissorTest = gl.getScissorTest()
    try {
      bindDefaultFramebuffer(gl)
      gl.setScissorTest(false)
      gl.autoClear = false
      if (!fresh) gl.render(state.restoreScene, state.camera)
      if (count && opticsEnabled) gl.render(state.scene, state.camera)
      if (flyingCount) {
        gl.render(state.flying.scene, state.camera)
        paneFlights.metrics.draws++
      }
      state.metrics.lensDraws++
    } finally {
      gl.setRenderTarget(target)
      gl.setViewport(viewport)
      gl.setScissor(scissor)
      gl.setScissorTest(scissorTest)
      gl.autoClear = clear
    }
    const mirrorAt = performance.now()
    mirror.update(opticsEnabled ? (modal ? [modal] : windowSurfaces) : [])
    state.metrics.mirrorFrameMs = performance.now() - mirrorAt
    state.metrics.mirrorTotalMs += state.metrics.mirrorFrameMs
    state.metrics.mirrorMaxMs = Math.max(
      state.metrics.mirrorMaxMs,
      state.metrics.mirrorFrameMs,
    )
    state.metrics.mirrorMaps = mirror.maps
    state.metrics.mirrorMapCache = mirror.metrics.mapCache
    state.metrics.mirrorContentBuilds = mirror.metrics.contentBuilds
  }, 2)
  return null
}
