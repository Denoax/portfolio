import type { LinearRGB } from './projectPigment'

const CAPACITY = 512
const SPACING = 5
const MAX_JUMP = 240
// Bounded CSS-space samples. Admission never allocates a point per move; the
// consumer retains curvature, timestamps and emitted colour across frame rates.
export class PointerPath {
  private samples = new Float32Array(CAPACITY * 5)
  private times = new Float64Array(CAPACITY)
  private read = 0
  private count = 0
  private previous = new Float32Array(5)
  private initialized = false
  private lastX = NaN
  private lastY = NaN
  readonly evidence = { admitted: 0, coalesced: 0, dropped: 0, discontinuities: 0, queued: 0, segments: 0, capacity: CAPACITY }
  clear() {
    this.read = this.count = 0
    this.initialized = false
    this.lastX = this.lastY = NaN
    this.evidence.queued = 0
  }
  admit(x: number, y: number, time: number, pigment: LinearRGB) {
    if (!Number.isFinite(x + y + time) || x === this.lastX && y === this.lastY) return
    this.lastX = x; this.lastY = y
    if (this.count === CAPACITY) {
      this.read = (this.read + 1) % CAPACITY
      this.count--
      this.initialized = false
      this.evidence.dropped++
    }
    const index = (this.read + this.count) % CAPACITY, at = index * 5
    this.samples[at] = x; this.samples[at + 1] = y
    this.samples[at + 2] = pigment[0]; this.samples[at + 3] = pigment[1]; this.samples[at + 4] = pigment[2]
    this.times[index] = time
    this.count++; this.evidence.admitted++; this.evidence.queued = this.count
  }
  consume(segments: Float32Array, pigments: Float32Array, weights: Float32Array, now: number) {
    let n = 0
    const limit = weights.length
    while (this.count && n < limit) {
      const at = this.read * 5
      const x = this.samples[at], y = this.samples[at + 1]
      const dx = x - this.previous[0], dy = y - this.previous[1], distance = Math.hypot(dx, dy)
      if (now - this.times[this.read] > 250) {
        // A stale endpoint cannot seed the next fresh segment: that would draw
        // a chord across the missing input even after discarding the backlog.
        this.initialized = false
        this.evidence.discontinuities++
        this.read = (this.read + 1) % CAPACITY; this.count--
        continue
      }
      if (!this.initialized || distance > MAX_JUMP) {
        if (this.initialized) this.evidence.discontinuities++
        for (let i = 0; i < 5; i++) this.previous[i] = this.samples[at + i]
        this.initialized = true
        this.read = (this.read + 1) % CAPACITY; this.count--
        continue
      }
      if (distance < .001) {
        this.read = (this.read + 1) % CAPACITY; this.count--
        continue
      }
      const part = Math.min(1, SPACING / distance)
      const nextX = this.previous[0] + dx * part, nextY = this.previous[1] + dy * part
      segments[n * 4] = this.previous[0]; segments[n * 4 + 1] = this.previous[1]
      segments[n * 4 + 2] = nextX; segments[n * 4 + 3] = nextY
      for (let c = 0; c < 3; c++) {
        const previous = this.previous[c + 2], next = this.samples[at + c + 2]
        pigments[n * 3 + c] = previous + (next - previous) * part * .5
        this.previous[c + 2] = previous + (next - previous) * part
      }
      weights[n] = Math.min(SPACING, distance)
      this.previous[0] = nextX; this.previous[1] = nextY
      if (part === 1) { this.read = (this.read + 1) % CAPACITY; this.count-- }
      n++
    }
    this.evidence.segments += n; this.evidence.queued = this.count
    return n
  }
}
