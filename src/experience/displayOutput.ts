import * as THREE from 'three'

export const BASE_EXPOSURE = 0.9
// Three r180 already defaults to sRGB. Pin the contract explicitly so output
// ownership survives future renderer changes; never grade already encoded DOM.
export function configureDisplayOutput(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = BASE_EXPOSURE
  const context = renderer.getContext()
  if ('drawingBufferColorSpace' in context)
    context.drawingBufferColorSpace = 'srgb'
}
