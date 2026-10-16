import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import ts from 'typescript'

// Transpile the real controller and its actual numerical/pulse dependencies.
// The fixture below supplies state only; there is no duplicate controller.
const source = async path => readFile(path, 'utf8')
const compile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const zoomURL = url(compile(await source('src/core/introZoom.ts')))
const motionURL = url(compile(await source('src/core/introMotion.ts'))
  .replace(/from ['"]\.\/introZoom['"]/, `from '${zoomURL}'`))
const m = await import(motionURL)
const z = await import(zoomURL)
const ripple = await import(url(compile(await source('src/core/introRipples.ts'))))
const fixture = () => ({
  zoom: { octave: 0n, phase: 0 }, loopPeriod: 10,
  transport: m.createIntroTransport(), zoomDelta: 0, zoomReset: false,
  zoomVelocity: 0, resetActive: false, resetDistance: 0, holding: false,
  paused: false, exiting: false, inputBlocked: false,
  ripples: ripple.createIntroRipples(), elapsed: 0,
})
const logical = intro => Number(intro.zoom.octave) + intro.zoom.phase
const near = (actual, expected, tolerance = 1e-9) =>
  assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
const run = (intro, seconds, hz = 120) => {
  const ticks = Math.round(seconds * hz)
  for (let tick = 0; tick < ticks; tick++) m.stepIntroZoom(intro, 1 / hz)
}
const hold = (intro, seconds = 0.4, hz = 120) => {
  const token = m.beginIntroGesture(intro)
  assert.notEqual(token, null)
  run(intro, seconds, hz)
  return token
}
const results = []
const check = (name, fn) => { fn(); results.push({ name, status: 'PASS' }) }

check('Initial auto-out integrates continuously and equally at 30/60/120/240 Hz', () => {
  const distances = []
  for (const hz of [30, 60, 120, 240]) {
    const intro = fixture()
    run(intro, 10, hz)
    assert.equal(intro.transport.state, 'AUTO_OUT')
    assert.equal(intro.transport.lastDirection, -1)
    near(intro.zoomVelocity, -m.INTRO_AUTO_RATE)
    distances.push(logical(intro))
  }
  for (const distance of distances) near(distance, distances[0])
})
check('Press does not jump pose; hold stops radial and base-angular motion while ambient/pulses survive', () => {
  const intro = fixture()
  run(intro, 1)
  const before = logical(intro)
  const token = m.beginIntroGesture(intro)
  near(logical(intro), before)
  run(intro, 0.3)
  assert.equal(intro.transport.state, 'HELD')
  assert.equal(intro.zoomVelocity, 0)
  const pose = structuredClone(intro.zoom), angular = intro.transport.angularTime
  ripple.admitIntroRipple(intro.ripples, 2)
  const slot = structuredClone(intro.ripples.slots[0])
  intro.elapsed = 2
  run(intro, 3)
  assert.deepEqual(intro.zoom, pose)
  assert.equal(intro.transport.angularTime, angular)
  assert.deepEqual(intro.ripples.slots[0], slot)
  assert.equal(intro.elapsed, 2, 'Ambient time remains owned by Ringwriter, not a second controller clock')
  assert.equal(m.releaseIntroGesture(intro, token, 3.3, false, true), 'reverse')
})
check('Boundary taps classify below260ms as entry and at/above260ms as deliberate release', () => {
  for (const [duration, action] of [[0.259, 'enter'], [0.26, 'reverse'], [0.261, 'reverse']]) {
    const intro = fixture(), token = m.beginIntroGesture(intro)
    assert.equal(m.releaseIntroGesture(intro, token, duration, false, true), action)
    assert.equal(m.releaseIntroGesture(intro, token, duration, false, true), 'ignored')
  }
  const drag = fixture(), token = m.beginIntroGesture(drag)
  assert.equal(m.releaseIntroGesture(drag, token, 0.15, true, true), 'ripple')
  run(drag, 1)
  assert.equal(drag.transport.lastDirection, -1)
  assert.equal(drag.transport.committedToken, 0)
})
check('Three deliberate releases flip exactly once each after bounded shuffle and quiet wait', () => {
  const intro = fixture()
  for (const expected of [1, -1, 1]) {
    const previous = intro.transport.lastDirection
    const token = hold(intro)
    const pose = logical(intro)
    assert.equal(m.releaseIntroGesture(intro, token, 0.4, false, true), 'reverse')
    near(logical(intro), pose)
    run(intro, 0.4)
    assert.equal(intro.transport.lastDirection, previous)
    assert.equal(intro.transport.state, 'SHUFFLE')
    assert(intro.transport.shuffleAmount > 0 && intro.transport.shuffleAmount < 1)
    const seed = intro.transport.shuffleSeed
    run(intro, 0.1)
    assert.equal(intro.transport.state, 'WAIT')
    assert.equal(intro.transport.shuffleAmount, 0)
    assert.equal(intro.transport.shuffleSeed, seed)
    assert.equal(intro.transport.lastDirection, previous)
    run(intro, 0.25)
    assert.equal(intro.transport.lastDirection, expected)
    assert.equal(intro.transport.committedToken, token)
    assert.equal(intro.transport.state, expected === -1 ? 'AUTO_OUT' : 'AUTO_IN')
    run(intro, 2)
    assert.equal(intro.transport.lastDirection, expected)
    assert(Math.sign(intro.zoomVelocity) === expected)
  }
})
check('Re-press cancels obsolete shuffle/wait tokens from current pose without a queued flip', () => {
  for (const at of [0.2, 0.5]) {
    const intro = fixture(), first = hold(intro)
    m.releaseIntroGesture(intro, first, 0.4, false, true)
    run(intro, at)
    const pose = logical(intro), amount = intro.transport.shuffleAmount
    const second = m.beginIntroGesture(intro)
    near(logical(intro), pose)
    assert.equal(intro.transport.shuffleAmount, amount)
    run(intro, 0.4)
    assert.equal(intro.transport.shuffleAmount, 0)
    assert.equal(intro.transport.lastDirection, -1)
    assert.equal(intro.transport.committedToken, 0)
    m.releaseIntroGesture(intro, second, 0.4, false, true)
    run(intro, 0.8)
    assert.equal(intro.transport.lastDirection, 1)
    assert.equal(intro.transport.committedToken, second)
    run(intro, 2)
    assert.equal(intro.transport.lastDirection, 1)
  }
})
check('All cancellation phases resume last committed direction without entry or reversal', () => {
  for (const at of ['press', 'held', 'shuffle', 'wait']) {
    const intro = fixture(), token = hold(intro, at === 'press' ? 0.1 : 0.4)
    if (['shuffle', 'wait'].includes(at)) {
      m.releaseIntroGesture(intro, token, 0.4, false, true)
      run(intro, at === 'shuffle' ? 0.2 : 0.5)
    }
    const pose = logical(intro)
    m.cancelIntroTransport(intro)
    near(logical(intro), pose)
    assert.equal(m.releaseIntroGesture(intro, token, 1, false, true), 'ignored')
    run(intro, 2)
    assert.equal(intro.transport.lastDirection, -1)
    assert.equal(intro.transport.committedToken, 0)
    assert.equal(intro.transport.pendingDirection, null)
  }
})
check('A saturated independent ripple pool cannot suppress or replay reversal', () => {
  const intro = fixture()
  for (let index = 0; index < ripple.RIPPLE_SLOTS; index++)
    assert.notEqual(ripple.admitIntroRipple(intro.ripples, 0), null)
  const old = structuredClone(intro.ripples)
  const token = hold(intro)
  assert.equal(ripple.admitIntroRipple(intro.ripples, 1), null)
  assert.equal(m.releaseIntroGesture(intro, token, 0.4, false, true), 'reverse')
  run(intro, 1)
  assert.equal(intro.transport.lastDirection, 1)
  assert.deepEqual(intro.ripples, old)
})
check('Discrete keyboard requests override temporarily, preserve direction and cannot move an active hold', () => {
  const intro = fixture()
  run(intro, 1)
  const before = logical(intro)
  m.requestIntroZoom(intro, 0.5)
  near(logical(intro), before)
  run(intro, 0.5)
  assert(logical(intro) > before + 0.45)
  assert.equal(intro.transport.lastDirection, -1)
  run(intro, 1)
  near(intro.zoomVelocity, -m.INTRO_AUTO_RATE, 1e-6)
  hold(intro)
  const held = structuredClone(intro.zoom)
  m.requestIntroZoom(intro, 0.5)
  m.requestIntroReset(intro)
  run(intro, 1)
  assert.deepEqual(intro.zoom, held)
  assert.equal(intro.zoomReset, false)
})
check('Scrolling boosts continuous travel without entering positional settling or stalling', () => {
  for (const direction of [-1, 1]) {
    const intro = fixture()
    intro.transport.lastDirection = direction
    intro.transport.state = direction < 0 ? 'AUTO_OUT' : 'AUTO_IN'
    run(intro, 1)
    const initialVelocity = intro.zoomVelocity
    m.requestIntroScroll(intro, direction * (0.1 / 1.75))
    near(intro.zoomVelocity, initialVelocity)
    assert.equal(intro.transport.manualActive, false)
    let peak = 0
    for (let tick = 0; tick < 240; tick++) {
      if (tick === 12 || tick === 24) m.requestIntroScroll(intro, direction * (0.1 / 1.75))
      m.stepIntroZoom(intro, 1 / 120)
      const speed = intro.zoomVelocity * direction
      assert(speed >= m.INTRO_AUTO_RATE - 1e-8, 'A scroll gesture must not brake into a stationary interval')
      peak = Math.max(peak, speed)
    }
    assert(peak > m.INTRO_AUTO_RATE * 1.5 && peak <= m.INTRO_AUTO_RATE * 2.5)
    run(intro, 40)
    near(intro.zoomVelocity, direction * m.INTRO_AUTO_RATE, 1e-8)
  }
})
check('Counter-scroll brakes accumulated momentum before several inputs reverse it', () => {
  const intro = fixture()
  run(intro, 1)
  for (let event = 0; event < 10; event++) m.requestIntroScroll(intro, -0.5)
  run(intro, 0.2)
  const before = intro.zoomVelocity
  m.requestIntroScroll(intro, 0.1 / 1.75)
  near(intro.zoomVelocity, before)
  assert.equal(intro.transport.lastDirection, -1, 'One opposite notch cannot instantly reverse stacked momentum')
  run(intro, 0.1)
  assert(intro.zoomVelocity < 0 && intro.zoomVelocity > before, 'The first counter-scroll actually decelerates the field')
  let counterScrolls = 1
  while (intro.transport.lastDirection < 0 && counterScrolls < 12) {
    m.requestIntroScroll(intro, 0.1 / 1.75)
    run(intro, 0.1)
    counterScrolls++
  }
  assert(counterScrolls >= 3 && counterScrolls <= 9)
  run(intro, 1)
  assert(intro.zoomVelocity > 0)
  assert.equal(intro.transport.lastDirection, 1)
  assert.equal(intro.transport.manualActive, false)
})
check('Scroll momentum is bounded, frame-rate independent and cancelled by holds', () => {
  const distances = []
  for (const hz of [30, 60, 120, 240]) {
    const intro = fixture()
    run(intro, 1, hz)
    for (const delta of [-0.057, -0.057, 0.057, 0.057, 0.057, 0.057]) {
      m.requestIntroScroll(intro, delta)
      run(intro, 0.2, hz)
      assert(Math.abs(intro.zoomVelocity) <= m.INTRO_AUTO_RATE * 2.5)
    }
    run(intro, 2, hz)
    distances.push(logical(intro))
    hold(intro, 0.4, hz)
    assert.equal(intro.transport.scrollBoost, 0)
    const held = structuredClone(intro.zoom)
    m.requestIntroScroll(intro, 0.05)
    run(intro, 1, hz)
    assert.deepEqual(intro.zoom, held)
  }
  for (const distance of distances) near(distance, distances[0], 1e-8)
  const intro = fixture()
  for (const invalid of [0, NaN, Infinity, -Infinity]) m.requestIntroScroll(intro, invalid)
  assert.equal(intro.transport.scrollBoost, 0)
})
check('One oversized counter-scroll cannot flip normal travel; momentum stays capped', () => {
  const intro = fixture()
  run(intro, 1)
  m.requestIntroScroll(intro, 1000)
  assert.equal(intro.transport.lastDirection, -1)
  for (let event = 0; event < 1000; event++) m.requestIntroScroll(intro, -1000)
  run(intro, 0.5)
  assert(Math.abs(intro.zoomVelocity) <= m.INTRO_AUTO_RATE * 2.5)
})
check('Snap rebounds are bounded, settle to zero and survive travelling-wave saturation', () => {
  const state = ripple.createIntroRipples()
  for (let index = 0; index < ripple.RIPPLE_SLOTS; index++) ripple.admitIntroRipple(state, 0)
  assert.equal(ripple.admitIntroRipple(state, 0.1), null)
  assert.equal(ripple.admitIntroSnap(state, 0.1), 1)
  assert.equal(ripple.snapEnvelope(0), 0)
  assert(ripple.snapEnvelope(0.04) > 0.5)
  assert(ripple.snapEnvelope(0.16) < -0.2)
  assert.equal(ripple.snapEnvelope(ripple.SNAP_LIFETIME), 0)
  assert.equal(ripple.snapEnvelope(NaN), 0)
  for (let tick = 0; tick < 1000; tick++) assert(Math.abs(ripple.snapEnvelope(tick / 1000)) < 0.75)
  ripple.clearIntroRipples(state)
  assert.equal(state.snapStartedAt, null)
  assert.equal(ripple.admitIntroSnap(state, 0.2), 2, 'Clearing the visual effect cannot replay an audio identity')
  assert.equal(ripple.admitIntroSnap(state, 0.3, false), 3)
  assert.equal(state.snapStartedAt, null, 'Reduced/static release must not leave a dormant visual burst')
  const intro = fixture()
  ripple.admitIntroSnap(intro.ripples, 0.4)
  m.cancelIntroTransport(intro)
  assert.equal(intro.ripples.snapStartedAt, null)
})
check('Reset follows the current viewport period instead of assuming six octaves', () => {
  for (const period of [10, 11, 12]) for (const phase of [-100.7, -9.8, 0.3, 8.2, 100.2]) {
    const intro = fixture()
    intro.loopPeriod = period
    intro.zoom = z.advanceZoom(intro.zoom, phase)
    m.requestIntroReset(intro)
    for (let tick = 0; tick < 240 && (intro.zoomReset || intro.resetActive); tick++)
      m.stepIntroZoom(intro, 1 / 120)
    assert.equal(intro.resetActive, false)
    assert.equal(z.boundedZoom(intro.zoom, period), 0)
    assert.equal(intro.zoom.octave, 0n)
  }
})
check('Reduced/static and blocked state do not advance transport or schedule release bursts', () => {
  for (const field of ['paused', 'inputBlocked']) {
    const intro = fixture()
    intro[field] = true
    const before = structuredClone(intro.zoom)
    run(intro, 3)
    assert.deepEqual(intro.zoom, before)
  }
  const intro = fixture()
  intro.paused = true
  const token = m.beginIntroGesture(intro)
  assert.equal(m.releaseIntroGesture(intro, token, 0.5, false, false), 'ripple')
  assert.equal(intro.transport.pendingDirection, null)
  assert.equal(intro.transport.shuffleAmount, 0)
  assert.equal(intro.transport.lastDirection, -1)
})
check('Hidden-time cancellation, fresh entry and huge logical travel retain numerical invariants', () => {
  const intro = fixture()
  intro.zoom = { octave: -(10n ** 100n), phase: 0.001 }
  run(intro, 0.5)
  assert(intro.zoom.phase >= 0 && intro.zoom.phase < 1)
  const token = hold(intro)
  m.releaseIntroGesture(intro, token, 0.4, false, true)
  run(intro, 0.2)
  m.cancelIntroTransport(intro)
  const pose = structuredClone(intro.zoom)
  // Hidden tabs supply no active frame, regardless of wall-clock duration.
  assert.deepEqual(intro.zoom, pose)
  run(intro, 0.1)
  assert.equal(intro.transport.lastDirection, -1)
  assert.equal(intro.transport.pendingDirection, null)
  m.resetIntroTransport(intro)
  assert.deepEqual(intro.zoom, { octave: 0n, phase: 0 })
  assert.equal(intro.transport.angularTime, 0)
  assert.equal(intro.transport.state, 'AUTO_OUT')
})
check('Exit never consumes an obsolete release; angular state stays bounded through manual reversal', () => {
  const intro = fixture(), token = hold(intro)
  m.releaseIntroGesture(intro, token, 0.4, false, true)
  run(intro, 0.2)
  m.exitIntroTransport(intro)
  run(intro, 1)
  assert.equal(intro.transport.state, 'EXITING')
  assert.equal(intro.transport.lastDirection, -1)
  assert.equal(intro.transport.committedToken, 0)
  assert.equal(intro.zoomVelocity, 0)
  assert(intro.transport.angularTime >= 0 && intro.transport.angularTime < Math.PI * 2000)
})

const out = process.env.OUT || 'showcase/v28-evidence/transport'
await mkdir(out, { recursive: true })
await writeFile(`${out}/models.json`, JSON.stringify({
  status: 'PASS', checks: results,
  timings: { hold: m.INTRO_HOLD_SECONDS, shuffle: m.INTRO_SHUFFLE_SECONDS, wait: m.INTRO_WAIT_SECONDS, autoOctavesPerSecond: m.INTRO_AUTO_RATE },
  scope: 'Actual production numerical controller and ripple pool. State contracts only; browser input, rendering, playback, physical devices and human motion approval require separate evidence.',
}, null, 2) + '\n')
console.log(`PASS ${results.length} production transport contracts`)
