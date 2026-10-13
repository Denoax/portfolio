import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityProfile } from '../../core/quality'
import type { ExperiencePreferences } from '../../core/experienceSettings'
import { menuViews } from '../../core/menuReel'
import type { MenuPresentation } from '../../core/menuReel'
import { panelTransform } from '../../core/projectedPanel'
import { counterReelPose, pairedReelLayout } from '../../core/pairedReel'
import { HoverPerimeter, perimeterGLSL } from './HoverPerimeter'
import { Ringwriter } from './Ringwriter'
import { displayedThemeMix } from '../../core/theme'
import { CriticalDamper } from '../../core/criticalDamper'
import { GlassField } from './GlassField'
import type { PreviewPlayback } from '../../core/previewPlayback'
import { CursorTrail, trailOutputGLSL } from '../cursor/CursorTrail'

function mediaGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 40, 20)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    positions.setZ(i, -0.16 * x * x)
  }
  geometry.computeVertexNormals()
  return geometry
}
export function HubScene({
  baseFrame,
  quality,
  preferences,
  presentation,
  onReady,
  onFailure,
  previews,
}: {
  baseFrame: RefObject<number>
  quality: QualityProfile
  preferences: RefObject<ExperiencePreferences>
  presentation: RefObject<MenuPresentation>
  onReady: () => void
  onFailure: () => void
  previews: PreviewPlayback
}) {
  const textProjection = useMemo(() => new THREE.Object3D(), [])
  const textCorners = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    [],
  )
  const textPoints = useMemo(
    () => [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    [],
  )
  const { gl, size, scene, camera } = useThree()
  const groups = useRef<(THREE.Group | null)[]>([])
  const loaded = useRef(false)
  const reported = useRef(false)
  const paintedSize = useRef('')
  const needsRepaint = useRef(false)
  const media = useRef(new Map<string, THREE.Texture>())
  const previewTexture = useRef<{
    video: HTMLVideoElement
    texture: THREE.VideoTexture
  } | null>(null)
  const requests = useRef(new Map<string, Promise<void>>())
  const failedPosters = useRef(new Set<string>())
  const loadPoster = useRef<(path: string) => Promise<void>>(() =>
    Promise.resolve(),
  )
  const lastThemeMix = useRef(displayedThemeMix())
  const mixedColor = useRef(new THREE.Color())
  const darkBase = useMemo(() => new THREE.Color('#080808'), [])
  const darkField = useMemo(() => new THREE.Color('#101318'), [])
  const lightField = useMemo(() => new THREE.Color('#eceff2'), [])
  const background = useRef(new THREE.Color(menuViews[0].background))
  const darkBackground = useRef(new THREE.Color(menuViews[0].background))
  const lightBackground = useRef(new THREE.Color('#f3f5f7'))
  const palette = useMemo(
    () => menuViews.map((view) => new THREE.Color(view.background)),
    [],
  )
  const lightPalette = useMemo(
    () =>
      menuViews.map((view) =>
        new THREE.Color('#f3f5f7').lerp(new THREE.Color(view.accent), 0.045),
      ),
    [],
  )
  const lightBase = useMemo(() => new THREE.Color('#f3f5f7'), [])
  const darkInk = useMemo(() => new THREE.Color('#f4f4f2'), [])
  const lightInk = useMemo(() => new THREE.Color('#161a20'), [])
  const accentPalette = useMemo(
    () => menuViews.map((view) => new THREE.Color(view.accent)),
    [],
  )
  const pointer = useRef(new THREE.Vector2())
  const damper = useRef(new CriticalDamper(presentation.current.rendered))
  const hoverDamper = useRef(new CriticalDamper(1))
  const theme = useRef(new THREE.Color(menuViews[0].accent))
  const activeClock = useRef(false)
  const resources = useMemo(() => {
    const geometry = mediaGeometry()
    const materials = menuViews.map(
      () =>
        new THREE.ShaderMaterial({
          transparent: true,
          uniforms: {
            uCustom: { value: false },
            uCustomColor: { value: new THREE.Color() },
            uImage: { value: null },
            uAspect: { value: 1 },
            uSize: { value: new THREE.Vector2(1, 1) },
            uOpacity: { value: 1 },
            uBrightness: { value: 1 },
            uVideo: { value: false },
            uCss: { value: new THREE.Vector2(1, 1) },
            uViewport: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uDistance: { value: 0 },
            uHeader: { value: new THREE.Vector2() },
          },
          vertexShader:
            'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader: `varying vec2 vUv;uniform sampler2D uImage;uniform float uAspect,uOpacity,uBrightness,uTime,uDistance;uniform vec2 uSize,uCss,uViewport,uHeader;uniform bool uVideo,uCustom;uniform vec3 uCustomColor;
        void main(){vec2 p=(vUv-.5)*uSize;vec2 q=abs(p)-(uSize*.5-vec2(.05));float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.05;float alpha=1.-smoothstep(-fwidth(d),fwidth(d),d);if(alpha<.01)discard;
        // Contain preserves every command line and the actual source aspect.
        vec2 uv=vUv;float aspect=uSize.x/uSize.y;if(aspect>uAspect)uv.x=(uv.x-.5)*aspect/uAspect+.5;else uv.y=(uv.y-.5)*uAspect/aspect+.5;
        vec2 centered=uv-.5;uv+=centered*dot(centered,centered)*.004;
        bool matte=any(lessThan(uv,vec2(0.))) || any(greaterThan(uv,vec2(1.)));
        vec3 sampled=uCustom?uCustomColor:matte?vec3(.006,.008,.012):texture2D(uImage,uv).rgb;
        if(uVideo&&!matte&&!uCustom)sampled=mix(pow(sampled*.9478672986+.0521327014,vec3(2.4)),sampled*.0773993808,lessThanEqual(sampled,vec3(.04045)));
        float scan=.985+.015*cos(vUv.y*uCss.y*3.14159265);
        float vignette=1.-.04*pow(length((vUv-.5)*1.4142),3.);
        float grain=(fract(sin(dot(floor(vUv*uCss),vec2(12.9898,78.233))+floor(uTime*12.))*43758.5453)-.5)*.002;
        float composition=mix(1.,smoothstep(uHeader.x,uHeader.y,1.-gl_FragCoord.y/uViewport.y),smoothstep(.08,.25,uDistance));if(uViewport.x<720.)composition*=1.-smoothstep(.40,.425,1.-gl_FragCoord.y/uViewport.y);
        gl_FragColor=vec4(max(vec3(0.),uCustom?sampled:sampled*scan*vignette+grain)*uBrightness,alpha*uOpacity*composition);
        #include <colorspace_fragment>
        }`,
          toneMapped: false,
        }),
    )
    const trail = new CursorTrail(gl)
    const perimeter = new HoverPerimeter()
    const overlay = new THREE.Scene(),
      ortho = new THREE.Camera(),
      plane = new THREE.PlaneGeometry(2, 2)
    const trailMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.NormalBlending,
      toneMapped: true,
      uniforms: {
        uIntroTrail: { value: 0 },
        uSelectionLight: { value: 1 },
        uSmokeColor: { value: new THREE.Color(menuViews[0].accent) },
        ...perimeter.uniforms,
        ...trail.outputUniforms,
        uTrail: { value: trail.texture },
      },
      vertexShader:
        'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uIntroTrail,uSelectionLight;uniform vec3 uSmokeColor;${trailOutputGLSL}${perimeterGLSL}
      // Linear-light pigment cap preserves hue; q=0 keeps the existing dark output.
      vec3 selectionInk(vec3 color){
        float luminance=dot(color,vec3(.2126,.7152,.0722));
        vec3 ink=max(vec3(0.),mix(vec3(luminance),color,1.28));
        ink*=min(1.,.22/max(.001,dot(ink,vec3(.2126,.7152,.0722))));
        return mix(color,ink,uSelectionLight);
      }
      void main(){
      if(uIntroTrail>.5){gl_FragColor=vec4(trailOutput(vUv),1.);
      #include <tonemapping_fragment>
      }else{
      vec3 smoke=trailOutput(vUv);float energy=max(smoke.r,max(smoke.g,smoke.b));
      float coverage=1.-exp(-energy*1.1*mix(1.,1.4,uSelectionLight)),edge=boxSmoke(vUv);
      edge=1.-pow(max(0.,1.-edge),mix(1.,1.4,uSelectionLight));
      vec3 pigment=energy>.0001?smoke/energy*max(uHeadColor.r,max(uHeadColor.g,uHeadColor.b)):uHeadColor;
      gl_FragColor=vec4(mix(selectionInk(pigment),selectionInk(uSmokeColor),edge/max(.001,coverage+edge)),max(coverage,edge));}
      #include <colorspace_fragment>
      }`,
    })
    overlay.add(new THREE.Mesh(plane, trailMaterial))
    const ringwriter = new Ringwriter()
    const glass = new GlassField()
    return {
      geometry,
      materials,
      trail,
      perimeter,
      overlay,
      ortho,
      plane,
      trailMaterial,
      ringwriter,
      glass,
    }
  }, [gl])
  useEffect(() => {
    let alive = true
    loaded.current = false
    reported.current = false
    const textures = new Map<string, THREE.Texture>()
    media.current = textures
    let preparation: Promise<unknown> | null = null
    const disconnect = resources.trail.connect()
    const disconnectPerimeter = resources.perimeter.connect()
    const diagnostics = window as unknown as {
      __hoverSmoke?: typeof resources.perimeter.evidence
    }
    diagnostics.__hoverSmoke = resources.perimeter.evidence
    const disconnectIntro = resources.ringwriter.connect(
      () => presentation.current.intro,
    )
    const loader = new THREE.TextureLoader()
    requests.current.clear()
    failedPosters.current.clear()
    loadPoster.current = (path) => {
      if (textures.has(path) || failedPosters.current.has(path))
        return Promise.resolve()
      const existing = requests.current.get(path)
      if (existing) return existing
      const request = loader
        .loadAsync(path)
        .then((texture) => {
          if (!alive) {
            texture.dispose()
            return
          }
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
          gl.initTexture(texture)
          textures.set(path, texture)
          needsRepaint.current = true
        })
        .catch((error: unknown) => {
          failedPosters.current.add(path)
          console.warn(`Project poster unavailable: ${path}`, error)
          throw error
        })
        .finally(() => requests.current.delete(path))
      requests.current.set(path, request)
      return request
    }
    const timeout = setTimeout(() => {
      if (alive && !loaded.current) onFailure()
    }, 12000)
    const initial = Math.round(
      presentation.current.target * (menuViews.length - 1),
    )
    const neighbors = menuViews.filter(
      (_, index) => Math.abs(initial - index) <= 1,
    )
    Promise.all([
      ...neighbors.flatMap((view) => [
        loadPoster.current(view.image),
        loadPoster.current(view.portrait),
      ]),
      resources.ringwriter.prepare(),
    ])
      .then(async () => {
        if (!alive) return
        gl.initTexture(resources.ringwriter.texture)
        // Compile only resources owned by this menu. Shared scene traversal
        // can capture retiring world materials in Three's asynchronous poll.
        const compileScene = new THREE.Scene()
        resources.materials.forEach((material) =>
          compileScene.add(new THREE.Mesh(resources.geometry, material)),
        )
        compileScene.add(
          resources.ringwriter.mesh.clone(),
          resources.glass.mesh.clone(),
        )
        preparation = Promise.all([
          gl.compileAsync(compileScene, camera),
          resources.trail.prepare(),
        ])
        await preparation
        if (alive) {
          loaded.current = true
          clearTimeout(timeout)
        }
      })
      .catch(() => {
        if (alive) onFailure()
      })
    return () => {
      alive = false
      clearTimeout(timeout)
      disconnect()
      disconnectPerimeter()
      delete diagnostics.__hoverSmoke
      disconnectIntro()
      loaded.current = false
      const dispose = () => {
        textures.forEach((texture) => texture.dispose())
        textures.clear()
        previewTexture.current?.texture.dispose()
        previewTexture.current = null
        resources.ringwriter.dispose()
        resources.glass.dispose()
        resources.geometry.dispose()
        resources.materials.forEach((material) => material.dispose())
        resources.trail.dispose()
        resources.plane.dispose()
        resources.trailMaterial.dispose()
      }
      // Three r180 polls program readiness after compileAsync returns. Keep
      // materials alive until that poll finishes, even after a rapid handoff.
      if (preparation) void preparation.then(dispose, dispose)
      else dispose()
    }
    // Load each owned source once. Resize switches fitted media without
    // replacing resources, restarting readiness or resetting native progress.
  }, [resources, gl, scene, camera, onReady, onFailure])
  useFrame((state, dt) => {
    const menu = presentation.current
    const clockRunning = !document.hidden && menu.decorativeRunning
    const delta = activeClock.current && clockRunning ? Math.min(dt, 0.05) : 0
    activeClock.current = clockRunning
    if (clockRunning) menu.clock += delta
    if (!menu.paused && !document.hidden) {
      menu.rendered = menu.reduced
        ? menu.target
        : damper.current.step(menu.target, 0.3, delta)
      pointer.current.lerp(state.pointer, 1 - Math.exp(-6 * delta))
    }
    const enlargement = hoverDamper.current.step(
      menu.hovered ? 1.06 : 1,
      0.2,
      delta,
    )
    const short = size.height < 600
    const portrait = size.width < 720,
      height = 2.25,
      width = (height * size.width) / size.height
    camera.position.set(
      portrait ? 0 : pointer.current.x * 0.018,
      portrait ? 0 : pointer.current.y * 0.012,
      height / (2 * Math.tan((43 * Math.PI) / 360)),
    )
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
    const perspective = camera as THREE.PerspectiveCamera
    perspective.fov = 43
    perspective.updateProjectionMatrix()
    camera.updateMatrixWorld()
    resources.ringwriter.material.uniforms.uInk.value
      .copy(darkInk)
      .lerp(
        lightInk,
        Math.min(1, Math.max(0, (displayedThemeMix() - 0.08) / 0.3)),
      )
    resources.ringwriter.update(
      dt,
      size.width,
      size.height,
      (Math.min(width, height) * (camera.position.z - 0.12)) /
        camera.position.z,
      menu.intro,
      loaded.current,
    )
    const reveal = menu.intro.active ? menu.intro.exitProgress : 1
    const selected = Math.round(menu.rendered * (menuViews.length - 1))
    const video = previews.video
    if (previewTexture.current?.video !== video) {
      previewTexture.current?.texture.dispose()
      previewTexture.current = null
      if (video) {
        const texture = new THREE.VideoTexture(video)
        texture.colorSpace = THREE.SRGBColorSpace
        previewTexture.current = { video, texture }
      }
    }
    for (let i = 0; i < menuViews.length; i++) {
      const group = groups.current[i]
      if (!group) continue
      const pose = counterReelPose(i, menu.rendered, menuViews.length, 'media')
      const layout = pairedReelLayout(size.width, size.height)
      const {
        width: cssWidth,
        height: cssHeight,
        x: centerX,
        y: centerY,
      } = layout.media
      const panelWidth = (cssWidth / size.height) * height,
        panelHeight = (cssHeight / size.height) * height
      const spacing = ((layout.spacing / size.height) * height) / 1.9
      group.position.set(
        (centerX / size.width - 0.5) * width,
        (0.5 - centerY / size.height) * height + pose.y * spacing,
        pose.z,
      )
      group.rotation.set(
        pose.pitch,
        portrait ? -0.025 : 0.1,
        portrait ? -0.006 : -0.012,
      )
      const scale = i === selected ? enlargement : 1
      group.scale.set(panelWidth * scale, panelHeight * scale, 1)
      const material = resources.materials[i]
      const view = menuViews[i]
      const path = portrait && !short ? view.portrait : view.image
      if (
        view.presentation === 'media' &&
        Math.abs(selected - i) <= 1 &&
        !media.current.has(path) &&
        !failedPosters.current.has(path)
      )
        void loadPoster.current(path).catch(() => {})
      const isVideo = Boolean(
        previewTexture.current && previews.getSnapshot().projectId === view.id,
      )
      const texture = isVideo
        ? previewTexture.current!.texture
        : media.current.get(path)
      material.uniforms.uCustom.value = view.presentation !== 'media'
      material.uniforms.uCustomColor.value
        .copy(darkField)
        .lerp(lightField, displayedThemeMix())
      material.uniforms.uVideo.value = isVideo
      if (texture && material.uniforms.uImage.value !== texture) {
        material.uniforms.uImage.value = texture
        material.uniforms.uAspect.value =
          (isVideo ? video!.videoWidth : texture.image.width) /
          (isVideo ? video!.videoHeight : texture.image.height)
      }
      material.uniforms.uSize.value.set(panelWidth, panelHeight)
      const distance = Math.abs(i - menu.rendered * (menuViews.length - 1))
      material.uniforms.uDistance.value = distance
      material.uniforms.uOpacity.value =
        loaded.current && texture && view.presentation === 'media'
          ? reveal * (distance < 2.1 ? Math.max(0.16, 1 - distance * 0.38) : 0)
          : 0
      material.uniforms.uCss.value.set(cssWidth, cssHeight)
      material.uniforms.uViewport.value.set(
        size.width * gl.getPixelRatio(),
        size.height * gl.getPixelRatio(),
      )
      // Viewport breakpoint must remain CSS-based on high-DPR displays.
      material.uniforms.uViewport.value.x = size.width
      material.uniforms.uHeader.value.set(70 / size.height, 110 / size.height)
      material.uniforms.uTime.value = menu.reduced ? 0 : menu.clock
      material.uniforms.uBrightness.value =
        preferences.current.settings.displayBrightness / 100
    }
    const targets = [...menu.nativeTargets.entries()]
    if (menu.mediaTarget && menuViews[selected].presentation === 'media')
      targets.push([menuViews[selected].id, menu.mediaTarget])
    for (const [id, target] of targets) {
      const index = menuViews.findIndex((view) => view.id === id)
      const group = groups.current[index]
      if (!group) continue
      group.updateMatrixWorld()
      const corners = [
        new THREE.Vector3(-0.5, -0.5, -0.04),
        new THREE.Vector3(-0.5, 0.5, -0.04),
        new THREE.Vector3(0.5, -0.5, -0.04),
        new THREE.Vector3(0.5, 0.5, -0.04),
      ].map((point) => point.applyMatrix4(group.matrixWorld).project(camera))
      const left = ((Math.min(...corners.map((p) => p.x)) + 1) * size.width) / 2
      const right =
        ((Math.max(...corners.map((p) => p.x)) + 1) * size.width) / 2
      const top = ((1 - Math.max(...corners.map((p) => p.y))) * size.height) / 2
      const bottom =
        ((1 - Math.min(...corners.map((p) => p.y))) * size.height) / 2
      const view = menuViews[index]
      const cssWidth = (group.scale.x / 2.25) * size.height
      const cssHeight = (group.scale.y / 2.25) * size.height
      const points = [corners[1], corners[3], corners[2], corners[0]].map(
        (p) => ({
          x: ((p.x + 1) * size.width) / 2,
          y: ((1 - p.y) * size.height) / 2,
        }),
      )
      target.style.left = '0px'
      target.style.top = '0px'
      target.style.width = `${cssWidth}px`
      target.style.height = `${cssHeight}px`
      target.style.transformOrigin = '0 0'
      target.style.transform = panelTransform(points, cssWidth, cssHeight)
      target.style.borderRadius = `${(0.05 / 2.25) * size.height}px`
      target.dataset.ready = String(target.dataset.projectId === view.id)
      const distance = Math.abs(index - menu.rendered * (menuViews.length - 1))
      target.style.opacity = String(
        reveal * (distance < 2.1 ? Math.max(0.16, 1 - distance * 0.38) : 0),
      )
      target.style.visibility =
        distance < 2.1 && reveal > 0.001 ? 'visible' : 'hidden'
      target.style.zIndex = '0'
      target.style.setProperty(
        '--panel-radius',
        `${(0.05 / 2.25) * size.height}px`,
      )
    }
    // Frameless native text shares the right reel's actual camera and pose.
    const layout = pairedReelLayout(size.width, size.height)
    for (const [id, target] of menu.textTargets) {
      const index = menuViews.findIndex((view) => view.id === id)
      if (index < 0) continue
      const pose = counterReelPose(
        index,
        menu.rendered,
        menuViews.length,
        'text',
      )
      const bounds = layout.text
      textProjection.position.set(
        (bounds.x / size.width - 0.5) * width,
        (0.5 - bounds.y / size.height) * height +
          (pose.y * (layout.spacing / size.height) * height) / 1.9,
        pose.z,
      )
      textProjection.rotation.set(
        pose.pitch,
        portrait ? 0.025 : -0.035,
        portrait ? 0.006 : 0.004,
      )
      textProjection.scale.set(
        (bounds.width / size.height) * height,
        (bounds.height / size.height) * height,
        1,
      )
      textProjection.updateMatrixWorld()
      for (let corner = 0; corner < 4; corner++) {
        const p = textCorners[corner]
        p.set(
          corner === 0 || corner === 3 ? -0.5 : 0.5,
          corner < 2 ? 0.5 : -0.5,
          0,
        )
        p.applyMatrix4(textProjection.matrixWorld).project(camera)
        textPoints[corner].x = ((p.x + 1) * size.width) / 2
        textPoints[corner].y = ((1 - p.y) * size.height) / 2
      }
      const points = textPoints
      if (index === selected) {
        const xs = points.map((p) => p.x),
          ys = points.map((p) => p.y)
        resources.glass.material.uniforms.uQuiet.value.set(
          Math.min(...xs) / size.width,
          Math.min(...ys) / size.height,
          Math.max(...xs) / size.width,
          Math.max(...ys) / size.height,
        )
      }
      target.style.left = '0px'
      target.style.top = '0px'
      target.style.width = `${bounds.width}px`
      target.style.height = `${bounds.height}px`
      target.style.transform = panelTransform(
        points,
        bounds.width,
        bounds.height,
      )
      target.style.setProperty('--text-slot-width', `${bounds.width}px`)
      target.style.setProperty('--text-slot-height', `${bounds.height}px`)
      const distance = Math.abs(index - menu.rendered * (menuViews.length - 1))
      target.style.opacity = String(
        reveal * Math.max(0, 1 - Math.pow(distance / 1.12, 2)),
      )
      target.style.visibility =
        distance < 1.12 && reveal > 0.001 ? 'visible' : 'hidden'
      target.dataset.ready = 'true'
      target.dataset.displayedPose = String(menu.rendered)
    }
  }, -1)
  useFrame((_, dt) => {
    const q = displayedThemeMix()
    if (lastThemeMix.current !== q) {
      lastThemeMix.current = q
      needsRepaint.current = true
    }
    const bufferSize = `${gl.domElement.width}:${gl.domElement.height}`
    // A resized drawing buffer is empty. Repaint its frozen scene once, and
    // again only if an asynchronously loaded fitted poster becomes available.
    if (
      (!presentation.current.decorativeRunning || document.hidden) &&
      reported.current &&
      paintedSize.current === bufferSize &&
      !needsRepaint.current
    )
      return
    gl.info.reset()
    const index = Math.round(
      presentation.current.rendered * (menuViews.length - 1),
    )
    if (!presentation.current.paused && !document.hidden) {
      const response = 1 - Math.exp(-Math.min(dt, 0.05) / 0.6)
      darkBackground.current.lerp(palette[index], response)
      lightBackground.current.lerp(lightPalette[index], response)
    }
    mixedColor.current
      .copy(darkBackground.current)
      .lerp(lightBackground.current, q)
    // Theme interpolation has one owner; project movement keeps its own palette damping.
    background.current.copy(mixedColor.current)
    gl.setClearColor(
      presentation.current.intro.active
        ? mixedColor.current.copy(darkBase).lerp(lightBase, q)
        : background.current,
      1,
    )
    const menu = presentation.current
    theme.current.lerp(
      accentPalette[Math.round(menu.rendered * (menuViews.length - 1))],
      1 - Math.exp(-Math.min(dt, 0.05) / 0.6),
    )
    resources.glass.material.uniforms.uTime.value = menu.reduced
      ? 0
      : menu.clock
    resources.glass.material.uniforms.uAspect.value = size.width / size.height
    resources.glass.material.uniforms.uColor.value.copy(theme.current)
    resources.glass.material.uniforms.uLight.value = q
    resources.glass.material.uniforms.uOpacity.value = menu.intro.active
      ? menu.intro.exitProgress
      : 1
    gl.toneMappingExposure =
      (0.9 * preferences.current.settings.displayBrightness) / 100
    const perimeterActive = resources.perimeter.step(dt, menu)
    resources.trailMaterial.uniforms.uSelectionLight.value = q
    resources.trailMaterial.uniforms.uSmokeColor.value.copy(theme.current)
    const active = resources.trail.step(
      dt,
      size.width,
      size.height,
      quality.tier,
      preferences.current.settings.cursorSize,
      preferences.current.panelOpen || document.hidden,
      { clock: menu.clock, color: theme.current, reduced: menu.reduced },
    )
    gl.render(scene, camera)
    if (loaded.current && !reported.current) {
      reported.current = true
      onReady()
    }
    if (active || perimeterActive) {
      const clear = gl.autoClear
      try {
        gl.autoClear = false
        resources.trailMaterial.uniforms.uIntroTrail.value = menu.intro.active
          ? 1
          : 0
        resources.trailMaterial.blending = menu.intro.active
          ? THREE.AdditiveBlending
          : THREE.NormalBlending
        resources.trailMaterial.uniforms.uTrail.value = resources.trail.texture
        gl.render(resources.overlay, resources.ortho)
      } finally {
        gl.autoClear = clear
      }
    }
    paintedSize.current = bufferSize
    needsRepaint.current = false
    baseFrame.current++
  }, 1)
  return (
    <>
      <primitive object={resources.glass.mesh} dispose={null} />
      <primitive object={resources.ringwriter.mesh} dispose={null} />
      {menuViews.map((view, index) => (
        <group
          key={view.id}
          dispose={null}
          ref={(node) => {
            groups.current[index] = node
          }}
        >
          <mesh
            geometry={resources.geometry}
            material={resources.materials[index]}
          />
        </group>
      ))}
    </>
  )
}
