import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { narrative } from '../core/narrative'
import { screenVertex, worldRayGLSL, skyGLSL } from './atmosphereShaders'
import { createStarGeometry } from './galaxy/createGalaxy'

export function SolarBackdrop({ quality }: { quality: QualityProfile }) {
  const background = useRef<THREE.Mesh>(null),
    points = useRef<THREE.Points>(null)
  const resources = useMemo(() => {
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    fallback.needsUpdate = true
    const sky = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      vertexShader: screenVertex,
      uniforms: {
        uCameraWorld: { value: new THREE.Matrix4() },
        uInverseProjection: { value: new THREE.Matrix4() },
        uMap: { value: fallback },
        uSky: { value: 0 },
      },
      fragmentShader: `${worldRayGLSL}${skyGLSL}uniform sampler2D uMap;uniform float uSky;
      void main(){vec3 ray=worldRay();float lon=atan(ray.z,ray.x);vec2 uv=vec2(fract(lon/6.283185+.61),asin(clamp(ray.y,-1.,1.))/3.141593+.5);vec3 map=texture2D(uMap,uv).rgb;vec3 air=mix(daylight(ray),vec3(.005,.022,.035),1.-smoothstep(-.05,.02,ray.y));gl_FragColor=vec4(mix(vec3(.0003,.0004,.0008)+map*.32,air,uSky),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    const geometry = createStarGeometry(Math.round(quality.stars * 0.6))
    const stars = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uDpr: { value: 1 },
      },
      vertexShader: `attribute float aSize;uniform float uTime,uPresence,uDpr;varying float vLight;void main(){vec3 p=position;float seed=dot(p,vec3(.31,.73,.17));p.x+=sin(uTime*.06+seed)*.08;p.y+=cos(uTime*.045+seed)*.06;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=min(3.,max(.65,aSize*38./max(2.,-view.z)))*uDpr;vLight=uPresence*(.7+.12*sin(uTime*.48+seed));}`,
      fragmentShader: `varying float vLight;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(vec3(.47,.56,.67),exp(-r*r*3.)*(1.-smoothstep(.65,1.,r))*vLight);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    return { sky, stars, geometry, fallback }
  }, [quality.stars])
  useEffect(() => {
    let cancelled = false,
      texture: THREE.Texture | undefined
    const deadline = window.setTimeout(() => {
      cancelled = true
      console.warn('Milky Way detail timed out; retaining seeded stars.')
    }, 12000)
    new THREE.TextureLoader().load(
      import.meta.env.BASE_URL + 'assets/worlds/milkyway.webp',
      (loaded) => {
        clearTimeout(deadline)
        if (cancelled) {
          loaded.dispose()
          return
        }
        texture = loaded
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.wrapS = THREE.RepeatWrapping
        loaded.wrapT = THREE.ClampToEdgeWrapping
        resources.sky.uniforms.uMap.value = loaded
      },
      undefined,
      () => {
        clearTimeout(deadline)
        console.warn('Milky Way detail unavailable; retaining seeded stars.')
      },
    )
    return () => {
      cancelled = true
      clearTimeout(deadline)
      texture?.dispose()
      resources.sky.dispose()
      resources.stars.dispose()
      resources.geometry.dispose()
      resources.fallback.dispose()
    }
  }, [resources])
  useFrame(({ camera, gl }) => {
    const f = narrative.frame,
      presence = narrative.state < 1 ? f.planet * (1 - f.sky) : 0
    if (background.current) background.current.visible = presence > 0.001
    if (points.current) points.current.visible = presence > 0.001
    resources.sky.uniforms.uSky.value = f.sky
    resources.sky.uniforms.uCameraWorld.value.copy(camera.matrixWorld)
    resources.sky.uniforms.uInverseProjection.value.copy(
      camera.projectionMatrixInverse,
    )
    resources.stars.uniforms.uTime.value = narrative.reducedMotion
      ? 0
      : narrative.elapsed
    resources.stars.uniforms.uPresence.value = presence * 0.62
    resources.stars.uniforms.uDpr.value = gl.getPixelRatio()
  })
  return (
    <>
      <mesh
        ref={background}
        material={resources.sky}
        renderOrder={-90}
        frustumCulled={false}
      >
        <planeGeometry args={[2, 2]} />
      </mesh>
      <points
        ref={points}
        geometry={resources.geometry}
        material={resources.stars}
      />
    </>
  )
}
