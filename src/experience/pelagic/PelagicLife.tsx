import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { narrative } from '../../core/narrative'
import type { QualityProfile } from '../../core/quality'
import { LivingAppendages } from './original/LivingAppendages.js'

class PelagicAdapter {
  group = new THREE.Group()
  private current = new THREE.Vector2()
  private animals: { pose: THREE.Object3D; anatomy: LivingAppendages }[] = []
  constructor(quality: QualityProfile) {
    this.group.name = 'original-pelagic-live-scene'
    for (let i = 0; i < (quality.tier === 'low' ? 1 : 3); i++) {
      const pose = new THREE.Object3D()
      const anatomy = new LivingAppendages({ transformationObject: pose }, i, {
        fidelity: i ? 'companion' : 'hero',
        improved: i === 0,
      })
      this.group.add(anatomy.group)
      this.animals.push({ pose, anatomy })
    }
  }
  update(
    delta: number,
    elapsed: number,
    mobile: boolean,
    short: boolean,
  ) {
    const presence = narrative.frame.pelagic
    this.group.visible = presence > 0.005
    if (!this.group.visible) return
    this.current.set(
      Math.sin(elapsed * 0.18) * 0.12,
      Math.cos(elapsed * 0.13) * 0.1,
    )
    for (let i = 0; i < this.animals.length; i++) {
      const { pose, anatomy } = this.animals[i]
      if (i === 0) {
        pose.position.set(
          (mobile ? 0 : 3.1) + Math.sin(elapsed * 0.12) * 0.24,
          (mobile ? (short ? 2.5 : 2.0) : 1.8) +
            Math.sin(elapsed * 0.26) * 0.18,
          0.2 + Math.cos(elapsed * 0.12) * 0.15,
        )
        pose.rotation.set(
          0.18,
          -0.4 + Math.sin(elapsed * 0.08) * 0.12,
          -0.16 + Math.sin(elapsed * 0.15) * 0.06,
        )
        pose.scale.setScalar(mobile ? (short ? 0.6 : 0.84) : 1.22)
      } else {
        pose.position.set(
          (i === 1 ? -4.4 : 5.3) + Math.sin(elapsed * 0.11 + i) * 0.45,
          i === 1 ? 0.8 : 4.1,
          i === 1 ? -5 : -7,
        )
        pose.rotation.set(0.1, i * 0.8, i === 1 ? 0.16 : -0.3)
        pose.scale.setScalar(mobile ? 0.42 : 0.62)
      }
      anatomy.setPresence(presence * (i ? 0.58 : 1), i ? 0.2 : 1)
      anatomy.update(Math.min(delta, 1 / 30), elapsed, this.current)
    }
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const material = object.material
      if (material instanceof THREE.ShaderMaterial && material.uniforms.uTime)
        material.uniforms.uTime.value = elapsed
    })
  }
  dispose() {
    this.animals.forEach((animal) => animal.anatomy.dispose())
    this.group.removeFromParent()
  }
}
export function PelagicLife({ quality }: { quality: QualityProfile }) {
  const { scene, size } = useThree()
  const adapter = useRef<PelagicAdapter | null>(null)
  useEffect(() => {
    const world = new PelagicAdapter(quality)
    adapter.current = world
    scene.add(world.group)
    return () => {
      adapter.current = null
      world.dispose()
    }
  }, [quality, scene])
  useFrame(
    (_, delta) =>
      !document.hidden &&
      adapter.current?.update(
        delta,
        narrative.reducedMotion ? 8 : narrative.elapsed,
        size.width < 720,
        size.height < 700,
      ),
  )
  return null
}
