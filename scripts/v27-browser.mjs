import { chromium } from 'playwright'
// Keep explicit software rendering for reproducing the original v27 captures.
// Opt into native GL with V27_NATIVE_GL=1 and record the actual renderer identity;
// browser rendering evidence does not establish physical-display approval.
export const launchCaptureBrowser = () => chromium.launch({
  headless: true,
  args: process.env.V27_NATIVE_GL === '1'
    ? ['--use-angle=gl', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
export const rendererIdentity = page => page.evaluate(() => {
  const gl = document.querySelector('canvas')?.getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return { userAgent: navigator.userAgent, renderer: gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    gpuTimers: !!gl?.getExtension('EXT_disjoint_timer_query_webgl2'), hardwareApproval: 'UNVERIFIED' }
})
