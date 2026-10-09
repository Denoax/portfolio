export type EntryPhase =
  | 'covering'
  | 'progressing'
  | 'checkpoint-brake'
  | 'checkpoint-hold'
  | 'manual-brake'
  | 'manual-hold'
  | 'resuming'
  | 'progressing-after-checkpoint'
  | 'awaiting-ready'
  | 'revealing'
  | 'complete'
export type PauseReason = 'checkpoint' | 'manual' | null
export interface EntryProgress {
  epoch: number
  phase: EntryPhase
  p: number
  age: number
  reveal: number
  reason: PauseReason
  checkpointConsumed: boolean
  pauseAge: number
  waveAmplitude: number
  waveVelocity: number
  wavePhase: number
  bounce: number
  segmentTime: number
  postTime: number
}
export const ENTRY_CHECKPOINT = 0.67
// Authored motion, not network telemetry. Zero-slope segment endpoints produce
// deliberate accelerations, slow drifts and stalls without stopping the renderer.
const before = [
  [0.08, 0.22],
  [0.23, 0.45],
  [0.236, 0.5],
  [0.236, 0.13],
  [0.44, 0.38],
  [0.57, 0.62],
  [0.61, 0.54],
  [0.666, 0.65],
  [0.67, 0.3],
] as const
const after = [
  [0.7, 0.35],
  [0.86, 0.38],
  [0.863, 0.5],
  [0.863, 0.12],
  [0.96, 0.45],
  [0.99, 0.75],
] as const
function curve(
  time: number,
  start: number,
  segments: readonly (readonly [number, number])[],
) {
  let from = start,
    remaining = time
  for (const [to, seconds] of segments) {
    if (remaining <= seconds) {
      const u = Math.max(0, remaining / seconds)
      return from + (to - from) * (u * u * (3 - 2 * u))
    }
    remaining -= seconds
    from = to
  }
  return from
}
export function createEntryProgress(epoch: number): EntryProgress {
  return {
    epoch,
    phase: 'covering',
    p: 0,
    age: 0,
    reveal: 0,
    reason: null,
    checkpointConsumed: false,
    pauseAge: 0,
    waveAmplitude: 0,
    waveVelocity: 0,
    wavePhase: 0,
    bounce: 0,
    segmentTime: 0,
    postTime: 0,
  }
}
export function entryAction(state: EntryProgress): EntryProgress {
  if (
    ['complete', 'revealing', 'resuming', 'awaiting-ready'].includes(
      state.phase,
    )
  )
    return state
  if (state.reason)
    return {
      ...state,
      reason: null,
      checkpointConsumed:
        state.checkpointConsumed || state.reason === 'checkpoint',
      phase: 'resuming',
      pauseAge: 0,
    }
  return { ...state, reason: 'manual', phase: 'manual-brake', pauseAge: 0 }
}
export function advanceEntry(
  state: EntryProgress,
  seconds: number,
  ready: boolean,
  reduced: boolean,
): EntryProgress {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.phase === 'complete')
    return state
  // The caller explicitly supplies active time. Large partitions are subdivided
  // at the same bound; hidden time is never passed by the view.
  if (seconds > 1 / 120 + 1e-9) {
    let next = state,
      remaining = Math.min(seconds, 30)
    while (remaining > 1e-9) {
      const dt = Math.min(remaining, 1 / 120)
      next = advanceEntry(next, dt, ready, reduced)
      remaining -= dt
    }
    return next
  }
  const dt = seconds,
    next = { ...state }
  next.age += dt
  next.wavePhase += dt
  if (next.reason) {
    next.pauseAge += dt
    next.phase =
      next.pauseAge < 0.28 && !reduced
        ? next.reason === 'checkpoint'
          ? 'checkpoint-brake'
          : 'manual-brake'
        : next.reason === 'checkpoint'
          ? 'checkpoint-hold'
          : 'manual-hold'
  } else if (next.phase === 'resuming') {
    next.pauseAge += dt
    if (reduced || next.pauseAge >= 0.3)
      next.phase = next.checkpointConsumed
        ? 'progressing-after-checkpoint'
        : 'progressing'
  } else if (next.phase === 'revealing') {
    next.reveal = Math.min(1, next.reveal + dt / (reduced ? 0.15 : 0.38))
    if (next.reveal === 1) next.phase = 'complete'
  } else if (next.age >= 0.18) {
    if (!next.checkpointConsumed) {
      next.segmentTime += dt * (reduced ? 8 : 1)
      next.p = curve(next.segmentTime, 0, before)
      if (next.p >= ENTRY_CHECKPOINT) {
        next.p = ENTRY_CHECKPOINT
        next.reason = 'checkpoint'
        next.phase = reduced ? 'checkpoint-hold' : 'checkpoint-brake'
        next.pauseAge = 0
      } else next.phase = 'progressing'
    } else {
      next.postTime += dt * (reduced ? 8 : 1)
      next.p = curve(next.postTime, ENTRY_CHECKPOINT, after)
      next.phase =
        next.p >= 0.99 ? 'awaiting-ready' : 'progressing-after-checkpoint'
      if (next.p >= 0.99 && ready) {
        next.p = 1
        next.phase = 'revealing'
      }
    }
  }
  const age = next.pauseAge
  next.bounce =
    next.reason && !reduced && age < 0.28
      ? Math.sin((age / 0.28) * Math.PI * 2) * Math.exp(-age * 10)
      : 0
  const target = Number(Boolean(next.reason))
  if (reduced) {
    next.waveAmplitude = target
    next.waveVelocity = 0
  } else {
    const omega = 18,
      offset = next.waveAmplitude - target,
      a = next.waveVelocity + omega * offset,
      e = Math.exp(-omega * dt)
    next.waveAmplitude = target + (offset + a * dt) * e
    next.waveVelocity = (next.waveVelocity - omega * a * dt) * e
  }
  return next
}
