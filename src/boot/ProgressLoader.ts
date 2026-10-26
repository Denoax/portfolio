// Presentation only. BootSession supplies completed preparation milestones.
export class ProgressLoader {
  private readonly number: HTMLElement
  private readonly fill: HTMLElement
  private readonly progress: HTMLElement
  private value = 0
  private target = 0
  private last = 0
  private raf = 0
  private stopped = false
  constructor(shell: HTMLElement) {
    this.number = shell.querySelector<HTMLElement>('[data-boot-number]')!
    this.fill = shell.querySelector<HTMLElement>('[data-boot-fill]')!
    this.progress = shell.querySelector<HTMLElement>('[data-boot-progress]')!
    document.addEventListener('visibilitychange', this.visibility)
  }
  private paint() {
    const integer = Math.floor(this.value)
    this.number.textContent = String(integer).padStart(3, '0')
    this.fill.style.transform = `scaleX(${this.value / 100})`
    this.progress.setAttribute('aria-valuenow', String(integer))
  }
  update(value: number) {
    if (this.stopped || !Number.isFinite(value)) return
    // Do not regress if a renderer generation retires or native recovery begins.
    this.target = Math.max(this.target, Math.min(99, Math.max(0, value)))
    this.wake()
  }
  private wake() {
    if (!this.raf && !this.stopped && !document.hidden && this.value < this.target)
      this.raf = requestAnimationFrame(this.tick)
  }
  private readonly tick = (now: number) => {
    this.raf = 0
    if (this.stopped || document.hidden) return
    const less = document.documentElement.dataset.bootMotion === 'less' ||
      matchMedia('(prefers-reduced-motion:reduce)').matches
    const dt = this.last ? Math.min(50, now - this.last) : 0
    this.last = now
    this.value = less ? this.target : this.value + (this.target - this.value) * (1 - Math.exp(-dt / 80))
    if (this.target - this.value < .05) this.value = this.target
    this.paint()
    if (this.value < this.target) this.wake()
    else this.last = 0
  }
  private readonly visibility = () => {
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0
    this.wake()
  }
  complete() {
    this.value = this.target = 100; this.paint(); this.dispose()
  }
  dispose() {
    this.stopped = true
    cancelAnimationFrame(this.raf); this.raf = 0
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
