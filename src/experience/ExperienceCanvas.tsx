import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { GalaxyField } from './galaxy/GalaxyField'

interface ExperienceCanvasProps {
  quality: QualityProfile
  reducedMotion: boolean
  onReady: () => void
}

function SceneReady({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    let cancelled = false
    const compile = async () => {
      await gl.compileAsync(scene, camera)
      gl.render(scene, camera)
      if (!cancelled) requestAnimationFrame(onReady)
    }
    void compile()
    return () => {
      cancelled = true
    }
  }, [camera, gl, onReady, scene])
  return null
}

export function ExperienceCanvas({ quality, reducedMotion, onReady }: ExperienceCanvasProps) {
  return (
    <div className="experience-canvas" aria-hidden="true">
      <Canvas
        dpr={quality.dpr}
        camera={{ position: [0.2, 4.2, 13.5], fov: 41, near: 0.1, far: 140 }}
        gl={{
          antialias: quality.tier !== 'low',
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#020205', 1)
          camera.lookAt(2.7, -0.25, 0)
        }}
      >
        <GalaxyField quality={quality} reducedMotion={reducedMotion} />
        <SceneReady onReady={onReady} />
      </Canvas>
    </div>
  )
}
