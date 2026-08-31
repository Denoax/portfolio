export const narrative = {
  target: 0,
  progress: 0,
  state: 0,
  velocity: 0,
  active: 0,
  reducedMotion: false,
}

export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function smoothstep(value: number) {
  const clamped = clamp(value)
  return clamped * clamped * (3 - 2 * clamped)
}
