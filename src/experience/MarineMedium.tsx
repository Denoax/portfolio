import {
  marineColorGLSL,
  MARINE_PLANE_SIZE,
  MARINE_PLANE_Z,
} from './marineShaders'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../core/narrative'
export function MarineMedium() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: false,
        depthWrite: true,
        uniforms: {
          uPresence: { value: 0 },
          uTime: { value: 0 },
          uDepth: { value: 0 },
        },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `${marineColorGLSL}uniform float uPresence,uTime,uDepth;varying vec2 vUv;
      void main(){gl_FragColor=vec4(marineColor(vUv,uTime,uDepth)*uPresence,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    material.uniforms.uPresence.value = narrative.frame.submerged
    // Keep the original opaque pass for tissue transmission at arrival.
    // The full-screen atmosphere adapter supplies the same RGB during the turn.
    if (mesh.current) mesh.current.visible = narrative.frame.pelagic === 1
    material.uniforms.uDepth.value = narrative.frame.depth
    material.uniforms.uTime.value = narrative.reducedMotion
      ? 8
      : narrative.elapsed
  })
  return (
    <mesh
      ref={mesh}
      position={[0, 0, MARINE_PLANE_Z]}
      material={material}
      renderOrder={-10}
    >
      <planeGeometry args={[...MARINE_PLANE_SIZE]} />
    </mesh>
  )
}
