import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { narrative } from '../core/narrative'
import { type WorldId } from '../core/journey'
import { SUN_DIRECTION } from '../core/ocean'

const vertex = `varying vec3 vNormal,vWorld,vLocal;varying highp vec2 vUv;
void main(){vUv=uv;vLocal=position;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`
const noise = `float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+1.),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,r=0.;for(int i=0;i<4;i++){r+=n(p)*a;p=p*2.03+1.3;a*=.5;}return r;}`
const fragment = `${noise}
varying vec3 vNormal,vWorld,vLocal;varying highp vec2 vUv;
uniform float uKind,uPresence,uReady;uniform vec3 uSun;uniform sampler2D uEarth;
void main(){vec3 normal=normalize(vNormal),sun=normalize(uSun),view=normalize(cameraPosition-vWorld);
float lit=max(0.,dot(normal,sun)),rim=pow(1.-max(0.,dot(normal,view)),3.);float grain=fbm(vLocal*13.);
vec3 color=vec3(.012,.052,.105);float rough=.7;
if(uKind<1.5){color=mix(vec3(.015,.075,.14),texture2D(uEarth,vUv).rgb,uReady);float ocean=1.-smoothstep(.07,.22,color.r+color.g*.3);float glint=pow(max(0.,dot(reflect(-sun,normal),view)),200.);color=color*(.075+lit*.92)+vec3(.75,.85,.94)*glint*ocean*.12;}
else if(uKind<2.5){color=mix(vec3(.012,.014,.017),vec3(.12,.10,.078),grain);float veins=1.-smoothstep(.025,.06,abs(sin(vLocal.x*18.+fbm(vLocal*4.)*8.)));color=color*(.06+lit*.72)+veins*.028*vec3(.75,.6,.4);}
else if(uKind<3.5){color=mix(vec3(.003,.009,.023),vec3(.015,.035,.065),grain);color*=.14+lit*.5;color+=vec3(.015,.13,.35)*rim*pow(lit,.35);}
else if(uKind<4.5){float cells=step(.84,fract(vUv.x*24.))*step(.84,fract(vUv.y*12.));color=mix(vec3(.012,.024,.04),vec3(.1,.13,.16),grain)*(.12+lit*.8)+cells*vec3(.15,.23,.26);}
else {vec2 uv=vUv*vec2(90.,45.);vec2 tile=floor(uv);float field=h(vec3(tile,2.));float edge=step(.02,fract(uv.x))*step(.03,fract(uv.y));color=mix(vec3(.075,.10,.035),vec3(.28,.19,.075),field)*edge;float land=smoothstep(.32,.6,fbm(vLocal*3.));color=mix(vec3(.008,.035,.045),color,land)*(.08+lit*.95);}
gl_FragColor=vec4(color,uPresence);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const atmosphere = `varying vec3 vNormal,vWorld,vLocal;varying highp vec2 vUv;uniform float uPresence,uWarm;uniform vec3 uSun;
void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld),L=normalize(uSun);float rim=pow(1.-abs(dot(N,V)),4.);float sun=.12+.88*smoothstep(-.25,.65,dot(N,L));vec3 c=mix(vec3(.06,.23,.64),vec3(.20,.30,.16),uWarm);gl_FragColor=vec4(c*1.3,rim*sun*uPresence*.8);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const cloudFragment = `varying vec3 vNormal,vWorld,vLocal;varying highp vec2 vUv;uniform sampler2D uClouds;uniform float uPresence,uTime;uniform vec3 uSun;
void main(){float c=texture2D(uClouds,vUv+vec2(fract(uTime*.00035),0)).r;float sun=max(0.,dot(normalize(vNormal),normalize(uSun)));gl_FragColor=vec4(vec3(.68,.79,.91)*(.06+sun*.94),smoothstep(.12,.8,c)*uPresence*.82);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const worlds: WorldId[] = ['ocean']
export function PlanetScene({
  quality,
  onAssetState,
}: {
  quality: QualityProfile
  onAssetState: (state: 'loading' | 'ready' | 'failed') => void
}) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const { gl } = useThree()
  const resources = useMemo(() => {
    const fallback = new THREE.DataTexture(
      new Uint8Array([12, 34, 62, 255]),
      1,
      1,
    )
    fallback.needsUpdate = true
    const sphere = new THREE.SphereGeometry(
      1,
      quality.tier === 'low' ? 40 : 96,
      quality.tier === 'low' ? 24 : 64,
    )
    const bodies = worlds.map(
      (_, i) =>
        new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: {
            uSun: { value: new THREE.Vector3(0.32, 0.94, 0.12) },
            uKind: { value: i + 1 },
            uPresence: { value: 1 },
            uReady: { value: 0 },
            uEarth: { value: fallback },
          },
          transparent: true,
          depthWrite: true,
        }),
    )
    const rims = worlds.map(
      (_, i) =>
        new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: atmosphere,
          uniforms: {
            uPresence: { value: 1 },
            uSun: { value: new THREE.Vector3(0.32, 0.94, 0.12) },
            uWarm: { value: i === 4 ? 1 : 0 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        }),
    )
    const cloud = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: cloudFragment,
      uniforms: {
        uSun: { value: new THREE.Vector3(...SUN_DIRECTION) },
        uClouds: { value: fallback },
        uPresence: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    })
    const oceanOrientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(-0.88, -0.21, -0.42).normalize(),
      new THREE.Vector3(0, 1, 0),
    )
    const facets = new THREE.IcosahedronGeometry(1, 2)
    return { sphere, facets, oceanOrientation, bodies, rims, cloud, fallback }
  }, [quality.tier])
  useEffect(() => {
    let retired = false
    const textures: THREE.Texture[] = []
    onAssetState('loading')
    const load = (
      url: string,
      colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
    ) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        let settled = false
        const timer = window.setTimeout(() => {
          settled = true
          reject(new Error(`Planet texture timed out: ${url}`))
        }, 12000)
        new THREE.TextureLoader().load(
          url,
          (texture) => {
            clearTimeout(timer)
            if (retired || settled) {
              texture.dispose()
              if (!settled) reject(new Error('retired texture load'))
              return
            }
            settled = true
            texture.colorSpace = colorSpace
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.ClampToEdgeWrapping
            texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())
            textures.push(texture)
            resolve(texture)
          },
          undefined,
          (error) => {
            clearTimeout(timer)
            settled = true
            reject(error)
          },
        )
      })
    Promise.allSettled([
      load('/assets/worlds/earth.webp'),
      load('/assets/worlds/clouds.webp', THREE.NoColorSpace),
    ]).then((results) => {
      if (retired) return
      if (results[0].status === 'fulfilled') {
        resources.bodies[0].uniforms.uEarth.value = results[0].value
        resources.bodies[0].uniforms.uReady.value = 1
      }
      if (results[1].status === 'fulfilled')
        resources.cloud.uniforms.uClouds.value = results[1].value
      onAssetState(
        results.every((r) => r.status === 'fulfilled') ? 'ready' : 'failed',
      )
    })
    return () => {
      retired = true
      textures.forEach((t) => t.dispose())
      resources.sphere.dispose()
      resources.facets.dispose()
      resources.fallback.dispose()
      resources.bodies.forEach((m) => m.dispose())
      resources.rims.forEach((m) => m.dispose())
      resources.cloud.dispose()
    }
  }, [resources, gl, onAssetState])
  useFrame(() => {
    const f = narrative.frame
    worlds.forEach((id, i) => {
      const g = groups.current[i]
      if (!g) return
      const presence = id === 'ocean' ? f.planet * f.worlds.ocean : f.worlds[id]
      g.visible = presence > 0.001
      g.position.fromArray(id === 'ocean' ? f.oceanCenter : f.worldCenters[id])
      const sun =
        i === 0 && narrative.state < 1.65 ? SUN_DIRECTION : [0.32, 0.94, 0.12]
      resources.bodies[i].uniforms.uSun.value.fromArray(sun)
      resources.rims[i].uniforms.uSun.value.fromArray(sun)
      resources.bodies[i].uniforms.uPresence.value = presence
      if (i === 0) resources.bodies[i].transparent = presence < 0.999
      resources.rims[i].uniforms.uPresence.value = presence
    })
    resources.cloud.uniforms.uPresence.value =
      f.planet * f.worlds.ocean * (1 - f.sky)
    resources.cloud.uniforms.uTime.value = narrative.reducedMotion
      ? 0
      : narrative.elapsed
  })
  return (
    <>
      {worlds.map((id, i) => (
        <group
          key={id}
          ref={(g) => {
            groups.current[i] = g
          }}
        >
          <mesh
            geometry={i === 3 ? resources.facets : resources.sphere}
            material={resources.bodies[i]}
            scale={5}
            quaternion={i === 0 ? resources.oceanOrientation : undefined}
          />
          <mesh
            geometry={resources.sphere}
            material={resources.rims[i]}
            scale={5.1}
          />
          {i === 0 && (
            <mesh
              geometry={resources.sphere}
              material={resources.cloud}
              scale={5.04}
              quaternion={resources.oceanOrientation}
            />
          )}
          {i === 3 && (
            <mesh scale={5.01}>
              <icosahedronGeometry args={[1, 2]} />
              <meshBasicMaterial
                color="#5c7382"
                wireframe
                transparent
                opacity={0.22}
              />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}
