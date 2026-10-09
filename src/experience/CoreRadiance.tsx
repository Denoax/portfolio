import { useFrame } from '@react-three/fiber'
import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../core/narrative'
import { descentPhase } from '../core/descent'
import { smoothstep } from '../core/math'
import { screenVertex, worldRayGLSL } from './atmosphereShaders'
export function CoreRadiance() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCameraWorld: { value: new THREE.Matrix4() },
          uInverseProjection: { value: new THREE.Matrix4() },
          uCore: { value: new THREE.Vector3() },
          uPresence: { value: 0 },
          uTime: { value: 0 },
        },
        fragmentShader: `${worldRayGLSL}uniform vec3 uCore;uniform float uPresence,uTime;
 void main(){vec3 ray=worldRay(),offset=uCameraWorld[3].xyz-uCore;float b=dot(offset,ray),c=dot(offset,offset)-2.25,d=b*b-c;float light=0.;if(d>0.){float near=max(0.,-b-sqrt(d)),far=-b+sqrt(d);if(far>near){float stepSize=(far-near)/16.;for(int i=0;i<16;i++){vec3 p=offset+ray*(near+(float(i)+.5)*stepSize);float density=exp(-dot(p,p)*2.2);float fold=.8+.2*sin(p.x*9.+p.y*6.+sin(p.z*7.+uTime*.15));light+=density*fold*stepSize;}}}gl_FragColor=vec4(vec3(1.2,.8,.38)*light*uPresence,.72*uPresence);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ camera, size }) => {
    const f = narrative.frame
    const q = descentPhase(Math.min(1, narrative.state))
    const presence = f.galaxy * smoothstep((q - 0.11) / 0.11)
    if (mesh.current) mesh.current.visible = presence > 0.001
    const u = material.uniforms
    u.uPresence.value = presence
    u.uTime.value = narrative.reducedMotion ? 0 : narrative.elapsed
    u.uCore.value.set(
      size.width < 720 ? 0.7 : 4,
      size.width < 720 && size.height < 700 ? 5.2 : 3.8,
      0,
    )
    u.uCameraWorld.value.copy(camera.matrixWorld)
    u.uInverseProjection.value.copy(camera.projectionMatrixInverse)
  })
  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={20}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
