import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../core/narrative'
import { SUN_DIRECTION } from '../core/ocean'
const surfaceVertex = `varying vec3 vLocal,vNormal,vWorld;void main(){vLocal=position;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`
const noise = `float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+1.),f.x),f.y),f.z);}`
export function SolarSystem() {
  const group = useRef<THREE.Group>(null),
    glow = useRef<THREE.Mesh>(null)
  const sun = useMemo(
    () =>
      new THREE.Vector3(...SUN_DIRECTION)
        .normalize()
        .multiplyScalar(14)
        .add(new THREE.Vector3(0, -5, 0)),
    [],
  )
  const resources = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 96, 64)
    const material = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      uniforms: { uTime: { value: 0 } },
      fragmentShader: `${noise}varying vec3 vLocal,vNormal,vWorld;uniform float uTime;
      void main(){vec3 p=vLocal*26.+vec3(uTime*.018,0.,0.);float grains=n(p)*.65+n(p*2.4)*.35;float cells=n(vLocal*8.+uTime*.008);float view=max(0.,dot(normalize(vNormal),normalize(cameraPosition-vWorld)));float limb=.45+.55*pow(view,.4);vec3 hot=mix(vec3(1.9,.43,.055),vec3(4.1,2.1,.53),grains);hot*=limb*(.7+cells*.4);gl_FragColor=vec4(hot,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    const corona = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPresence: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float uPresence,uTime;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),angle=atan(p.y,p.x);float folds=.83+.17*sin(angle*11.+sin(angle*5.+uTime*.09));float halo=exp(-r*r*13.)*(1.-smoothstep(.6,.98,r));float plume=exp(-r*6.)*smoothstep(.15,.25,r)*folds;gl_FragColor=vec4(vec3(1.1,.48,.13),(halo*.28+plume*.13)*uPresence);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    return { sphere, material, corona }
  }, [])
  useEffect(
    () => () => {
      resources.sphere.dispose()
      resources.material.dispose()
      resources.corona.dispose()
    },
    [resources],
  )
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = narrative.frame.solar > 0.001
    const time = narrative.reducedMotion ? 0 : narrative.elapsed
    resources.material.uniforms.uTime.value = time
    resources.corona.uniforms.uTime.value = time
    resources.corona.uniforms.uPresence.value = narrative.frame.solar
    if (glow.current) glow.current.quaternion.copy(camera.quaternion)
  })
  return (
    <group ref={group}>
      <mesh
        position={sun}
        scale={0.65}
        geometry={resources.sphere}
        material={resources.material}
      />
      <mesh ref={glow} position={sun} material={resources.corona}>
        <planeGeometry args={[8, 8]} />
      </mesh>
      <directionalLight position={sun} color="#ffefcf" intensity={1.2} />
    </group>
  )
}
