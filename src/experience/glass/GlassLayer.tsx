import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { displayedThemeMix } from '../../core/theme'
import { GlassDomMirror } from './GlassDomMirror'

const CAPACITY = 16
const selectors =
  '[data-glass-lens],.utility-toggle,.intro-zoom>button,.intro-skip,.menu-actions>.ui-action,.auto-scroll-control,.world-controls button:not(.speed-endpoint)'

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
    geometry.setAttribute('aRect', rect)
    geometry.setAttribute('aShape', shape)
    geometry.instanceCount = 0
    const uniforms = {
      uLight: { value: 0 },
      uBase: { value: null as THREE.Texture | null },
      uSize: { value: new THREE.Vector2() },
      uPixelRatio: { value: 1 },
    }
    const material = new THREE.RawShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
      vertexShader: `precision highp float;attribute vec3 position;attribute vec4 aRect,aShape;uniform vec2 uSize;varying vec4 vRect,vShape;void main(){vRect=aRect;vShape=aShape;vec2 p=aRect.xy-vec2(2.)+(position.xy+.5)*(aRect.zw+vec2(4.));gl_Position=vec4(p/uSize*2.-1.,0.,1.);}`,
      fragmentShader: `precision highp float;uniform sampler2D uBase;uniform vec2 uSize;uniform float uPixelRatio,uLight;varying vec4 vRect,vShape;
      void main(){
        vec2 p=gl_FragCoord.xy/uPixelRatio;
        vec2 halfSize=vRect.zw*.5;
        vec2 local=p-vRect.xy-halfSize;
        float radius=vShape.x,bevel=vShape.y;
        vec2 q=abs(local)-halfSize+radius;
        float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
        float aa=1./uPixelRatio;
        if(distance>aa)discard;
        vec2 normal;
        if(q.x>0.&&q.y>0.)normal=normalize(max(q,0.))*sign(local);
        else normal=q.x>q.y?vec2(sign(local.x),0.):vec2(0.,sign(local.y));
        float rim=clamp(1.+distance/bevel,0.,1.);
        // A bounded smooth rim keeps the sampling Jacobian positive. The
        // former steep Snell edge could fold small text at the outer bevel.
        float shift=bevel*.16*rim*rim*(3.-2.*rim);
        // The center magnifies the actual clean backdrop about this pane;
        // rim displacement is continuous with that affine sample map.
        float magnification=vShape.z>.5?1.035:1.;
        vec2 center=vRect.xy+halfSize;
        vec2 uv=(center+local/magnification)/uSize;
        vec2 bend=normal*shift/uSize;
        float fringe=.6*rim*rim;
        vec2 rgbOffset=normal*fringe/uSize;
        vec3 color=vec3(texture2D(uBase,clamp(uv-bend-rgbOffset,0.,1.)).r,
          texture2D(uBase,clamp(uv-bend,0.,1.)).g,
          texture2D(uBase,clamp(uv-bend+rgbOffset,0.,1.)).b);
        bool panel=vShape.z>.5;
        // Neutral absorption preserves the source detail instead of lifting
        // light-mode image luma toward white. Panels own white text in both modes.
        vec3 film=panel?vec3(.018,.025,.035):mix(vec3(.025,.032,.044),vec3(.55,.59,.63),uLight);
        color=mix(color,film,panel?0.:vShape.z);
        // Pane absorption is applied once above both the GL and native DOM layers.
        float lighting=max(0.,dot(normal,normalize(vec2(-.5,1.))));
        float rimLight=pow(rim,3.)*(.006+.035*lighting);
        color+=vec3(rimLight);
        color+=pow(rim,2.)*.005;
        gl_FragColor=vec4(color,vShape.w*(1.-smoothstep(-aa,aa,distance)));
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
        mode: 'inactive',
      },
    }
  }, [])
  useEffect(() => {
    const update = () => {
      surface.current = Array.from(
        document.querySelectorAll<HTMLElement>(selectors),
      )
        .sort(
          (a, b) =>
            Number(a.dataset.paneOrder ?? 0) - Number(b.dataset.paneOrder ?? 0),
        )
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
    return () => {
      observer.disconnect()
      for (const element of surface.current) delete element.dataset.glassMode
      mirror.dispose()
      state.texture?.dispose()
      state.geometry.dispose()
      state.material.dispose()
      state.restoreMaterial.dispose()
      state.restoreGeometry.dispose()
      delete diagnostic.__glass
    }
  }, [state, mirror])
  const fallback = useMemo(
    () =>
      matchMedia(
        '(prefers-reduced-transparency: reduce), (forced-colors: active)',
      ),
    [],
  )
  useFrame(() => {
    state.uniforms.uLight.value = displayedThemeMix()
    const width = gl.domElement.clientWidth,
      height = gl.domElement.clientHeight
    let count = 0
    let windowSurface: HTMLElement | null = null
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
      const panel = element.dataset.glassLens === 'window'
      if (panel) windowSurface = element
      const computed = getComputedStyle(element)
      const radius = Math.min(
        r.width / 2,
        r.height / 2,
        parseFloat(computed.borderTopLeftRadius) || 0,
      )
      state.rect.setXYZW(count, r.left, height - r.bottom, r.width, r.height)
      state.shape.setXYZW(
        count,
        radius,
        panel ? 25 : 8,
        panel ? 0.68 : element.dataset.glassLens === 'runner' ? 0.45 : 0.2,
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
    if (!count) {
      mirror.clear()
      // Modal close can expose one frame before React removes reel inertness.
      // Retain the one bounded copy for this canvas lifetime to avoid allocating
      // again on every close. Resize and unmount still dispose it explicitly.
      return
    }
    const dpr = gl.getPixelRatio(),
      bw = gl.domElement.width,
      bh = gl.domElement.height
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
    state.uniforms.uPixelRatio.value = dpr
    state.geometry.instanceCount = count
    state.rect.needsUpdate = state.shape.needsUpdate = true
    const clear = gl.autoClear,
      target = gl.getRenderTarget()
    const viewport = gl.getViewport(state.viewport),
      scissor = gl.getScissor(state.scissor),
      scissorTest = gl.getScissorTest()
    try {
      gl.setRenderTarget(null)
      gl.setViewport(0, 0, width, height)
      gl.setScissorTest(false)
      gl.autoClear = false
      if (!fresh) gl.render(state.restoreScene, state.camera)
      gl.render(state.scene, state.camera)
      state.metrics.lensDraws++
    } finally {
      gl.setRenderTarget(target)
      gl.setViewport(viewport)
      gl.setScissor(scissor)
      gl.setScissorTest(scissorTest)
      gl.autoClear = clear
    }
    mirror.update(modal ?? windowSurface)
    state.metrics.mirrorMaps = mirror.maps
  }, 2)
  return null
}
