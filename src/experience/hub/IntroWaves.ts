import * as THREE from 'three'
import type { MenuPresentation } from '../../core/menuReel'

// Adapted from Tom Hinton — #WCCChallenge : Waves (MIT).
// https://codepen.io/TomHinton/pen/EajJrBd
// Complete notice: public/licenses/Tom-Hinton-Waves-MIT.md.
const waveField = `
void coswarp(inout vec3 trip, float scale, float time) {
  trip += scale * .1 * cos(3. * trip.yzx + time * .25);
  trip += scale * .05 * cos(11. * trip.yzx + time * .25);
  trip += scale * .025 * cos(17. * trip.yzx + time * .25);
}
float periodicCellRadius(vec2 p) {
  // Squared sine is periodic in each axis, including matching boundary slopes.
  // The small radial floor also keeps the derivative finite at cell corners.
  vec2 s = sin(3.141592653589793 * p);
  return sqrt(dot(s, s) + .0001);
}
float softOrientedRamp(float edge0, float edge1, float x) {
  float delta = edge1 - edge0;
  float midpoint = .5 * (edge0 + edge1);
  float footprint = max(fwidth(x - midpoint), .0001);
  float halfWidth = max(.5 * abs(delta), 1.25 * footprint);
  float up = smoothstep(midpoint - halfWidth, midpoint + halfWidth, x);
  // A signed near-zero ramp otherwise flips abruptly as its edges cross.
  return mix(1. - up, up, smoothstep(-.035, .035, delta));
}
float tomHintonWaves(vec2 coord, vec2 resolution, float time) {
  vec2 uv = (coord - resolution * .5) / max(resolution.y, 1.) + .5;
  float t = time * .2 + periodicCellRadius((uv - .5) * uWaveCellFrequency);
  float t2 = time * .1 + periodicCellRadius((uv - .5) * uWaveCellFrequency * 2.);
  vec2 original = uv;
  vec3 warp = vec3(uv, 1.);
  coswarp(warp, 3., time);
  uv += warp.rg;
  vec3 color = vec3(0., .5, original.x);
  color.r = sin(time * .2) + sin(length(uv - .5) * 10.);
  color.g = sin(time * .3) + sin(length(uv - .5) * 20.);
  coswarp(color, 3., time);
  return softOrientedRamp(color.r, sin(t2), sin(t));
}`

export class IntroWaves {
  private readonly darkBase = new THREE.Color('#050607')
  private readonly darkCrest = new THREE.Color('#151920')
  private readonly lightBase = new THREE.Color('#fafbfd')
  private readonly lightCrest = new THREE.Color('#e4e9ef')
  private ready = false
  readonly geometry = new THREE.PlaneGeometry(2, 2)
  readonly material = new THREE.ShaderMaterial({
    name: 'IntroWaves-TomHinton',
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uWaveTime: { value: 0 },
      uWaveResolution: { value: new THREE.Vector2(1, 1) },
      uWaveVisibility: { value: 0 },
      uWaveBase: { value: new THREE.Color() },
      uWaveCrest: { value: new THREE.Color() },
      uWaveBrightness: { value: 1 },
      uWaveCellFrequency: { value: 900 / 48 },
    },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform float uWaveTime,uWaveVisibility,uWaveBrightness,uWaveCellFrequency;
      uniform vec2 uWaveResolution;
      uniform vec3 uWaveBase,uWaveCrest;
      ${waveField}
      void main() {
        float field = tomHintonWaves(gl_FragCoord.xy,uWaveResolution,uWaveTime);
        gl_FragColor = vec4(mix(uWaveBase,uWaveCrest,field)*uWaveBrightness,uWaveVisibility);
        #include <colorspace_fragment>
      }`,
  })
  readonly mesh = new THREE.Mesh(this.geometry, this.material)

  constructor() {
    this.mesh.name = 'IntroWaves-TomHinton-backdrop'
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    this.mesh.raycast = () => {}
  }

  async prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    // Optional decoration must never join the foreground's readiness gate.
    try {
      const scene = new THREE.Scene()
      scene.add(this.mesh.clone())
      await renderer.compileAsync(scene, camera)
      const program = renderer.info.programs?.find(p => p.name === this.material.name)
      const context = renderer.getContext()
      if (!program || !context.getProgramParameter(program.program, context.LINK_STATUS))
        throw new Error('Wave material did not link')
      this.ready = true
    } catch (error) {
      console.warn('Optional intro waves unavailable; using the plain backdrop.', error)
    }
  }

  update(intro: MenuPresentation['intro'], clock: number, themeMix: number,
    bufferWidth: number, bufferHeight: number, brightness: number, cssHeight: number) {
    this.mesh.visible = this.ready && intro.active && intro.exitProgress < 1
    if (!this.mesh.visible) return
    const uniforms = this.material.uniforms
    // HubScene's visibility-aware active clock already freezes for less motion.
    // Keep the shared phase unwrapped: float rounding around the source's very
    // narrow signed ramps can expose a few pixels at a mathematical-period wrap.
    uniforms.uWaveTime.value = clock
    uniforms.uWaveResolution.value.set(bufferWidth, bufferHeight)
    // Composition uses CSS pixels; the real buffer remains the sampling owner.
    uniforms.uWaveCellFrequency.value = cssHeight / 48
    uniforms.uWaveVisibility.value = 1 - intro.exitProgress
    uniforms.uWaveBase.value.copy(this.darkBase).lerp(this.lightBase, themeMix)
    uniforms.uWaveCrest.value.copy(this.darkCrest).lerp(this.lightCrest, themeMix)
    uniforms.uWaveBrightness.value = brightness / 100
  }

  dispose() {
    this.ready = false
    this.mesh.visible = false
    this.material.dispose()
    this.geometry.dispose()
  }
}
