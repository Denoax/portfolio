// Original target controller for the Worlds tube layer. Coordinates stay in
// CSS pixels; this output must never enter hit testing or the smoke path queue.
const TAU = Math.PI * 2

export class TubeOrbit {
  known = false
  inside = false
  x = 0
  y = 0
  phase = 0
  mix = 0
  private age = 0
  private motionX = 0
  private motionY = 0
  private discontinuity = false
  readonly output = { x: 0, y: 0, resetChain: false }

  observe(x: number, y: number) {
    if (!Number.isFinite(x + y)) return
    this.discontinuity ||= !this.known || Math.hypot(x - this.x, y - this.y) > 240
    // Accumulate subpixel drift against the last meaningful movement. Tiny
    // event jitter must not indefinitely postpone dwell, or hide a slow drag.
    if (!this.known || Math.hypot(x - this.motionX, y - this.motionY) > .75) {
      this.age = 0
      this.motionX = x
      this.motionY = y
    }
    this.x = x
    this.y = y
    this.known = this.inside = true
  }

  leave() { this.inside = false }
  reseed() { this.discontinuity = true }
  clear() {
    this.known = this.inside = false
    this.age = this.mix = 0
    this.discontinuity = true
  }

  step(dt: number, dragging: boolean) {
    const delta = Number.isFinite(dt) ? Math.max(0, Math.min(.05, dt)) : 0
    this.age += delta
    const desired = !dragging && (!this.inside || this.age >= .5) ? 1 : 0
    const tau = desired > this.mix ? .45 : .18
    this.mix = desired + (this.mix - desired) * Math.exp(-delta / tau)
    this.phase = (this.phase + delta * TAU / 5.5) % TAU
    this.output.x = this.x + 42 * this.mix * Math.cos(this.phase)
    this.output.y = this.y + 42 * this.mix * Math.sin(this.phase)
    this.output.resetChain = this.discontinuity
    this.discontinuity = false
    return this.output
  }
}
