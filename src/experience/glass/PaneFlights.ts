import { paneNativeFront, paneFlightOpacity, MENU_OPEN_SECONDS, MENU_CLOSE_SECONDS } from '../../core/paneFlight'
import type { FlightRect, Point2, TileFlight } from '../../core/paneFlight'
import { paintPane } from './paintPane'

type Group = {
  element: HTMLElement
  top: number
  height: number
  clip: string
  mask: string
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
  lightPaint?: HTMLCanvasElement
  pane: boolean
  themed: boolean
  groups: Group[]
  controls: Map<HTMLElement, { inert: boolean; bottom: number }>
  radius: number
  layoutDirty: boolean
  paintDirty: boolean
  cleanup: () => void
  theme: string
  paintVersion: number
  content: string
  fontState: string
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
    reusedPaints: 0,
    geometryBuilds: 0,
    geometryUploads: 0,
    layoutRebuilds: 0,
  }
  private sequence = 0
  private paintSequence = 0
  private clickedOrigin: HTMLElement | null = null
  private origins = new WeakMap<HTMLElement, { rect: FlightRect; at: number }>()
  private paints = new WeakMap<HTMLElement, { paint: HTMLCanvasElement; lightPaint?: HTMLCanvasElement; paintVersion: number; content: string; theme: string; width: number; height: number; fontState: string }>()
  captureOrigin(event: MouseEvent) {
    if (!this.available || !(event.target instanceof Element)) return
    const origin = event.target.closest<HTMLElement>('button')
    if (!origin) return
    const r = origin.getBoundingClientRect()
    if (r.width && r.height) {
      this.clickedOrigin = origin
      this.origins.set(origin, { rect: rectOf(r), at: performance.now() })
    }
  }
  recentOrigin() {
    const origin = this.clickedOrigin
    return origin && performance.now() - (this.origins.get(origin)?.at ?? -Infinity) < 200 ? origin : null
  }
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
        existing.flight.duration = MENU_CLOSE_SECONDS
        existing.epoch = ++this.sequence
      }
      return
    }
    const visibleRect = origin?.getBoundingClientRect()
    const captured = origin ? this.origins.get(origin) : null
    const anchorRect = visibleRect?.width ? rectOf(visibleRect) : captured && performance.now() - captured.at < 200 ? captured.rect : null
    const anchor: Point2 = anchorRect
      ? { x: anchorRect.x + anchorRect.width / 2, y: anchorRect.y + anchorRect.height }
      : (existing?.flight.anchor ?? {
          x: rect.left + rect.width / 2,
          y: rect.top,
        })
    const fromFront = existing?.flight.opening ? existing.front : 0
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
    const themed = node.matches('.experience-settings,.portfolio-nav-shell')
    const theme = themed ? 'paired' : (document.documentElement.dataset.colorTheme ?? '')
    const content = contentOf(node)
    const fontState = `${document.fonts.status}:${document.fonts.size}`
    const cached = this.paints.get(node)
    const reusable = cached && cached.fontState === fontState && !node.querySelector('.angry-slider-gesture:not([data-slider-phase="idle"])') && cached.content === content && cached.theme === theme &&
      Math.abs(cached.width - rect.width) < 1 && Math.abs(cached.height - rect.height) < 1
    const start = performance.now()
    const paint = reusable ? cached.paint : paintPane(node, rect.width, rect.height, cached?.paint, themed ? 'dark' : undefined)
    const lightPaint = themed
      ? reusable ? cached.lightPaint : paintPane(node, rect.width, rect.height, cached?.lightPaint, 'light')
      : undefined
    const paintVersion = reusable ? cached.paintVersion : ++this.paintSequence
    if (reusable) this.metrics.reusedPaints++
    else {
      const paintMs = performance.now() - start
      this.metrics.paints++
      this.metrics.paintMs += paintMs
      this.metrics.maxPaintMs = Math.max(this.metrics.maxPaintMs, paintMs)
      this.paints.set(node, { paint, lightPaint, paintVersion, content, theme, width: rect.width, height: rect.height, fontState })
    }
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
        duration: opening ? MENU_OPEN_SECONDS : MENU_CLOSE_SECONDS,
        apertureWidth: Math.min(48, (anchorRect?.width ?? 80) * 0.6) * 0.65,
        fresh: opening && !existing,
        viewportWidth: innerWidth,
      },
      fromFront: opening ? fromFront : 0,
      fromAlpha,
      front: opening ? fromFront : 0,
      paint,
      lightPaint,
      pane: node.matches('dialog'),
      themed,
      groups: [],
      controls: new Map(),
      radius: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
      layoutDirty: true,
      paintDirty: false,
      cleanup: () => {},
      theme,
      paintVersion,
      content,
      fontState,
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
          mask: element.style.maskImage,
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
        field.controls.set(control, { inert: control.inert, bottom: control.getBoundingClientRect().bottom - field.flight.rect.y })
    this.metrics.layoutRebuilds++
    field.layoutDirty = false
    const dirty = () => { field.paintDirty = true; field.layoutDirty = true }
    const resize = new ResizeObserver(() => { field.layoutDirty = true })
    resize.observe(node)
    const mutation = new MutationObserver(dirty)
    mutation.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src', 'aria-selected', 'value', 'checked'] })
    node.addEventListener('input', dirty)
    node.addEventListener('change', dirty)
    node.addEventListener('load', dirty, true)
    document.fonts.addEventListener('loadingdone', dirty)
    field.cleanup = () => {
      resize.disconnect(); mutation.disconnect()
      node.removeEventListener('input', dirty); node.removeEventListener('change', dirty); node.removeEventListener('load', dirty, true)
      document.fonts.removeEventListener('loadingdone', dirty)
    }
    this.paintFront(field)
  }
  private paintFront(field: PaneFlightField) {
    const visible = field.front * field.flight.rect.height
    const seam = Math.min(10, field.flight.rect.height - visible)
    field.node.dataset.paneFront = String(field.front)
    field.node.style.setProperty('--pane-front-px', `${visible}px`)
    field.node.style.setProperty('--pane-solid-px', `${Math.max(0, visible - seam)}px`)
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
      group.element.style.maskImage = `linear-gradient(to bottom, black ${Math.max(0, visible - seam - group.top)}px, transparent ${Math.max(0, visible - group.top)}px)`
      group.element.style.pointerEvents = visible > group.top ? 'auto' : 'none'
    }
    for (const [element, control] of field.controls)
      element.inert = control.inert || control.bottom > visible + 0.5
  }
  private restore(field: PaneFlightField) {
    for (const group of field.groups) {
      group.element.style.clipPath = group.clip
      group.element.style.maskImage = group.mask
      group.element.style.pointerEvents = group.pointer
    }
    field.cleanup()
    for (const [element, control] of field.controls) element.inert = control.inert
    delete field.node.dataset.paneFlight
    delete field.node.dataset.paneFlightState
    delete field.node.dataset.paneFront
    field.node.style.removeProperty('--pane-front-px')
    field.node.style.removeProperty('--pane-solid-px')
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
        const theme = field.themed ? 'paired' : (document.documentElement.dataset.colorTheme ?? '')
        const themeChanged = theme !== field.theme
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
              duration: Math.max(0.2, MENU_OPEN_SECONDS * (1 - front)),
              fresh: false,
              viewportWidth: innerWidth,
            }
            field.epoch = ++this.sequence
            this.metrics.retargets++
            this.prepare(field)
          } else {
            field.flight.rect.x = r.left
            field.flight.rect.y = r.top
          }
          const content = field.paintDirty ? contentOf(field.node) : field.content
          const fontState = `${document.fonts.status}:${document.fonts.size}`
          // React/mirror bookkeeping may mutate nodes without changing paint.
          // Theme uniforms already own colour interpolation; refresh the atlas
          // only for genuine content, font, layout or active-control changes.
          const changedPaint = field.paintDirty && (content !== field.content || fontState !== field.fontState ||
            Boolean(field.node.querySelector('.angry-slider-gesture:not([data-slider-phase="idle"])')))
          if (resized || themeChanged || changedPaint) {
            const at = performance.now()
            field.paint = paintPane(field.node, r.width, r.height, field.paint, field.themed ? 'dark' : undefined)
            if (field.themed) field.lightPaint = paintPane(field.node, r.width, r.height, field.lightPaint, 'light')
            field.paintVersion = ++this.paintSequence
            field.theme = theme
            field.content = content
            field.paintDirty = false
            field.fontState = fontState
            this.paints.set(field.node, { paint: field.paint, lightPaint: field.lightPaint, paintVersion: field.paintVersion, content, theme, width: r.width, height: r.height, fontState: field.fontState })
            this.metrics.paints++
            const ms = performance.now() - at
            this.metrics.paintMs += ms
            this.metrics.maxPaintMs = Math.max(this.metrics.maxPaintMs, ms)
          }
          // Geometry reads precede the reveal writes below. Resize has already
          // rebuilt groups; value/image/font changes refresh only local bounds.
          if (field.layoutDirty) {
            for (const group of field.groups) {
              const box = group.element.getBoundingClientRect()
              group.top = box.top - r.top; group.height = box.height
            }
            for (const [element, control] of field.controls)
              control.bottom = element.getBoundingClientRect().bottom - r.top
            field.layoutDirty = false
            this.metrics.layoutRebuilds++
          }
          field.paintDirty = false
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
          field.flight.fresh !== false,
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
    this.clickedOrigin = null
    this.origins = new WeakMap()
    this.metrics.active = 0
  }
}
export const paneFlights = new PaneFlightRegistry()
