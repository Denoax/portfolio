import { paneNativeFront, paneFlightOpacity } from '../../core/paneFlight'
import type { FlightRect, Point2, TileFlight } from '../../core/paneFlight'
import { paintPane } from './paintPane'

type Group = {
  element: HTMLElement
  top: number
  height: number
  clip: string
  pointer: string
}
export interface PaneFlightField {
  key: string
  node: HTMLElement
  trigger: HTMLElement | null
  epoch: number
  elapsed: number
  flight: TileFlight
  fromFront: number
  fromAlpha: number
  front: number
  paint: HTMLCanvasElement
  pane: boolean
  themed: boolean
  groups: Group[]
  controls: Map<HTMLElement, boolean>
  theme: string
  paintVersion: number
  content: string
}
const contentOf = (node: HTMLElement) =>
  [...node.children]
    .filter((e) => !e.hasAttribute('data-glass-copy'))
    .map((e) => e.textContent)
    .join('|') +
  '|' +
  [...node.querySelectorAll<HTMLInputElement>('input')]
    .map((e) => `${e.value}:${e.checked}`)
    .join('|') +
  '|' +
  [...node.querySelectorAll<HTMLElement>('[role=tab]')]
    .map((e) => e.getAttribute('aria-selected'))
    .join('|') +
  '|' +
  [...node.querySelectorAll<HTMLImageElement>('img')]
    .filter((e) => !e.closest('[data-glass-copy]'))
    .map((e) => Number(e.complete))
    .join('|')
const rectOf = (r: DOMRect): FlightRect => ({
  x: r.left,
  y: r.top,
  width: r.width,
  height: r.height,
})

// Hooks own logical visibility; this registry owns only transient paint. One
// existing GlassLayer advances it. There are no per-pane RAFs or loader gates.
class PaneFlightRegistry {
  available = false
  readonly fields = new Map<string, PaneFlightField>()
  readonly metrics = {
    requests: 0,
    paints: 0,
    retargets: 0,
    active: 0,
    tiles: 0,
    draws: 0,
    textureUploads: 0,
    paintMs: 0,
    maxPaintMs: 0,
    frameMs: 0,
    maxFrameMs: 0,
    degradedTileSize: 4,
  }
  private sequence = 0
  enabled(node: HTMLElement) {
    return (
      this.available &&
      !document.hidden &&
      !matchMedia(
        '(prefers-reduced-motion:reduce),(forced-colors:active),(prefers-reduced-transparency:reduce)',
      ).matches &&
      !document.querySelector('[data-reduced="true"]') &&
      (!node.matches('.portfolio-nav-shell') ||
        matchMedia('(max-width:899px)').matches)
    )
  }
  private key(node: HTMLElement) {
    return node.id || node.getAttribute('aria-labelledby') || node.className
  }
  fieldFor(node: HTMLElement) {
    return this.fields.get(
      this.key(node.closest<HTMLElement>('[data-pane-flight]') ?? node),
    )
  }
  request(node: HTMLElement, opening: boolean, origin?: HTMLElement | null) {
    const key = this.key(node),
      existing = this.fields.get(key)
    if (!this.enabled(node)) {
      if (existing) this.restore(existing)
      this.fields.delete(key)
      return
    }
    if (!opening && !existing) return
    const rect = node.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) {
      if (existing && !opening) {
        this.restore(existing)
        existing.flight = { ...existing.flight, opening: false, progress: 0 }
        existing.elapsed = 0
        existing.flight.duration = 0.36
        existing.epoch = ++this.sequence
      }
      return
    }
    const anchorRect = origin?.getBoundingClientRect()
    const anchor: Point2 = anchorRect
      ? { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.bottom }
      : (existing?.flight.anchor ?? {
          x: rect.left + rect.width / 2,
          y: rect.top,
        })
    const fromFront = existing?.front ?? 0
    const fromAlpha = existing
      ? paneFlightOpacity(
          existing.flight.progress,
          existing.flight.opening,
          existing.fromAlpha,
        )
      : opening
        ? 0
        : 1
    if (existing) this.restore(existing)
    const start = performance.now(),
      paint = paintPane(node, rect.width, rect.height)
    const paintMs = performance.now() - start
    this.metrics.paints++
    this.metrics.paintMs += paintMs
    this.metrics.maxPaintMs = Math.max(this.metrics.maxPaintMs, paintMs)
    const field: PaneFlightField = {
      key,
      node,
      trigger: origin ?? existing?.trigger ?? null,
      epoch: ++this.sequence,
      elapsed: 0,
      flight: {
        rect: rectOf(rect),
        anchor,
        opening,
        progress: 0,
        duration: opening ? 0.72 : 0.36,
        viewportWidth: innerWidth,
      },
      fromFront: opening ? fromFront : 0,
      fromAlpha,
      front: opening ? fromFront : 0,
      paint,
      pane: node.matches('dialog'),
      themed: node.matches('.experience-settings,.portfolio-nav-shell'),
      groups: [],
      controls: new Map(),
      theme: document.documentElement.dataset.colorTheme ?? '',
      paintVersion: 0,
      content: contentOf(node),
    }
    if (!existing && this.fields.size >= 4) {
      const oldest =
        [...this.fields.values()].find((f) => !f.flight.opening) ??
        this.fields.values().next().value!
      this.restore(oldest)
      this.fields.delete(oldest.key)
    }
    if (existing) this.metrics.retargets++
    this.metrics.requests++
    this.fields.set(key, field)
    if (opening) this.prepare(field)
  }
  private prepare(field: PaneFlightField) {
    const node = field.node
    node.dataset.paneFlight = field.key
    node.dataset.paneFlightState = 'opening'
    node.dataset.paneFront = String(field.front)
    const selector = node.matches('.portfolio-nav-shell')
      ? ':scope > *'
      : '.settings-heading h2,.settings-body,.info-body,.help-heading > :not(button),.help-body,.index-heading h2,.projects-index-rows'
    field.groups = [...node.querySelectorAll<HTMLElement>(selector)].map(
      (element) => {
        const r = element.getBoundingClientRect()
        return {
          element,
          top: r.top - field.flight.rect.y,
          height: r.height,
          clip: element.style.clipPath,
          pointer: element.style.pointerEvents,
        }
      },
    )
    for (const control of node.querySelectorAll<HTMLElement>(
      'button,a,input,[tabindex],.angry-slider-gesture,.settings-motion',
    ))
      if (
        !control.matches('.pane-close') &&
        !control.closest('[data-glass-copy]')
      )
        field.controls.set(control, control.inert)
    this.paintFront(field)
  }
  private paintFront(field: PaneFlightField) {
    const visible = field.front * field.flight.rect.height
    field.node.dataset.paneFront = String(field.front)
    field.node.style.setProperty('--pane-front-px', `${visible}px`)
    field.node.style.setProperty(
      '--pane-hidden-px',
      `${Math.max(0, field.flight.rect.height - visible)}px`,
    )
    for (const group of field.groups) {
      const hidden = Math.max(
        0,
        group.height - Math.max(0, visible - group.top),
      )
      group.element.style.clipPath = `inset(0 0 ${hidden}px 0)`
      group.element.style.pointerEvents = visible > group.top ? 'auto' : 'none'
    }
    for (const [element, inert] of field.controls) {
      const bottom =
        element.getBoundingClientRect().bottom - field.flight.rect.y
      element.inert = inert || bottom > visible + 0.5
    }
  }
  private restore(field: PaneFlightField) {
    for (const group of field.groups) {
      group.element.style.clipPath = group.clip
      group.element.style.pointerEvents = group.pointer
    }
    for (const [element, inert] of field.controls) element.inert = inert
    delete field.node.dataset.paneFlight
    delete field.node.dataset.paneFlightState
    delete field.node.dataset.paneFront
    field.node.style.removeProperty('--pane-front-px')
    field.node.style.removeProperty('--pane-hidden-px')
    field.groups = []
    field.controls.clear()
  }
  step(dt: number) {
    const start = performance.now()
    for (const [key, field] of this.fields) {
      if (field.flight.progress === 1 && field.flight.opening) {
        if (
          !field.node.isConnected ||
          (field.node instanceof HTMLDialogElement && !field.node.open)
        ) {
          this.restore(field)
          this.fields.delete(key)
        }
        continue
      }
      if (field.flight.opening && field.node.isConnected) {
        const r = field.node.getBoundingClientRect(),
          old = field.flight.rect
        const resized =
          Math.abs(r.width - old.width) > 1 ||
          Math.abs(r.height - old.height) > 1
        const theme = document.documentElement.dataset.colorTheme ?? '',
          mix = Number(document.documentElement.dataset.themeMix)
        const themeSettled =
          mix === Number(theme === 'light') && theme !== field.theme
        field.flight.viewportWidth = innerWidth
        if (
          field.trigger?.isConnected &&
          field.trigger.getClientRects().length
        ) {
          const anchor = field.trigger.getBoundingClientRect()
          field.flight.anchor = {
            x: anchor.left + anchor.width / 2,
            y: anchor.bottom,
          }
        }
        if (r.width > 0 && r.height > 0) {
          if (resized) {
            const front = field.front
            field.fromAlpha = paneFlightOpacity(
              field.flight.progress,
              true,
              field.fromAlpha,
            )
            this.restore(field)
            field.fromFront = front
            field.elapsed = 0
            field.flight = {
              ...field.flight,
              rect: rectOf(r),
              progress: 0,
              duration: Math.max(0.16, 0.72 * (1 - front)),
              viewportWidth: innerWidth,
            }
            field.epoch = ++this.sequence
            this.metrics.retargets++
            this.prepare(field)
          } else {
            field.flight.rect.x = r.left
            field.flight.rect.y = r.top
          }
          const content = contentOf(field.node)
          if (resized || themeSettled || content !== field.content) {
            const at = performance.now()
            field.paint = paintPane(field.node, r.width, r.height, field.paint)
            field.paintVersion++
            field.theme = theme
            field.content = content
            this.metrics.paints++
            const ms = performance.now() - at
            this.metrics.paintMs += ms
            this.metrics.maxPaintMs = Math.max(this.metrics.maxPaintMs, ms)
          }
        }
      }
      if (document.hidden || !this.enabled(field.node)) {
        field.elapsed = field.flight.duration
      } else field.elapsed += Math.max(0, Math.min(0.05, dt))
      field.flight.progress = Math.min(1, field.elapsed / field.flight.duration)
      if (field.flight.opening) {
        field.front = paneNativeFront(
          field.flight.progress,
          true,
          field.fromFront,
        )
        this.paintFront(field)
      }
      if (field.flight.progress === 1) {
        this.restore(field)
        if (!field.flight.opening) this.fields.delete(key)
      }
    }
    this.metrics.active = [...this.fields.values()].filter(
      (f) => f.flight.progress < 1,
    ).length
    const elapsed = performance.now() - start
    this.metrics.frameMs = elapsed
    this.metrics.maxFrameMs = Math.max(this.metrics.maxFrameMs, elapsed)
  }
  finish() {
    for (const field of this.fields.values()) this.restore(field)
    this.fields.clear()
    this.metrics.active = 0
  }
}
export const paneFlights = new PaneFlightRegistry()
