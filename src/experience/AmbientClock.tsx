import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { narrative } from '../core/narrative'
// One ambient clock for all worlds. Hidden tabs do not advance living motion,
// and the first resumed frame cannot feed a multi-second delta to simulation.
export function AmbientClock() {
  useEffect(() => {
    narrative.elapsed = 0
  }, [])
  useFrame((_, delta) => {
    if (!document.hidden) narrative.elapsed += Math.min(delta, 0.05)
  }, -2)
  return null
}
