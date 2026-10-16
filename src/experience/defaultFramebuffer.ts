import type { WebGLRenderer } from 'three'

// The browser may allocate a smaller default framebuffer than canvas.width /
// height (for example after allocation pressure). Three's requested size is
// not the allocated size. A full requested viewport then crops and enlarges
// every GL layer when the browser stretches that smaller buffer to the page.
export function bindDefaultFramebuffer(renderer: WebGLRenderer) {
  const context = renderer.getContext()
  const ratio = renderer.getPixelRatio()
  renderer.setRenderTarget(null)
  // Three accepts logical units here and applies its pixel ratio internally.
  renderer.setViewport(
    0,
    0,
    context.drawingBufferWidth / ratio,
    context.drawingBufferHeight / ratio,
  )
}
