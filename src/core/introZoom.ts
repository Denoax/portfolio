export interface IntroZoom {
  octave: bigint
  phase: number
}
export function advanceZoom(state: IntroZoom, delta: number): IntroZoom {
  if (!Number.isFinite(delta)) throw new Error('Finite zoom input required')
  const total = state.phase + delta,
    whole = Math.floor(total)
  if (!Number.isSafeInteger(whole))
    throw new Error('Zoom input exceeds event range')
  return { octave: state.octave + BigInt(whole), phase: total - whole }
}
export function boundedZoom(state: IntroZoom, period = 6) {
  if (!Number.isSafeInteger(period) || period < 1)
    throw new Error('Positive integer projection period required')
  const modulus = BigInt(period)
  return Number(((state.octave % modulus) + modulus) % modulus) + state.phase
}
