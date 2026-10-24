import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve } from 'node:path'

// Transpile the real controller and its actual numerical/pulse dependencies.
// The fixture below supplies state only; there is no duplicate controller.
const source = async path => readFile(resolve(process.env.INTRO_SOURCE_ROOT || '.', path), 'utf8')
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
// The former auto-floor/return and 2.5x cap assertions are superseded by
// manual coast-to-rest. All hold/release/cancellation/positional checks remain.
const manualRest = () => {
  const intro = fixture()
  intro.transport.state = 'COASTING'
  return intro
}
const workloads = JSON.parse(await readFile('scripts/fixtures/intro-wheel-v3.json', 'utf8'))
function simulate(events, end, hz, sign = 1) {
  const intro = manualRest(), trace = []
  let time = 0, event = 0, frame = 1
  while (time < end - 1e-10) {
    while (event < events.length && events[event].t <= time + 1e-10) {
      const pixels = events[event++].intent * sign, velocity = intro.zoomVelocity
      m.requestIntroScroll(intro, pixels)
      near(intro.zoomVelocity, velocity, 0)
      trace.push({t:time,input:pixels,velocity,travel:logical(intro),mode:intro.transport.state})
    }
    const next = Math.min(end, frame / hz, events[event]?.t ?? Infinity)
    if (next > time + 1e-12) {
      m.stepIntroZoom(intro, next - time);time = next
      trace.push({t:time,input:0,velocity:intro.zoomVelocity,travel:logical(intro),mode:intro.transport.state})
    }
    if (time >= frame / hz - 1e-10) frame++
  }
  return {intro,trace}
}
const traces = [], samplingComparisons = []
check('Manual rest builds gently in both directions beyond the former plateau, then stays at rest', () => {
  for (const direction of [-1,1]) {
    const intro = manualRest(), peaks = []
    for (let i=0;i<6;i++) {
      m.requestIntroScroll(intro,direction*120);run(intro,.15)
      peaks.push(Math.abs(intro.zoomVelocity))
    }
    assert(peaks[0] > 0 && peaks[0] < .04)
    assert(peaks.every((v,i)=>i===0||v>peaks[i-1]))
    assert(peaks.at(-1) > .1625,'Ordinary repeated input must exceed the former early cap')
    run(intro,40)
    assert.equal(intro.zoomVelocity,0)
    assert.equal(intro.transport.wheelMomentum,0)
    const pose=structuredClone(intro.zoom);run(intro,10);assert.deepEqual(intro.zoom,pose)
    assert.equal(intro.transport.state,'COASTING')
  }
})
check('Opposite input brakes, crosses zero once and updates direction only with displayed motion', () => {
  const workload=workloads.find(x=>x.id==='brake-and-reverse')
  const result=simulate(workload.events,workload.observe_until,120)
  const reversal=result.trace.filter(x=>x.t>=1.2)
  let crosses=0
  for(let i=1;i<reversal.length;i++)if(reversal[i-1].velocity>0&&reversal[i].velocity<=0)crosses++
  assert.equal(crosses,1);assert(result.intro.zoomVelocity<0)
  assert(reversal.find(x=>x.t>1.3).velocity<reversal[0].velocity)
  assert(reversal.find(x=>x.t>1.21).velocity>0)
  const intro=manualRest();m.requestIntroScroll(intro,600);run(intro,.5)
  const velocity=intro.zoomVelocity,direction=intro.transport.lastDirection
  m.requestIntroScroll(intro,-120);near(intro.zoomVelocity,velocity,0)
  assert.equal(intro.transport.lastDirection,direction);run(intro,.1)
  assert(intro.zoomVelocity>0&&intro.zoomVelocity<velocity)
  traces.push({name:workload.id,hz:120,trace:result.trace})
})
check('Timed intent is symmetric and independent of 30/60/120/240Hz frame partitions', () => {
  for(const workload of workloads.filter(x=>x.events&&x.observe_until)) {
    const reference=simulate(workload.events,workload.observe_until,240)
    for(const hz of [30,60,120,240]) {
      const result=simulate(workload.events,workload.observe_until,hz)
      near(logical(result.intro),logical(reference.intro),1e-7)
      near(result.intro.zoomVelocity,reference.intro.zoomVelocity,1e-7)
      const actualEvents=result.trace.filter(x=>x.input),expectedEvents=reference.trace.filter(x=>x.input)
      let maxVelocityError=Math.abs(result.intro.zoomVelocity-reference.intro.zoomVelocity)
      let maxTravelError=Math.abs(logical(result.intro)-logical(reference.intro))
      for(let i=0;i<actualEvents.length;i++) {
        const a=actualEvents[i],b=expectedEvents[i]
        near(a.velocity,b.velocity,1e-7);near(a.travel,b.travel,1e-7)
        maxVelocityError=Math.max(maxVelocityError,Math.abs(a.velocity-b.velocity))
        maxTravelError=Math.max(maxTravelError,Math.abs(a.travel-b.travel))
      }
      samplingComparisons.push({name:workload.id,hz,maxVelocityError,maxTravelError})
      traces.push({name:workload.id,hz,trace:result.trace})
    }
    const negative=simulate(workload.events,workload.observe_until,240,-1)
    near(logical(negative.intro),-logical(reference.intro),1e-9)
    near(negative.intro.zoomVelocity,-reference.intro.zoomVelocity,1e-9)
  }
})
check('Same-time packet splitting and normalized pixel/line/page units preserve intent', () => {
  const one=manualRest(),split=manualRest()
  m.requestIntroScroll(one,120)
  for(let i=0;i<12;i++)m.requestIntroScroll(split,10)
  run(one,2);run(split,2)
  near(one.zoomVelocity,split.zoomVelocity,1e-12);near(logical(one),logical(split),1e-12)
  near(m.normalizeIntroWheel(-120,0,16,900),120)
  near(m.normalizeIntroWheel(-7.5,1,16,900),120)
  near(m.normalizeIntroWheel(-120/900,2,16,900),120)
  near(m.normalizeIntroWheel(-6,1,20,900),120)
  for(const [delta,mode,line,page] of [[NaN,0,16,900],[Infinity,0,16,900],[1e300,2,16,900],[1,3,16,900],[1,1,NaN,900]])
    assert.equal(m.normalizeIntroWheel(delta,mode,line,page),0)
})
check('Automatic takeover preserves pose/velocity; holds clear wheel intent and release reverses once', () => {
  const intro=fixture();run(intro,1)
  const velocity=intro.zoomVelocity,pose=logical(intro)
  m.requestIntroScroll(intro,-120)
  near(intro.zoomVelocity,velocity,0);near(logical(intro),pose,0)
  run(intro,.3);const token=hold(intro)
  assert.equal(intro.transport.wheelMomentum,0);assert.equal(intro.zoomVelocity,0)
  const held=structuredClone(intro.zoom)
  m.requestIntroScroll(intro,120);run(intro,1);assert.deepEqual(intro.zoom,held)
  assert.equal(m.releaseIntroGesture(intro,token,1.4,false,true),'reverse')
  assert.equal(m.releaseIntroGesture(intro,token,1.4,false,true),'ignored')
  run(intro,1);assert.equal(intro.transport.lastDirection,1);assert.equal(intro.transport.committedToken,token)
  assert.equal(intro.transport.wheelMomentum,0)
})
check('Cancellation and paused/input-blocked frames cannot restart rested wheel motion or replay energy', () => {
  const intro=manualRest();m.requestIntroScroll(intro,120);run(intro,40)
  m.cancelIntroTransport(intro);run(intro,1);assert.equal(intro.zoomVelocity,0)
  for(const flag of ['paused','inputBlocked']) {
    intro[flag]=true;const snapshot=structuredClone(intro)
    m.requestIntroScroll(intro,120);m.stepIntroZoom(intro,1)
    assert.deepEqual(intro,snapshot);intro[flag]=false
  }
  m.requestIntroZoom(intro,.3);run(intro,.5);assert(logical(intro)>.3)
})
check('Pathological input has bounded energy/travel, finite infinite coordinates and no large catch-up', () => {
  const intro=manualRest(),before=structuredClone(intro)
  for(const invalid of [0,NaN,Infinity,-Infinity,1e300])m.requestIntroScroll(intro,invalid)
  assert.deepEqual(intro,before)
  for(let i=0;i<1000;i++)m.requestIntroScroll(intro,1000)
  intro.zoom={octave:10n**100n,phase:.99}
  const octave=intro.zoom.octave;m.stepIntroZoom(intro,1e10)
  assert(intro.zoom.octave>=octave&&intro.zoom.octave<=octave+1n)
  assert(intro.zoom.phase>=0&&intro.zoom.phase<1&&Number.isFinite(intro.zoomVelocity))
  run(intro,1);assert(intro.zoomVelocity>0&&intro.zoomVelocity<.65)
  for(let i=0;i<4;i++)m.requestIntroScroll(intro,-1000)
  run(intro,.5);assert(intro.zoomVelocity<0,'Bounded reservoir cannot hide an excessive reversal backlog')
  assert(Math.abs(intro.zoomVelocity)<.65)
  run(intro,40);assert.equal(intro.zoomVelocity,0)
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
  status: 'PASS', checks: results, traces, samplingComparisons,
  momentumTolerance: {position:1e-7,velocity:1e-7,sameTimePacket:1e-12},
  timings: { hold: m.INTRO_HOLD_SECONDS, shuffle: m.INTRO_SHUFFLE_SECONDS, wait: m.INTRO_WAIT_SECONDS, autoOctavesPerSecond: m.INTRO_AUTO_RATE },
  scope: 'Actual production numerical controller and ripple pool. State contracts only; browser input, rendering, playback, physical devices and human motion approval require separate evidence.',
}, null, 2) + '\n')
console.log(`PASS ${results.length} production transport contracts`)
