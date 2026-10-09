import { useFrame } from '@react-three/fiber'
// Priority 2 follows DescentComposite's final default-framebuffer render at 1.
// This observes output; it does not render, clear, or modify the protected scene.
export function WorldFrameObserver({
  enabled,
  onFrame,
}: {
  enabled: boolean
  onFrame: () => void
}) {
  useFrame(({ gl }) => {
    if (enabled && !document.hidden && !gl.getContext().isContextLost())
      onFrame()
  }, 2)
  return null
}
