import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { QualityProfile } from '../core/quality'
// A five-second window and one-way changes avoid quality oscillation. The
// startup window is ignored. Adaptation retains a live galaxy and live animal.
export function QualityController({
  quality,
  onOverload,
}: {
  quality: QualityProfile
  onOverload: () => void
}) {
  const sample = useRef({ age: 0, duration: 0, slow: 0 })
  useEffect(() => {
    sample.current = { age: 0, duration: 0, slow: 0 }
  }, [quality.tier])
  useFrame((_, delta) => {
    if (document.hidden || quality.tier === 'low') return
    const dt = Math.min(delta, 0.1),
      state = sample.current
    state.age += dt
    if (state.age < 5) return
    state.duration += dt
    if (delta > 0.027) state.slow += dt
    if (state.duration >= 5) {
      const overloaded = state.slow / state.duration > 0.6
      state.duration = 0
      state.slow = 0
      if (overloaded) {
        state.age = 0
        onOverload()
      }
    }
  })
  return null
}
