import { CursorTrail, trailOutputGLSL } from './cursor/CursorTrail'
import { sunGLSL } from '../core/ocean'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { ExperiencePreferences } from '../core/experienceSettings'
import { BASE_EXPOSURE } from './displayOutput'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { narrative } from '../core/narrative'
import { screenVertex, worldRayGLSL } from './atmosphereShaders'
const cloudFragment = `${worldRayGLSL}
uniform vec3 uOrigin;uniform float uTime,uPresence,uCover,uDepth;uniform float uSteps;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);}
float density(vec3 p){
  float bank=smoothstep(57.,63.,p.y)*(1.-smoothstep(83.,91.,p.y));
  float deckBank=smoothstep(-32.,-24.,p.y)*(1.-smoothstep(44.,52.,p.y));
  float edge=1.-smoothstep(46.,65.,length(p.xz));
  float deckEdge=1.-smoothstep(140.,190.,length(p.xz));
  // Support tests precede the expensive warp/erosion field. Empty sunlight
  // samples and deck-only samples do not need the six billow evaluations.
  if(bank*edge<.000001 && deckBank*deckEdge*uCover<.000001)return 0.;
  vec3 moving=p+vec3(uTime*.12,0.,uTime*.045);
  moving+=(vec3(noise(moving*.18),noise(moving*.18+7.3),noise(moving*.18+19.7))-.5)*4.;
  float billows=noise(moving*.55)*.6+noise(moving*1.1)*.3+noise(moving*2.2)*.15;
  float deck=deckBank*deckEdge*(.085+billows*.08)*uCover;
  if(bank*edge<.000001)return deck*uDepth;
  // Compact overlapping billows leave readable openings along the flight path.
  // Noise erodes their boundaries rather than painting a flat screen mask.
  vec3 q1=(moving-vec3(-4.,74.,3.))/vec3(5.,6.,5.);
  vec3 q2=(moving-vec3(4.,79.,-3.))/vec3(6.,7.,6.);
  vec3 q3=(moving-vec3(3.,62.,1.2))/vec3(3.5,4.,3.);
  vec3 q4=(moving-vec3(-5.,86.,-5.))/vec3(7.,5.,6.);
  vec3 q5=(moving-vec3(-3.,63.,-1.5))/vec3(3.5,4.,3.);
  vec3 q6=(moving-vec3(0.,58.,-3.))/vec3(3.,3.,3.);
  float shape=exp(-dot(q1,q1))*1.2+exp(-dot(q2,q2))*1.3+exp(-dot(q3,q3))+exp(-dot(q4,q4))*1.2+exp(-dot(q5,q5))+exp(-dot(q6,q6));
  vec3 pocket=(moving-vec3(-1.,71.,0.))/vec3(3.,6.,3.);
  shape-=exp(-dot(pocket,pocket))*.3*(1.-uCover);
  float erosion=noise(moving*.32)*.4+noise(moving*.9)*.12+noise(moving*1.8)*.08;
  float outer=bank*edge*max(0.,shape-erosion-.12)*(.035+billows*.18)*1.45;
  // A continuous deck intersects the entire frustum around the scale transfer.
  // Its lower-bounded extinction preserves texture without see-through corners.
  return (outer+deck)*uDepth;
}
void main(){
  vec3 ray=worldRay();vec3 inv=1./(ray+vec3(.000001));vec3 a=(mix(vec3(-66.,57.,-66.),vec3(-200.,-32.,-200.),uCover)-uOrigin)*inv,b=(mix(vec3(66.,91.,66.),vec3(200.,108.,200.),uCover)-uOrigin)*inv;
  vec3 lo=min(a,b),hi=max(a,b);float near=max(0.,max(lo.x,max(lo.y,lo.z))),far=min(hi.x,min(hi.y,hi.z));
  vec3 sum=vec3(0.);float transmission=1.;
  if(far>near){float stepSize=(far-near)/uSteps;
    for(int i=0;i<48;i++){if(float(i)>=uSteps)break;vec3 p=uOrigin+ray*(near+(float(i)+.5)*stepSize);float d=density(p);
      if(d>.0001){vec3 sun=normalize(${sunGLSL});float shadow=density(p+sun*3.)*3.+density(p+sun*8.)*5.+density(p+sun*15.)*7.;
        float light=exp(-shadow*2.6)*.65+.25;light=clamp(light+(density(p-sun*1.6)-density(p+sun*1.6))*mix(10.,6.,uCover),.05,1.);light=clamp(light+uCover*(noise(p*.16+vec3(uTime*.02,0.,0.))-.5)*.32,.05,1.);light*=mix(1.,.18+.82*noise(vec3(p.x*.18,4.7,p.z*.18)+vec3(uTime*.02,0.,uTime*.01)),uCover);float optical=1.-exp(-d*stepSize*1.3);vec3 scatter=mix(vec3(.10,.18,.28),vec3(1.8,1.8,1.7),light);scatter+=vec3(.06,.10,.15)*smoothstep(59.,89.,p.y);
        sum+=transmission*scatter*optical;transmission*=1.-optical;if(transmission<.008)break;}
    }
  }
  gl_FragColor=vec4(sum*uPresence,mix(1.,transmission,uPresence));
}`
declare global {
  interface Window {
    __cloudCoverage?: () => {
      width: number
      height: number
      state: number
      cover: number
      minimum: number
      median: number
      p95: number
      maximum: number
      below01: number
      below02: number
      pixels: number
      excluded: number
      mask: string
    }
  }
}
// The scene and cloud buffers are linear. Only this final pass applies ACES and
// sRGB output. At the untouched opening/arrival/later worlds the renderer uses
// its existing direct path, retaining approved shading without an extra pass.
export function DescentComposite({
  quality,
  preferences,
  onReady,
  onFailure,
}: {
  quality: QualityProfile
  preferences: RefObject<ExperiencePreferences>
  onReady: () => void
  onFailure: () => void
}) {
  const { gl, size, scene, camera } = useThree()
  const exposure = useRef(BASE_EXPOSURE)
  const trail = useMemo(() => new CursorTrail(gl), [gl])
  useEffect(() => {
    const disconnect = trail.connect()
    return () => {
      disconnect()
      trail.dispose()
    }
  }, [trail])
  const resources = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2),
      camera = new THREE.Camera()
    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
    })
    const cloudTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    })
    const cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: screenVertex,
      fragmentShader: cloudFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uInverseProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uOrigin: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uCover: { value: 0 },
        uDepth: { value: 1 },
        uSteps: { value: quality.cloudSteps },
      },
    })
    const finalMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      vertexShader: screenVertex,
      uniforms: {
        ...trail.outputUniforms,
        uScene: { value: sceneTarget.texture },
        uTrail: { value: trail.texture },
        uTrailPresence: { value: 0 },
        uCloud: { value: cloudTarget.texture },
        uFlash: { value: 0 },
        uClouds: { value: 0 },
        uCore: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: 1 },
      },
      fragmentShader: `varying vec2 vUv;uniform sampler2D uScene,uCloud;${trailOutputGLSL}uniform float uFlash,uClouds,uAspect,uTrailPresence;uniform vec2 uCore;
      void main(){vec3 color=texture2D(uScene,vUv).rgb;if(uClouds>.001){vec4 cloud=texture2D(uCloud,vUv);color=color*cloud.a+cloud.rgb;}
      float r=length((vUv-uCore)*vec2(uAspect,1.));float bloom=exp(-r*r/(.025+uFlash*uFlash*2.));float cover=uFlash*mix(bloom,1.,smoothstep(.5,.99,uFlash));
      color=mix(color,vec3(1.9,1.5,.95),cover);color+=trailOutput(vUv)*uTrailPresence*pow(1.-uFlash,3.);gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    // The approved endpoint blends translucent tissue in the renderer's direct
    // output path. Re-compositing those layers in linear space changes its
    // optics. Overlay only the trail there: each source is transformed once,
    // and the already rendered scene is neither sampled nor tone-mapped again.
    const trailMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: screenVertex,
      uniforms: { ...trail.outputUniforms, uTrail: { value: trail.texture } },
      fragmentShader: `varying vec2 vUv;${trailOutputGLSL}void main(){gl_FragColor=vec4(trailOutput(vUv),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    const cloudScene = new THREE.Scene(),
      finalScene = new THREE.Scene(),
      trailScene = new THREE.Scene()
    cloudScene.add(new THREE.Mesh(geometry, cloudMaterial))
    finalScene.add(new THREE.Mesh(geometry, finalMaterial))
    trailScene.add(new THREE.Mesh(geometry, trailMaterial))
    return {
      geometry,
      camera,
      sceneTarget,
      cloudTarget,
      cloudMaterial,
      finalMaterial,
      trailMaterial,
      trailScene,
      cloudScene,
      finalScene,
      core: new THREE.Vector3(),
      cloudOrigin: new THREE.Vector3(),
      drawingSize: new THREE.Vector2(),
    }
  }, [quality.cloudSteps, trail])
  useEffect(() => {
    let cancelled = false,
      readyFrame = 0
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        cancelled = true
        onFailure()
      }
    }, 20000)
    const prepare = async () => {
      try {
        const programs = [
          trail.prepare(),
          gl.compileAsync(scene, camera),
          gl.compileAsync(resources.cloudScene, resources.camera),
          gl.compileAsync(resources.finalScene, resources.camera),
          gl.compileAsync(resources.trailScene, resources.camera),
        ]
        // Prepare the scene's linear-target variant as well as its direct path.
        const prior = gl.getRenderTarget()
        try {
          gl.setRenderTarget(resources.sceneTarget)
          programs.push(gl.compileAsync(scene, camera))
        } finally {
          gl.setRenderTarget(prior)
        }
        await Promise.all(programs)
        clearTimeout(timeout)
        if (!cancelled) readyFrame = requestAnimationFrame(onReady)
      } catch {
        clearTimeout(timeout)
        if (!cancelled) onFailure()
      }
    }
    void prepare()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      cancelAnimationFrame(readyFrame)
    }
  }, [gl, scene, camera, resources, trail, onReady, onFailure])
  useEffect(() => {
    const previous = gl.info.autoReset
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = previous
    }
  }, [gl])
  useEffect(
    () => () => {
      resources.geometry.dispose()
      resources.sceneTarget.dispose()
      resources.cloudTarget.dispose()
      resources.cloudMaterial.dispose()
      resources.finalMaterial.dispose()
      resources.trailMaterial.dispose()
    },
    [resources],
  )
  useEffect(() => {
    // Explicit review-only readback. Never executed by the production frame loop.
    const read = () => {
      const { width, height } = resources.cloudTarget
      const buffer = new Uint16Array(width * height * 4)
      gl.readRenderTargetPixels(
        resources.cloudTarget,
        0,
        0,
        width,
        height,
        buffer,
      )
      const values = new Float32Array(width * height)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!,
        pixels = context.createImageData(width, height)
      let below01 = 0,
        below02 = 0
      for (let i = 0; i < values.length; i++) {
        const t = THREE.DataUtils.fromHalfFloat(buffer[i * 4 + 3])
        values[i] = t
        if (t <= 0.01) below01++
        if (t <= 0.02) below02++
        const x = i % width,
          y = Math.floor(i / width),
          offset = ((height - 1 - y) * width + x) * 4
        pixels.data[offset] = t > 0.02 ? 255 : 0
        pixels.data[offset + 1] = t <= 0.01 ? 190 : 0
        pixels.data[offset + 2] = Math.round(Math.min(1, t) * 255)
        pixels.data[offset + 3] = 255
      }
      context.putImageData(pixels, 0, 0)
      values.sort()
      return {
        width,
        height,
        state: narrative.state,
        cover: narrative.frame.cloudCover,
        minimum: values[0],
        median: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        maximum: values[values.length - 1],
        below01: below01 / values.length,
        below02: below02 / values.length,
        pixels: values.length,
        excluded: 0,
        mask: canvas.toDataURL(),
      }
    }
    window.__cloudCoverage = read
    return () => {
      if (window.__cloudCoverage === read) delete window.__cloudCoverage
    }
  }, [gl, resources])
  useFrame(({ scene, camera }, dt) => {
    gl.info.reset()
    const { settings, panelOpen } = preferences.current
    const targetExposure = (BASE_EXPOSURE * settings.displayBrightness) / 100
    exposure.current +=
      (targetExposure - exposure.current) *
      (1 - Math.exp(-Math.min(dt, 0.05) * 26))
    gl.toneMappingExposure = exposure.current
    const f = narrative.frame,
      flash = narrative.reducedMotion ? 0 : f.flash,
      clouds = f.clouds
    const activeTrail = trail.step(
      dt,
      size.width,
      size.height,
      quality.tier,
      settings.cursorSize,
      panelOpen,
    )
    if (flash < 0.0001 && clouds < 0.0001) {
      gl.render(scene, camera)
      if (activeTrail) {
        const clear = gl.autoClear
        try {
          gl.autoClear = false
          resources.trailMaterial.uniforms.uTrail.value = trail.texture
          gl.render(resources.trailScene, resources.camera)
        } finally {
          gl.autoClear = clear
        }
      }
      return
    }
    gl.getDrawingBufferSize(resources.drawingSize)
    const width = resources.drawingSize.x,
      height = resources.drawingSize.y
    if (
      resources.sceneTarget.width !== width ||
      resources.sceneTarget.height !== height
    ) {
      resources.sceneTarget.setSize(width, height)
      resources.cloudTarget.setSize(
        Math.max(1, Math.floor(width * quality.cloudResolution)),
        Math.max(1, Math.floor(height * quality.cloudResolution)),
      )
    }
    const priorTarget = gl.getRenderTarget()
    try {
      gl.setRenderTarget(resources.sceneTarget)
      gl.render(scene, camera)
      if (clouds > 0.0001) {
        const u = resources.cloudMaterial.uniforms
        u.uInverseProjection.value.copy(camera.projectionMatrixInverse)
        u.uCameraWorld.value.copy(camera.matrixWorld)
        u.uOrigin.value
          .copy(camera.position)
          .sub(resources.cloudOrigin.fromArray(f.cloudOrigin))
          .multiplyScalar(1 / f.cloudScale)
        u.uTime.value = narrative.reducedMotion ? 0 : narrative.elapsed
        u.uPresence.value = clouds
        u.uCover.value = f.cloudCover
        u.uDepth.value = settings.cloudDepth / 100
        gl.setRenderTarget(resources.cloudTarget)
        gl.render(resources.cloudScene, resources.camera)
      }
      resources.core
        .set(
          size.width < 720 ? 0.7 : 4,
          size.width < 720 && size.height < 700 ? 5.2 : 3.8,
          0,
        )
        .project(camera)
      resources.finalMaterial.uniforms.uCore.value.set(
        (resources.core.x + 1) * 0.5,
        (resources.core.y + 1) * 0.5,
      )
      resources.finalMaterial.uniforms.uAspect.value = size.width / size.height
      resources.finalMaterial.uniforms.uFlash.value = flash
      resources.finalMaterial.uniforms.uTrail.value = trail.texture
      resources.finalMaterial.uniforms.uTrailPresence.value = activeTrail
        ? 1
        : 0
      resources.finalMaterial.uniforms.uClouds.value = clouds
      gl.setRenderTarget(priorTarget)
      gl.render(resources.finalScene, resources.camera)
    } finally {
      gl.setRenderTarget(priorTarget)
    }
  }, 1)
  return null
}
