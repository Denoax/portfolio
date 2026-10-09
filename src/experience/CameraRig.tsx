import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { clamp, narrative } from '../core/narrative'

// Camera poses are a pure function of displayed progress. Only this component
// writes camera transforms; pointer offset is bounded, independent of scroll.
export function CameraRig() {
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)')
    const move = (event: PointerEvent) => {
      if (fine.matches && !narrative.reducedMotion)
        pointer.set(
          clamp((event.clientX / innerWidth) * 2 - 1, -1, 1),
          clamp((event.clientY / innerHeight) * 2 - 1, -1, 1),
        )
    }
    const reset = () => pointer.set(0, 0)
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', reset)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', reset)
      window.removeEventListener('blur', reset)
    }
  }, [pointer])
  const offset = useMemo(() => new THREE.Vector2(), [])
  useFrame(({ camera }, delta) => {
    const frame = narrative.frame
    offset.lerp(pointer, 1 - Math.exp(-Math.min(delta, 0.05) * 5))
    camera.position.fromArray(frame.position)
    camera.position.x += offset.x * 0.22 * frame.pointer
    camera.position.y -= offset.y * 0.15 * frame.pointer
    if (
      !narrative.reducedMotion &&
      frame.shot === 'S06' &&
      frame.pelagic > 0.99
    )
      camera.position.y += Math.sin(narrative.elapsed * 0.1) * 0.08
    target.fromArray(frame.target)
    camera.up.fromArray(frame.up)
    camera.lookAt(target)
    const perspective = camera as THREE.PerspectiveCamera
    const fov = 43
    if (perspective.fov !== fov) {
      perspective.fov = fov
      perspective.updateProjectionMatrix()
    }
    // World-ray uniforms are sampled later in this same frame.
    camera.updateMatrixWorld()
  }, -1)
  return null
}
