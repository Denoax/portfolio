import { advanceZoom, boundedZoom } from './introZoom'
import type { MenuPresentation } from './menuReel'

export type IntroDirection = -1 | 1
export type IntroTransportState =
  | 'AUTO_OUT'
  | 'AUTO_IN'
  | 'COASTING'
  | 'BRAKING'
  | 'HELD'
  | 'SHUFFLE'
  | 'WAIT'
  | 'EXITING'

export const INTRO_HOLD_SECONDS = 0.26
export const INTRO_AUTO_RATE = 0.065
export const INTRO_SHUFFLE_SECONDS = 0.45
export const INTRO_WAIT_SECONDS = 0.26
const BRAKE_SECONDS = 0.12
const MANUAL_IDLE_SECONDS = 0.7
const WHEEL_COAST_SECONDS = 2
const WHEEL_RESPONSE_SECONDS = 0.15
const WHEEL_IMPULSE_PER_PIXEL = 1 / 3000 // 120 normalized CSS px adds .04.
const WHEEL_SPEED_RANGE = 0.65
const WHEEL_MOMENTUM_LIMIT = 0.9 // Bound latent energy, not ordinary speed.
const MAX_WHEEL_PACKET_PIXELS = 10000
const WHEEL_STEP_SECONDS = 1 / 240
const VELOCITY_EASING_SECONDS = 0.055
const ANGULAR_PERIOD = Math.PI * 2000

export interface IntroTransport {
  state: IntroTransportState
  lastDirection: IntroDirection
  gestureSequence: number
  activeGesture: number | null
  gestureAge: number
  releaseToken: number
  committedToken: number
  pendingDirection: IntroDirection | null
  brakeAge: number
  brakeStartVelocity: number
  angularTime: number
  shuffleAmount: number
  shuffleAge: number
  shuffleSeed: number
  settleAmount: number
  settleAge: number
  waitAge: number
  manualActive: boolean
  manualIdle: number
  wheelMomentum: number // Signed input reservoir; COASTING never adds automatic torque.
}

export function createIntroTransport(): IntroTransport {
  return {
    state: 'AUTO_OUT',
    lastDirection: -1,
    gestureSequence: 0,
    activeGesture: null,
    gestureAge: 0,
    releaseToken: 0,
    committedToken: 0,
    pendingDirection: null,
    brakeAge: 0,
    brakeStartVelocity: 0,
    angularTime: 0,
    shuffleAmount: 0,
    shuffleAge: 0,
    shuffleSeed: 0,
    settleAmount: 0,
    settleAge: 0,
    waitAge: 0,
    manualActive: false,
    manualIdle: MANUAL_IDLE_SECONDS,
    wheelMomentum: 0,
  }
}

type Intro = MenuPresentation['intro']
const autoState = (direction: IntroDirection): IntroTransportState =>
  direction < 0 ? 'AUTO_OUT' : 'AUTO_IN'
const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value))
  return x * x * (3 - 2 * x)
}

// Event handlers only submit intent. Ringwriter.update remains the only owner
// advancing visible position, active-time deadlines and the shuffle envelope.
export function cancelIntroTransport(intro: Intro) {
  const transport = intro.transport
  transport.activeGesture = null
  transport.pendingDirection = null
  transport.state = transport.state === 'COASTING' ? 'COASTING' : autoState(transport.lastDirection)
  transport.gestureAge = 0
  transport.settleAmount = transport.shuffleAmount
  transport.settleAge = 0
  transport.waitAge = 0
  intro.holding = false
  intro.zoomDelta = 0
  intro.zoomReset = intro.resetActive = false
  intro.ripples.snapStartedAt = null
  transport.manualActive = false
  transport.wheelMomentum = 0
}

export function beginIntroGesture(intro: Intro): number | null {
  if (intro.exiting || intro.inputBlocked) return null
  cancelIntroTransport(intro)
  const transport = intro.transport
  const token = ++transport.gestureSequence
  transport.activeGesture = token
  transport.gestureAge = 0
  transport.brakeAge = 0
  transport.brakeStartVelocity = intro.zoomVelocity
  transport.state = 'BRAKING'
  intro.holding = true
  return token
}

export function releaseIntroGesture(
  intro: Intro,
  token: number,
  seconds: number,
  moved: boolean,
  motion: boolean,
): 'ignored' | 'enter' | 'ripple' | 'reverse' {
  const transport = intro.transport
  if (transport.activeGesture !== token || intro.exiting) return 'ignored'
  transport.activeGesture = null
  transport.gestureAge = Math.max(transport.gestureAge, seconds)
  intro.holding = false
  if (seconds < INTRO_HOLD_SECONDS) {
    cancelIntroTransport(intro)
    return moved ? 'ripple' : 'enter'
  }
  if (!motion || intro.paused) {
    cancelIntroTransport(intro)
    return 'ripple'
  }
  transport.releaseToken = token
  transport.pendingDirection = transport.lastDirection === -1 ? 1 : -1
  transport.state = 'SHUFFLE'
  transport.shuffleAge = 0
  transport.shuffleAmount = 0
  transport.settleAmount = 0
  transport.waitAge = 0
  // One stable seed per deliberate gesture; the shader never resamples noise.
  transport.shuffleSeed = (Math.imul(token, 2654435761) >>> 0) % 1024
  transport.brakeAge = 0
  transport.brakeStartVelocity = intro.zoomVelocity
  return 'reverse'
}

export function requestIntroZoom(intro: Intro, delta: number) {
  if (
    !Number.isFinite(delta) ||
    intro.holding ||
    intro.exiting ||
    intro.inputBlocked
  )
    return
  intro.zoomDelta += delta
  intro.transport.wheelMomentum = 0
  if (intro.transport.state === 'COASTING')
    intro.transport.state = autoState(intro.transport.lastDirection)
  intro.transport.manualActive = true
  intro.transport.manualIdle = 0
}

// WheelEvent units are normalized once at the DOM boundary. Reject corrupted
// spikes rather than turning an invalid packet into a maximum-strength gesture.
export function normalizeIntroWheel(delta: number, mode: number, lineHeight: number, pageHeight: number) {
  const unit = mode === 0 ? 1 : mode === 1 ? lineHeight : mode === 2 ? pageHeight : NaN
  const pixels = -delta * unit
  return Number.isFinite(pixels) && unit > 0 && Math.abs(pixels) <= MAX_WHEEL_PACKET_PIXELS ? pixels : 0
}

export function requestIntroScroll(intro: Intro, pixels: number) {
  const transport = intro.transport
  if (
    !Number.isFinite(pixels) || pixels === 0 || Math.abs(pixels) > MAX_WHEEL_PACKET_PIXELS ||
    intro.paused || intro.holding || intro.exiting || intro.inputBlocked ||
    !['AUTO_IN', 'AUTO_OUT', 'COASTING'].includes(transport.state)
  ) return
  if (transport.state !== 'COASTING') {
    // Preserve actual displayed velocity on takeover, including a true rest.
    const range = Math.tanh(WHEEL_MOMENTUM_LIMIT / WHEEL_SPEED_RANGE)
    transport.wheelMomentum = WHEEL_SPEED_RANGE * Math.atanh(
      Math.max(-range, Math.min(range, intro.zoomVelocity / WHEEL_SPEED_RANGE)))
  }
  transport.wheelMomentum = Math.max(-WHEEL_MOMENTUM_LIMIT, Math.min(WHEEL_MOMENTUM_LIMIT,
    transport.wheelMomentum + pixels * WHEEL_IMPULSE_PER_PIXEL))
  transport.state = 'COASTING'
  transport.manualActive = false
  intro.zoomDelta = 0
  intro.zoomReset = intro.resetActive = false
  // Direction changes only when the displayed velocity crosses zero in step.
}

export function requestIntroReset(intro: Intro) {
  if (intro.holding || intro.exiting || intro.inputBlocked) return
  intro.zoomReset = true
  intro.transport.wheelMomentum = 0
  if (intro.transport.state === 'COASTING')
    intro.transport.state = autoState(intro.transport.lastDirection)
  intro.transport.manualActive = true
  intro.transport.manualIdle = 0
}

export function resetIntroTransport(intro: Intro) {
  Object.assign(intro.transport, createIntroTransport())
  intro.zoom = { octave: 0n, phase: 0 }
  intro.zoomVelocity = intro.zoomDelta = intro.resetDistance = 0
  intro.zoomReset = intro.resetActive = intro.holding = false
}

export function exitIntroTransport(intro: Intro) {
  cancelIntroTransport(intro)
  intro.transport.state = 'EXITING'
  intro.transport.brakeAge = 0
  intro.transport.brakeStartVelocity = intro.zoomVelocity
}

function brakeStep(intro: Intro, seconds: number) {
  const transport = intro.transport
  const before = Math.min(1, transport.brakeAge / BRAKE_SECONDS)
  transport.brakeAge += seconds
  const after = Math.min(1, transport.brakeAge / BRAKE_SECONDS)
  // Integral of 1-smoothstep(t), so the displayed position and velocity remain
  // continuous at press, at the stationary hold and across frame-rate changes.
  const integral = (x: number) => x - x ** 3 + 0.5 * x ** 4
  intro.zoomVelocity =
    after === 1 ? 0 : transport.brakeStartVelocity * (1 - smooth(after))
  return (
    transport.brakeStartVelocity *
    BRAKE_SECONDS *
    (integral(after) - integral(before))
  )
}

function manualStep(intro: Intro, seconds: number) {
  if (intro.zoomReset) {
    intro.zoomReset = false
    intro.zoomDelta = 0
    intro.resetActive = true
    const period = intro.loopPeriod
    intro.resetDistance =
      ((-boundedZoom(intro.zoom, period) + period * 1.5) % period) -
      period * 0.5
  }
  if (intro.resetActive && intro.zoomDelta !== 0) intro.resetActive = false
  const distance = intro.resetActive ? intro.resetDistance : intro.zoomDelta
  const omega = intro.resetActive ? 18 : 14
  const error = -distance
  const c = intro.zoomVelocity + omega * error
  const decay = Math.exp(-omega * seconds)
  const step = distance + (error + c * seconds) * decay
  intro.zoomVelocity = (intro.zoomVelocity - omega * c * seconds) * decay
  if (intro.resetActive) intro.resetDistance -= step
  else intro.zoomDelta -= step
  return step
}

function wheelStep(intro: Intro, seconds: number) {
  const transport = intro.transport
  const count = Math.ceil(seconds / WHEEL_STEP_SECONDS), h = seconds / count
  const halfDecay = Math.exp(-h / (2 * WHEEL_COAST_SECONDS))
  const target = (m: number) => WHEEL_SPEED_RANGE * Math.tanh(m / WHEEL_SPEED_RANGE)
  let distance = 0
  for (let i = 0; i < count; i++) {
    const m = transport.wheelMomentum, v = intro.zoomVelocity
    // Exact reservoir decay with fourth-order integration of response/travel.
    // At most 24 bounded substeps; no hidden-tab catch-up or frame accumulator.
    const mid = target(m * halfDecay), end = target(m * halfDecay * halfDecay)
    const k1 = (target(m) - v) / WHEEL_RESPONSE_SECONDS
    const k2 = (mid - (v + k1 * h / 2)) / WHEEL_RESPONSE_SECONDS
    const k3 = (mid - (v + k2 * h / 2)) / WHEEL_RESPONSE_SECONDS
    const k4 = (end - (v + k3 * h)) / WHEEL_RESPONSE_SECONDS
    distance += h * (v + 2 * (v + k1 * h / 2) + 2 * (v + k2 * h / 2) + (v + k3 * h)) / 6
    intro.zoomVelocity += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
    transport.wheelMomentum = m * halfDecay * halfDecay
  }
  if (Math.abs(transport.wheelMomentum) < 1e-7 && Math.abs(intro.zoomVelocity) < 1e-7) {
    transport.wheelMomentum = intro.zoomVelocity = 0
  }
  if (Math.abs(intro.zoomVelocity) > 1e-8)
    transport.lastDirection = intro.zoomVelocity < 0 ? -1 : 1
  return distance
}

export function stepIntroZoom(
  intro: Intro,
  seconds: number,
) {
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    intro.paused ||
    intro.inputBlocked
  )
    return
  seconds = Math.min(seconds, 0.1) // Active-time guard; never replay a stalled frame.
  const transport = intro.transport
  let step = 0
  if (transport.settleAmount > 0 && transport.state !== 'SHUFFLE') {
    transport.settleAge += seconds
    transport.shuffleAmount =
      transport.settleAmount * (1 - smooth(transport.settleAge / BRAKE_SECONDS))
    if (transport.settleAge >= BRAKE_SECONDS) transport.settleAmount = 0
  }
  if (transport.state === 'BRAKING' || transport.state === 'HELD') {
    transport.gestureAge += seconds
    step = brakeStep(intro, seconds)
    if (transport.gestureAge >= INTRO_HOLD_SECONDS)
      transport.state = 'HELD'
  } else if (transport.state === 'EXITING') {
    step = brakeStep(intro, seconds)
  } else {
    if (transport.state === 'SHUFFLE') {
      transport.shuffleAge += seconds
      const phase = Math.min(1, transport.shuffleAge / INTRO_SHUFFLE_SECONDS)
      transport.shuffleAmount = Math.sin(Math.PI * phase) ** 2
      if (phase === 1) {
        transport.shuffleAmount = 0
        transport.state = 'WAIT'
        transport.waitAge = Math.max(
          0,
          transport.shuffleAge - INTRO_SHUFFLE_SECONDS,
        )
      }
    } else if (transport.state === 'WAIT') {
      transport.waitAge += seconds
      if (transport.waitAge >= INTRO_WAIT_SECONDS) {
        if (
          transport.pendingDirection !== null &&
          transport.releaseToken !== transport.committedToken
        ) {
          transport.lastDirection = transport.pendingDirection
          transport.committedToken = transport.releaseToken
        }
        transport.pendingDirection = null
        transport.state = autoState(transport.lastDirection)
      }
    }
    if (transport.manualActive) {
      transport.manualIdle += seconds
      step = manualStep(intro, seconds)
      if (
        transport.manualIdle >= MANUAL_IDLE_SECONDS &&
        Math.abs(intro.zoomDelta) < 1e-4 &&
        !intro.resetActive
      )
        transport.manualActive = false
    } else if (transport.state === 'SHUFFLE' || transport.state === 'WAIT') {
      step = brakeStep(intro, seconds)
    } else if (transport.state === 'COASTING') {
      step = wheelStep(intro, seconds)
    } else {
      const target = transport.lastDirection * INTRO_AUTO_RATE
      const decay = Math.exp(-seconds / VELOCITY_EASING_SECONDS)
      step = target * seconds +
        (intro.zoomVelocity - target) * VELOCITY_EASING_SECONDS * (1 - decay)
      intro.zoomVelocity = target + (intro.zoomVelocity - target) * decay
    }
  }
  intro.zoom = advanceZoom(intro.zoom, step)
  transport.angularTime =
    (((transport.angularTime + step / INTRO_AUTO_RATE) % ANGULAR_PERIOD) +
      ANGULAR_PERIOD) %
    ANGULAR_PERIOD
  if (intro.resetActive) {
    if (
      Math.abs(intro.resetDistance) < 1e-5 &&
      Math.abs(intro.zoomVelocity) < 1e-4
    ) {
      intro.zoom = { octave: 0n, phase: 0 }
      intro.resetActive = false
      intro.resetDistance = 0
      intro.zoomVelocity = 0
    }
  }
}

export function hintOpacity(age: number) {
  const smooth = (x: number) => {
    x = Math.max(0, Math.min(1, x))
    return x * x * (3 - 2 * x)
  }
  if (age < 0.45) return 0
  if (age < 1.65) return smooth((age - 0.45) / 1.2)
  if (age < 3.85) return 1
  return 1 - smooth((age - 3.85) / 1.8)
}
