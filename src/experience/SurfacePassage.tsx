import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../core/narrative'
import type { QualityProfile } from '../core/quality'
import { waveGLSL, sunGLSL } from '../core/ocean'
import { skyGLSL } from './atmosphereShaders'
// Local tangent surface; same wave frequencies as core/journey.waveHeight.
// The lens physically passes through it. No screen-sized stars-to-blue dissolve.
export function SurfacePassage({ quality }: { quality: QualityProfile }) {
  const mesh = useRef<THREE.Mesh>(null)
  const particles = useRef<THREE.Points>(null)
  const particleGeometry = useMemo(() => {
    const positions = new Float32Array(120 * 3)
    // Deterministic suspended matter in the local tangent frame.
    let seed = 1729
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 120; i++) {
      positions[i * 3] = (random() - 0.5) * 18
      positions[i * 3 + 1] = -random() * 8 - 0.2
      positions[i * 3 + 2] = -random() * 14
    }
    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    )
  }, [])
  const particleMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#76acbd',
        size: 0.035,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  )
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
        uniforms: {
          uTime: { value: 0 },
          uPresence: { value: 0 },
          uBelow: { value: 0 },
        },
        vertexShader: `uniform float uTime;varying vec3 vWorld,vNormal;varying float vCrest;${waveGLSL}
    void main(){vec4 world=modelMatrix*vec4(position,1.);vec3 w=wave(world.xz,uTime);world.y+=w.x;vCrest=w.x;vNormal=normalize(vec3(-w.y,1.,-w.z));vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
        fragmentShader: `${skyGLSL}uniform float uTime,uPresence,uBelow;varying vec3 vWorld,vNormal;varying float vCrest;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){vec3 V=normalize(cameraPosition-vWorld);float footprint=max(length(dFdx(vWorld.xz)),length(dFdy(vWorld.xz)));float detail=1.-smoothstep(.04,.7,footprint);
    vec2 fine=vec2(0.);vec2 flow=vec2(uTime*.065,-uTime*.043);
    fine+=vec2(noise((vWorld.xz+flow)*5.+vec2(.07,0.))-noise((vWorld.xz+flow)*5.-vec2(.07,0.)),noise((vWorld.xz+flow)*5.+vec2(0.,.07))-noise((vWorld.xz+flow)*5.-vec2(0.,.07)))*1.4;
    fine+=vec2(noise((vWorld.xz-flow)*13.+vec2(.09,0.))-noise((vWorld.xz-flow)*13.-vec2(.09,0.)),noise((vWorld.xz-flow)*13.+vec2(0.,.09))-noise((vWorld.xz-flow)*13.-vec2(0.,.09)))*.65;
    vec3 N=normalize(vNormal+vec3(fine.x,0.,fine.y)*detail),L=normalize(${sunGLSL});
    float cosine=abs(dot(N,V));float fresnel=.0204+.9796*pow(1.-cosine,5.);vec3 sky=min(daylight(reflect(-V,N)),vec3(.48,.54,.62));
    float shadow=.72+.28*noise(vWorld.xz*.043+vec2(uTime*.005,0.));
    vec3 body=vec3(.0025,.017,.027)*shadow;float glint=pow(max(0.,dot(reflect(-L,N),V)),96.);
    float crest=smoothstep(.34,.52,vCrest)*(1.-smoothstep(.22,.45,noise(vWorld.xz*3.+flow)));vec3 foam=vec3(.22,.27,.29)*crest*.2;
    vec3 above=foam+body*(.6+.4*max(0.,dot(N,L)))+sky*fresnel+vec3(.9,.85,.71)*glint*.065;
    vec3 below=vec3(.005,.031,.048)+vec3(.012,.036,.044)*fresnel;
    gl_FragColor=vec4(mix(above,below,uBelow),uPresence*mix(1.,.32,uBelow));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      2,
      2,
      quality.waveSegments,
      quality.waveSegments,
    )
    g.rotateX(-Math.PI / 2)
    return g
  }, [quality.waveSegments])
  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
    },
    [material, geometry, particleGeometry, particleMaterial],
  )
  useFrame(() => {
    const f = narrative.frame
    if (mesh.current) {
      mesh.current.visible = f.surface > 0.001
      mesh.current.position.set(0, f.surfaceY, f.position[2])
      const extent = Math.max(8, Math.min(200, f.altitude * 1.25 + 2))
      mesh.current.scale.set(extent, 1, extent)
    }
    if (particles.current) {
      particles.current.visible = f.submerged > 0.01 && f.pelagic < 0.99
      particles.current.position.set(0, f.surfaceY, f.surfaceZ)
    }
    particleMaterial.opacity = f.submerged * (1 - f.pelagic) * 0.45
    material.uniforms.uPresence.value = f.surface
    material.uniforms.uBelow.value = f.submerged
    material.uniforms.uTime.value = narrative.reducedMotion
      ? 0
      : narrative.elapsed
  })
  return (
    <>
      <mesh ref={mesh} material={material} geometry={geometry} />
      <points
        ref={particles}
        material={particleMaterial}
        geometry={particleGeometry}
      />
    </>
  )
}
