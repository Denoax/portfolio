import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
// Authored underwater key lobe, matching the original tissue's analytic envNode.
// A tiny PMREM supplies native WebGL physical materials with the same light role.
export function OceanLighting() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const width = 128,
      height = 64,
      data = new Float32Array(width * height * 4)
    const key = new THREE.Vector3(0.32, 0.94, 0.12).normalize(),
      direction = new THREE.Vector3()
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const phi = ((y + 0.5) / height) * Math.PI,
          theta = ((x + 0.5) / width) * Math.PI * 2
        direction.set(
          -Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        )
        const lobe = Math.pow(Math.max(0, direction.dot(key)), 8),
          i = (y * width + x) * 4
        data[i] = 0.02 + 0.48 * lobe
        data[i + 1] = 0.035 + 0.61 * lobe
        data[i + 2] = 0.05 + 0.65 * lobe
        data[i + 3] = 1
      }
    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    texture.mapping = THREE.EquirectangularReflectionMapping
    texture.colorSpace = THREE.LinearSRGBColorSpace
    texture.needsUpdate = true
    const generator = new THREE.PMREMGenerator(gl),
      target = generator.fromEquirectangular(texture)
    const previous = scene.environment
    scene.environment = target.texture
    scene.environmentIntensity = 1
    texture.dispose()
    generator.dispose()
    return () => {
      scene.environment = previous
      target.dispose()
    }
  }, [gl, scene])
  return null
}
