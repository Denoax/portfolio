interface Band {
  row: HTMLElement
  cells: {element: HTMLElement; characters: number; painted: number}[]
  from: number
  value: number
  target: number
  at: number
  duration: number
  retire: number
}
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }

// Original bounded DOM implementation after the supplied index/hover study.
// Per-row admission and retirement; no character tweens, font work or layouts
// in the frame loop. This decoration has no access to scene input or readiness.
export class TerminalIndex {
  private readonly rows: HTMLElement[]
  private readonly bands = new Map<HTMLElement, Band>()
  private readonly reduced = matchMedia('(prefers-reduced-motion:reduce)')
  private raf = 0
  private last = 0
  private clock = 0
  private nextIdle = 900
  private idleRow = 0
  private pointerUntil = 0
  private disposed = false
  constructor(private readonly root: HTMLElement) {
    this.rows = [...root.querySelectorAll<HTMLElement>('[data-boot-row]')]
    root.addEventListener('pointermove', this.move)
    root.addEventListener('pointerleave', this.leave)
    document.addEventListener('visibilitychange', this.visibility)
    this.reduced.addEventListener('change', this.visibility)
    this.visibility()
  }
  private readonly move = (event: PointerEvent) => {
    if (this.reduced.matches) return
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-boot-row]') : null
    if (!row || !this.root.contains(row)) return
    this.pointerUntil = this.clock + 1000
    this.admit(row, .5 + .45 * Math.min(1, event.clientX / Math.max(1, innerWidth)))
  }
  private readonly leave = () => {
    for (const band of this.bands.values()) band.retire = Math.min(band.retire, this.clock)
  }
  admit(row: HTMLElement, target = 1) {
    if (this.disposed || this.reduced.matches || !this.rows.includes(row)) return
    let band = this.bands.get(row)
    if (!band) {
      if (this.bands.size === 8) this.remove(this.bands.values().next().value!)
      band = {row, cells:[...row.querySelectorAll<HTMLElement>('.terminal-value')].map(element =>
        ({element,characters:Math.max(1,element.firstElementChild?.textContent?.length ?? 1),painted:-1})),
      from:0,value:0,target:0,at:this.clock,duration:130,retire:0}
      this.bands.set(row, band)
    }
    band.from = band.value
    band.target = Math.max(0, Math.min(1, target))
    band.at = this.clock
    band.duration = 130
    band.retire = this.clock + 260 + (this.rows.indexOf(row) % 4) * 35
  }
  private remove(band: Band) {
    for (const cell of band.cells) cell.element.style.removeProperty('--boot-band')
    this.bands.delete(band.row)
  }
  private readonly tick = (now: number) => {
    if (this.disposed || document.hidden || this.reduced.matches) return
    this.clock += this.last ? Math.min(50, now - this.last) : 0
    this.last = now
    if (this.clock >= this.nextIdle && this.clock > this.pointerUntil && this.rows.length) {
      this.admit(this.rows[this.idleRow++ % this.rows.length], .85)
      this.nextIdle = this.clock + 900
    }
    for (const band of this.bands.values()) {
      if (this.clock >= band.retire && band.target !== 0) {
        band.from = band.value; band.target = 0; band.at = this.clock
        band.duration = 300 + (this.rows.indexOf(band.row) % 3) * 45
      }
      band.value = band.from + (band.target - band.from) * smooth((this.clock - band.at) / band.duration)
      for (const cell of band.cells) {
        const characters = Math.ceil(cell.characters * band.value)
        if (characters !== cell.painted) {
          cell.element.style.setProperty('--boot-band', `${characters / cell.characters * 100}%`)
          cell.painted = characters
        }
      }
      if (band.target === 0 && this.clock - band.at >= band.duration) this.remove(band)
    }
    this.raf = requestAnimationFrame(this.tick)
  }
  private readonly visibility = () => {
    cancelAnimationFrame(this.raf); this.last = 0
    if (this.reduced.matches) for (const band of [...this.bands.values()]) this.remove(band)
    if (!this.disposed && !document.hidden && !this.reduced.matches) this.raf = requestAnimationFrame(this.tick)
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf)
    this.root.removeEventListener('pointermove', this.move)
    this.root.removeEventListener('pointerleave', this.leave)
    document.removeEventListener('visibilitychange', this.visibility)
    this.reduced.removeEventListener('change', this.visibility)
    for (const band of [...this.bands.values()]) this.remove(band)
  }
}
