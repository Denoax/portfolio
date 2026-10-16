export const RIPPLE_SLOTS = 4
export const RIPPLE_LIFETIME = 12
export const SNAP_LIFETIME = 0.65
export interface IntroRipple {
  id: number
  startedAt: number
  active: boolean
}
export interface IntroRipples {
  sequence: number
  snapSequence: number
  snapStartedAt: number | null
  slots: IntroRipple[]
}
export const createIntroRipples = (): IntroRipples => ({
  sequence: 0,
  snapSequence: 0,
  snapStartedAt: null,
  slots: Array.from({ length: RIPPLE_SLOTS }, () => ({
    id: 0,
    startedAt: 0,
    active: false,
  })),
})

export function pruneIntroRipples(state: IntroRipples, now: number) {
  for (const slot of state.slots)
    if (slot.active && now - slot.startedAt >= RIPPLE_LIFETIME)
      slot.active = false
}
export function admitIntroRipple(
  state: IntroRipples,
  now: number,
): number | null {
  if (!Number.isFinite(now) || now < 0) return null
  pruneIntroRipples(state, now)
  const slot = state.slots.find((s) => !s.active)
  if (!slot) return null // Live older waves survive saturation; never queue audio.
  slot.id = ++state.sequence
  slot.startedAt = now
  slot.active = true
  return slot.id
}
export function clearIntroRipples(state: IntroRipples) {
  // Keep sequence monotonic so audio IDs cannot be replayed after an art reset.
  for (const slot of state.slots) slot.active = false
  state.snapStartedAt = null
}
// A short release impact has its own lifetime, independent of the four older
// travelling waves. Saturation must not suppress a new snap or replay old ones.
export function admitIntroSnap(state: IntroRipples, now: number, animate = true): number | null {
  if (!Number.isFinite(now) || now < 0) return null
  state.snapStartedAt = animate ? now : null
  return ++state.snapSequence
}
export function snapEnvelope(age: number) {
  if (!Number.isFinite(age) || age < 0 || age >= SNAP_LIFETIME) return 0
  const end = Math.max(0, Math.min(1, (age - 0.45) / 0.2))
  return Math.sin(age * 28) * Math.exp(-age * 7.5) * (1 - end * end * (3 - 2 * end))
}
export function rippleEnvelope(age: number, radius: number) {
  if (age < 0) return 0
  const local = Math.max(0, age - radius * 0.65)
  return (1 - Math.exp(-local * 4)) * Math.exp(-local * 1.2)
}
export function boundRippleEnergy(energy: number) {
  // Single wave peaks below .5. The original envelope is unchanged until .65;
  // the combined field then has a continuous slope and a bounded .95 limit.
  return energy <= 0.65
    ? energy
    : 0.65 + 0.3 * (1 - Math.exp(-(energy - 0.65) / 0.3))
}
