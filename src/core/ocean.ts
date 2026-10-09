// Geometry and signed lens height share one wave table. Fine normal detail is
// shading only and cannot change the actual crossing position.
export const OCEAN_WAVES = [
  { x: 0.48, z: 0.22, speed: 0.54, amplitude: 0.19 },
  { x: 0.93, z: -0.36, speed: -0.39, amplitude: 0.115 },
  { x: -0.31, z: 0.67, speed: 0.31, amplitude: 0.075 },
  { x: 1.7, z: 0.82, speed: -0.7, amplitude: 0.04 },
  { x: -2.1, z: 1.4, speed: 0.81, amplitude: 0.02 },
  { x: 0.26, z: 0.11, speed: 0.36, amplitude: 0.13 },
  { x: 0.74, z: 0.3, speed: 0.68, amplitude: 0.06 },
] as const
export const SUN_DIRECTION = [0.48, 0.72, 0.5] as const
export function waveHeight(x: number, z: number, time: number) {
  return OCEAN_WAVES.reduce(
    (height, wave) =>
      height +
      Math.sin(x * wave.x + z * wave.z + time * wave.speed) * wave.amplitude,
    0,
  )
}
const literal = (value: number) =>
  Number.isInteger(value) ? `${value}.0` : `${value}`
export const waveGLSL = `vec3 wave(vec2 p,float time){float height=0.;vec2 slope=vec2(0.);${OCEAN_WAVES.map((w) => `{vec2 k=vec2(${literal(w.x)},${literal(w.z)});float phase=dot(p,k)+time*${literal(w.speed)};height+=sin(phase)*${literal(w.amplitude)};slope+=cos(phase)*${literal(w.amplitude)}*k;}`).join('')}return vec3(height,slope);}`

export const sunGLSL = `vec3(${SUN_DIRECTION.map(literal).join(',')})`
