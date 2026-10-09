// Exact solution of x'' + 2ωx' + ω²(x-target) = 0 over one frame.
// Retargeting preserves velocity, including native scroll reversal.
export class CriticalDamper {
  velocity = 0
  constructor(public value = 0) {}
  step(target: number, smoothTime: number, dt: number) {
    const omega = 2 / Math.max(0.001, smoothTime)
    const delta = Math.max(0, Math.min(0.05, dt))
    const offset = this.value - target
    const coefficient = this.velocity + omega * offset
    const decay = Math.exp(-omega * delta)
    this.value = target + (offset + coefficient * delta) * decay
    this.velocity = (this.velocity - omega * coefficient * delta) * decay
    return this.value
  }
  reset(value: number) {
    this.value = value
    this.velocity = 0
  }
}
