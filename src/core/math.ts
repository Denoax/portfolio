export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function smoothstep(value: number) {
  const clamped = clamp(value)
  return clamped * clamped * (3 - 2 * clamped)
}
