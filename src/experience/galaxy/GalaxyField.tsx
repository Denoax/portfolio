import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityProfile } from '../../core/quality'
import { narrative, smoothstep } from '../../core/narrative'
import { createGalaxyGeometry, createStarGeometry } from './createGalaxy'
import { applyWebGPUHistoryDynamics } from '../webgpu/attractorCompute'
import {
  galaxyFragmentShader,
  galaxyVertexShader,
  starFragmentShader,
  starVertexShader,
} from './shaders'

interface GalaxyFieldProps {
  quality: QualityProfile
  reducedMotion: boolean
}

type FrameList = ReadonlyArray<readonly [number, number, number]>

const PORTRAIT_CAMERA: FrameList = [
  [0, 2.8, 16.5], [0, 2.2, 15], [0, 0, 17], [0, 0, 16],
  [0, 0, 17.5], [0, 0.5, 18], [0, 0, 17], [-1, 0, 15],
]
const DESKTOP_CAMERA: FrameList = [
  [0.2, 4.2, 13.5], [-0.8, 2.4, 12.2], [0, 0, 15.5], [0, 0, 13],
  [0, 0, 15], [0, 0.6, 16], [0, 0, 14.5], [-1.2, 0.2, 12.5],
]
const PORTRAIT_TARGET: FrameList = [
  [2.5, 0, 0], [1.8, 0, 0], [0, 0, 0], [0, 0, 0],
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [3.2, 0, 0],
]
const DESKTOP_TARGET: FrameList = [
  [2.7, -0.25, 0], [2.1, 0, 0], [0, 0, 0], [0, 0, 0],
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [3.5, 0, 0],
]
const PORTRAIT_GROUP: FrameList = [
  [3.8, 1.3, -2], [2.6, -0.2, -1.5], [0, -0.8, 0], [0, -0.3, 0],
  [0, -0.6, 0], [0, -0.5, 0], [0, -0.5, 0], [0, -0.4, 0],
]
const DESKTOP_GROUP: FrameList = [
  [3.7, -0.35, -1.5], [3, -1.15, -1], [1.4, 0.35, 0], [0, 0, 0],
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, -1.2, 0],
]
const GROUP_ROTATION: FrameList = [
  [-0.34, -0.3, 0.08], [-0.23, -0.12, 0.04], [0, 0, -0.04], [0, 0, 0],
  [0, 0, 0.02], [0, 0, 0], [0, 0, -0.02], [0, 0, 0],
]

export function GalaxyField({ quality, reducedMotion }: GalaxyFieldProps) {
  const group = useRef<THREE.Group>(null)
  const haze = useRef<THREE.MeshBasicMaterial>(null)
  const orbit = useRef<THREE.MeshBasicMaterial>(null)
  const pointer = useRef(new THREE.Vector2())
  const targetPointer = useRef(new THREE.Vector2())
  const desiredCamera = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
  const desiredGroup = useRef(new THREE.Vector3())
  const lookMatrix = useRef(new THREE.Matrix4())
  const desiredQuaternion = useRef(new THREE.Quaternion())
  const groupQuaternion = useRef(new THREE.Quaternion())
  const groupEuler = useRef(new THREE.Euler())
  const { gl, camera, size } = useThree()
  const geometry = useMemo(() => createGalaxyGeometry(quality.particles), [quality.particles])
  const starGeometry = useMemo(() => createStarGeometry(quality.stars), [quality.stars])
  const galaxyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: galaxyVertexShader,
        fragmentShader: galaxyFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: pointer.current },
          uPixelRatio: { value: gl.getPixelRatio() },
          uMotion: { value: reducedMotion ? 0.15 : 1 },
          uState: { value: 0 },
          uVelocity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl, reducedMotion],
  )
  const starMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        uniforms: { uPixelRatio: { value: gl.getPixelRatio() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      targetPointer.current.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      )
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  useEffect(() => {
    let active = true
    if (!quality.webgpuAvailable) {
      document.documentElement.dataset.gpuPath = 'webgl'
      return
    }
    void applyWebGPUHistoryDynamics(geometry)
      .then((enhanced) => {
        if (active) document.documentElement.dataset.gpuPath = enhanced ? 'webgpu-compute' : 'webgl'
      })
      .catch((error: unknown) => {
        if (active) {
          document.documentElement.dataset.gpuPath = 'webgl'
          document.documentElement.dataset.gpuReason = error instanceof Error ? error.message : 'unavailable'
        }
      })
    return () => {
      active = false
    }
  }, [geometry, quality.webgpuAvailable])

  useEffect(
    () => () => {
      geometry.dispose()
      starGeometry.dispose()
      galaxyMaterial.dispose()
      starMaterial.dispose()
    },
    [galaxyMaterial, geometry, starGeometry, starMaterial],
  )

  useFrame(({ clock }, delta) => {
    pointer.current.lerp(targetPointer.current, 1 - Math.exp(-delta * 2.8))
    galaxyMaterial.uniforms.uTime.value = clock.elapsedTime
    galaxyMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio()
    galaxyMaterial.uniforms.uState.value = narrative.state
    galaxyMaterial.uniforms.uVelocity.value = narrative.velocity
    starMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const portrait = size.width / size.height < 0.82
    const cameraFrames = portrait ? PORTRAIT_CAMERA : DESKTOP_CAMERA
    const targetFrames = portrait ? PORTRAIT_TARGET : DESKTOP_TARGET
    const groupFrames = portrait ? PORTRAIT_GROUP : DESKTOP_GROUP
    const segment = Math.min(6, Math.floor(narrative.state))
    const blend = smoothstep(narrative.state - segment)
    const next = Math.min(7, segment + 1)
    const interpolateFrame = (frames: FrameList, target: THREE.Vector3) => {
      target.set(
        THREE.MathUtils.lerp(frames[segment][0], frames[next][0], blend),
        THREE.MathUtils.lerp(frames[segment][1], frames[next][1], blend),
        THREE.MathUtils.lerp(frames[segment][2], frames[next][2], blend),
      )
    }

    interpolateFrame(cameraFrames, desiredCamera.current)
    interpolateFrame(targetFrames, desiredTarget.current)
    interpolateFrame(groupFrames, desiredGroup.current)
    const cameraResponse = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.3)
    camera.position.lerp(desiredCamera.current, cameraResponse)
    lookMatrix.current.lookAt(camera.position, desiredTarget.current, camera.up)
    desiredQuaternion.current.setFromRotationMatrix(lookMatrix.current)
    camera.quaternion.slerp(desiredQuaternion.current, cameraResponse)

    if (group.current) {
      group.current.position.lerp(desiredGroup.current, cameraResponse)
      groupEuler.current.set(
        THREE.MathUtils.lerp(GROUP_ROTATION[segment][0], GROUP_ROTATION[next][0], blend),
        THREE.MathUtils.lerp(GROUP_ROTATION[segment][1], GROUP_ROTATION[next][1], blend),
        THREE.MathUtils.lerp(GROUP_ROTATION[segment][2], GROUP_ROTATION[next][2], blend),
      )
      groupQuaternion.current.setFromEuler(groupEuler.current)
      group.current.quaternion.slerp(groupQuaternion.current, cameraResponse)
    }
    const galaxyPresence = 1 - smoothstep((narrative.state - 1.25) / 0.75)
    if (haze.current) haze.current.opacity = 0.022 * galaxyPresence
    if (orbit.current) orbit.current.opacity = 0.055 * galaxyPresence
    if (!reducedMotion && group.current && narrative.state < 1.2) {
      group.current.rotateY(delta * 0.0018)
    }
  })

  return (
    <group ref={group} position={[3.7, -0.35, -1.5]} rotation={[-0.34, -0.3, 0.08]}>
      <points geometry={geometry} material={galaxyMaterial} frustumCulled={false} />
      <points geometry={starGeometry} material={starMaterial} frustumCulled={false} />
      <mesh position={[0, 0, 0]} scale={[2.4, 0.48, 2.4]}>
        <sphereGeometry args={[1, 48, 24]} />
        <meshBasicMaterial
          ref={haze}
          color="#e8a15b"
          transparent
          opacity={0.022}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[6.8, 6.8, 6.8]}>
        <ringGeometry args={[0.985, 1, 192]} />
        <meshBasicMaterial ref={orbit} color="#7aa7ff" transparent opacity={0.055} depthWrite={false} />
      </mesh>
    </group>
  )
}
