import {
  marineColorGLSL,
  MARINE_PLANE_SIZE,
  MARINE_PLANE_Z,
} from './marineShaders'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../core/narrative'
import { screenVertex, skyGLSL, worldRayGLSL } from './atmosphereShaders'
export function AtmosphereSky() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        transparent: false,
        uniforms: {
          uInverseProjection: { value: new THREE.Matrix4() },
          uCameraWorld: { value: new THREE.Matrix4() },
          uPresence: { value: 0 },
          uArrival: { value: 0 },
          uTime: { value: 0 },
          uBelow: { value: 0 },
          uDepth: { value: 0 },
        },
        vertexShader: screenVertex,
        fragmentShader: `${worldRayGLSL}${skyGLSL}${marineColorGLSL}uniform float uPresence,uBelow,uDepth,uArrival,uTime;
    void main(){vec3 ray=worldRay();vec3 air=mix(daylight(ray),vec3(.005,.022,.035),1.-smoothstep(-.05,.02,ray.y));vec3 absorption=exp(-vec3(.38,.12,.07)*uDepth);vec3 sea=vec3(.002,.007,.016)+vec3(.003,.018,.027)*max(0.,-ray.y)+vec3(.004,.011,.018)*absorption;
    if(uArrival>0.){vec3 eye=uCameraWorld[3].xyz;vec3 hit=eye+ray*((${MARINE_PLANE_Z.toFixed(1)}-eye.z)/ray.z);vec2 uv=hit.xy/vec2(${MARINE_PLANE_SIZE[0].toFixed(1)},${MARINE_PLANE_SIZE[1].toFixed(1)})+.5;sea=mix(sea,marineColor(uv,uTime,uDepth),uArrival);}
    gl_FragColor=vec4(mix(vec3(.0003,.0003,.001),mix(air,sea,uBelow),uPresence),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ camera }) => {
    const f = narrative.frame
    if (mesh.current) mesh.current.visible = f.sky > 0.001 && f.pelagic < 1
    const t = Math.max(0, Math.min(1, (f.pelagic - 0.8) / 0.2))
    material.uniforms.uArrival.value = t * t * (3 - 2 * t)
    material.uniforms.uTime.value = narrative.reducedMotion
      ? 8
      : narrative.elapsed
    material.uniforms.uPresence.value = f.sky
    material.uniforms.uBelow.value = f.submerged
    material.uniforms.uDepth.value = f.depth
    material.uniforms.uInverseProjection.value.copy(
      camera.projectionMatrixInverse,
    )
    material.uniforms.uCameraWorld.value.copy(camera.matrixWorld)
  })
  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={-100}
      frustumCulled={false}
    >
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
