import { advanceZoom, boundedZoom } from './introZoom'
import type { MenuPresentation } from './menuReel'

export type IntroDirection = -1 | 1
export type IntroTransportState =
  | 'AUTO_OUT'
  | 'AUTO_IN'
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
const SCROLL_BOOST_SECONDS = 2.4
const MAX_SCROLL_SPEED = INTRO_AUTO_RATE * 2.5
const MAX_SCROLL_IMPULSE = INTRO_AUTO_RATE * 0.45
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
  scrollBoost: number // Signed velocity offset from the committed automatic rate.
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
    scrollBoost: 0,
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
  transport.state = autoState(transport.lastDirection)
  transport.gestureAge = 0
  transport.settleAmount = transport.shuffleAmount
  transport.settleAge = 0
  transport.waitAge = 0
  intro.holding = false
  intro.zoomDelta = 0
  intro.zoomReset = intro.resetActive = false
  intro.ripples.snapStartedAt = null
  transport.manualActive = false
  transport.scrollBoost = 0
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
  intro.transport.scrollBoost = 0
  intro.transport.manualActive = true
  intro.transport.manualIdle = 0
}

export function requestIntroScroll(intro: Intro, delta: number) {
  const transport = intro.transport
  if (
    !Number.isFinite(delta) || delta === 0 || intro.paused ||
    intro.holding || intro.exiting || intro.inputBlocked ||
    (transport.state !== 'AUTO_IN' && transport.state !== 'AUTO_OUT')
  ) return
  // Add signed momentum. Counter-scroll first brakes the accumulated speed;
  // no single large wheel packet can reverse a normally moving field.
  const impulse = Math.max(-MAX_SCROLL_IMPULSE, Math.min(MAX_SCROLL_IMPULSE, delta / SCROLL_BOOST_SECONDS))
  const current = transport.lastDirection * INTRO_AUTO_RATE + transport.scrollBoost
  const target = Math.max(-MAX_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, current + impulse))
  if (target !== 0) transport.lastDirection = target < 0 ? -1 : 1
  transport.state = autoState(transport.lastDirection)
  transport.scrollBoost = target - transport.lastDirection * INTRO_AUTO_RATE
  transport.manualActive = false
  intro.zoomDelta = 0
  intro.zoomReset = intro.resetActive = false
}

export function requestIntroReset(intro: Intro) {
  if (intro.holding || intro.exiting || intro.inputBlocked) return
  intro.zoomReset = true
  intro.transport.scrollBoost = 0
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
    } else {
      const target = transport.lastDirection * INTRO_AUTO_RATE
      const decay = Math.exp(-seconds / VELOCITY_EASING_SECONDS)
      const boostDecay = Math.exp(-seconds / SCROLL_BOOST_SECONDS)
      const boost = transport.scrollBoost *
        SCROLL_BOOST_SECONDS / (SCROLL_BOOST_SECONDS - VELOCITY_EASING_SECONDS)
      // Integrate the decaying boost and velocity easing together, so wheel
      // momentum and total travel do not depend on the display frame rate.
      step =
        target * seconds +
        (intro.zoomVelocity - target) * VELOCITY_EASING_SECONDS * (1 - decay) +
        boost * (SCROLL_BOOST_SECONDS * (1 - boostDecay) - VELOCITY_EASING_SECONDS * (1 - decay))
      intro.zoomVelocity = target + (intro.zoomVelocity - target) * decay + boost * (boostDecay - decay)
      transport.scrollBoost *= boostDecay
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
