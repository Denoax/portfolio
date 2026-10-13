import { glassDisplacement, glassOptics } from '../../core/glassOptics'

const namespace = 'http://www.w3.org/2000/svg'
const paintProperties = [
  'display',
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'color',
  'white-space',
  'width',
  'height',
  'min-width',
  'max-width',
  'max-height',
  'margin',
  'padding',
  'gap',
  'align-items',
  'justify-content',
  'flex-direction',
  'grid-template-columns',
  'grid-template-rows',
  'border-radius',
  'background-color',
  'border',
  'box-sizing',
  'object-fit',
  'opacity',
]
let identity = 0
type Copy = {
  source: HTMLElement
  element: HTMLElement
  viewport: HTMLDivElement | null
  live: { source: HTMLElement; copy: HTMLElement }[]
  width: number
  height: number
}
type Pane = {
  root: HTMLDivElement
  svg: SVGSVGElement
  image: SVGFEImageElement
  filter: SVGFilterElement
  copies: Copy[]
  content: string
  geometry: string
}
type Exclusion = {
  image: string
  webkit: string
  repeat: string
  mask: SVGMaskElement
  paths: SVGPathElement[]
}

// One manager owns substrate copies and the union of their source exclusions.
// Overlapping black mask shapes remain a union; overlapping even-odd holes do not.
export class GlassDomMirror {
  maps = 0
  readonly metrics = {
    maps: 0,
    contentBuilds: 0,
    activePanes: 0,
    copies: 0,
    mapCache: 0,
  }
  private panes = new Map<HTMLElement, Pane>()
  private exclusions = new Map<HTMLElement, Exclusion>()
  private mapsByGeometry = new Map<string, string>()
  private masks: SVGSVGElement | null = null
  private colors = ''
  clear() {
    for (const pane of this.panes.values()) pane.root.remove()
    this.panes.clear()
    for (const [source, exclusion] of this.exclusions)
      this.restore(source, exclusion)
    this.exclusions.clear()
    this.masks?.remove()
    this.masks = null
    this.metrics.activePanes = this.metrics.copies = 0
  }
  dispose() {
    this.clear()
    this.mapsByGeometry.clear()
  }
  private restore(source: HTMLElement, exclusion: Exclusion) {
    source.style.maskImage = exclusion.image
    source.style.setProperty('-webkit-mask-image', exclusion.webkit)
    source.style.maskRepeat = exclusion.repeat
    exclusion.mask.remove()
  }
  private typography(source: HTMLElement, copy: HTMLElement) {
    const style = getComputedStyle(source)
    for (const property of paintProperties)
      copy.style.setProperty(property, style.getPropertyValue(property))
  }
  private clone(
    source: HTMLElement,
    live: { source: HTMLElement; copy: HTMLElement }[],
  ): HTMLElement {
    const image =
      source instanceof HTMLImageElement &&
      source.currentSrc.startsWith(location.origin)
    const copy = document.createElement(
      image ? 'img' : source instanceof HTMLBRElement ? 'br' : 'div',
    )
    this.typography(source, copy)
    if (source.matches('.gravity-glyph,.gravity-glyph-content'))
      live.push({ source, copy })
    copy.style.pointerEvents = 'none'
    if (image) {
      ;(copy as HTMLImageElement).src = source.currentSrc
      ;(copy as HTMLImageElement).alt = ''
    } else {
      for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          copy.append(document.createTextNode(child.textContent ?? ''))
        else if (
          child instanceof HTMLElement &&
          !child.matches('canvas,video,[data-glass-copy]')
        )
          copy.append(this.clone(child, live))
      }
    }
    return copy
  }
  update(elements: readonly HTMLElement[]) {
    const active = elements.filter(
      (e) => e.isConnected && e.dataset.glassMode === 'gpu',
    )
    for (const [element, pane] of this.panes)
      if (!active.includes(element)) {
        pane.root.remove()
        this.panes.delete(element)
      }
    if (!active.length) {
      if (this.exclusions.size) this.clear()
      return
    }
    const sources = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-glass-substrate],.hub-brand,.utility-toggle',
      ),
    ].filter((element) => {
      const reel = element.matches('.menu-project,.menu-native-panel')
      const style = getComputedStyle(element)
      return (
        element.getClientRects().length &&
        !element.closest('[hidden],[data-glass-copy],dialog') &&
        (reel || !element.closest('[inert],[data-current="false"]')) &&
        !element.parentElement?.closest('[data-glass-substrate]') &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0.001
      )
    })
    const content = sources
      .map(
        (e) =>
          `${e.dataset.projectId ?? ''}:${e.textContent}:${e.querySelector('img')?.currentSrc ?? ''}`,
      )
      .join('|')
    const colorKey = `${document.documentElement.dataset.colorTheme}:${Math.round(Number(document.documentElement.dataset.themeMix ?? 0) * 8)}`
    const colorChanged = colorKey !== this.colors
    this.colors = colorKey
    const retained = new Set<HTMLElement>()
    for (const element of active) {
      const rect = element.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      let pane = this.panes.get(element)
      if (!pane) {
        const root = document.createElement('div')
        root.className = 'glass-dom-backdrop'
        root.dataset.glassCopy = ''
        root.inert = true
        root.setAttribute('aria-hidden', 'true')
        const svg = document.createElementNS(namespace, 'svg'),
          filter = document.createElementNS(namespace, 'filter'),
          image = document.createElementNS(namespace, 'feImage')
        svg.setAttribute('width', '0')
        svg.setAttribute('height', '0')
        const id = `glass-substrate-${++identity}`
        filter.id = id
        filter.setAttribute('x', '0')
        filter.setAttribute('y', '0')
        filter.setAttribute('width', '100%')
        filter.setAttribute('height', '100%')
        filter.setAttribute('color-interpolation-filters', 'sRGB')
        image.setAttribute('result', 'map')
        filter.append(image)
        const displacement = document.createElementNS(
          namespace,
          'feDisplacementMap',
        )
        displacement.setAttribute('in', 'SourceGraphic')
        displacement.setAttribute('in2', 'map')
        displacement.setAttribute('scale', '128')
        displacement.setAttribute('xChannelSelector', 'R')
        displacement.setAttribute('yChannelSelector', 'G')
        filter.append(displacement)
        svg.append(filter)
        root.append(svg)
        root.style.filter = `url(#${id})`
        element.prepend(root)
        pane = {
          root,
          svg,
          image,
          filter,
          copies: [],
          content: '',
          geometry: '',
        }
        this.panes.set(element, pane)
      }
      pane.root.style.borderRadius = getComputedStyle(element).borderRadius
      const front = Number(element.dataset.paneFront ?? 1)
      pane.root.style.clipPath = `inset(0 0 ${Math.max(0, (1 - front) * rect.height)}px 0)`
      if (pane.content !== content) {
        for (const copy of pane.copies) (copy.viewport ?? copy.element).remove()
        pane.copies = sources.map((source) => {
          const live: { source: HTMLElement; copy: HTMLElement }[] = []
          const copy = this.clone(source, live)
          const viewportSource = source.closest<HTMLElement>(
            '.menu-text-viewport',
          )
          const viewport = viewportSource ? document.createElement('div') : null
          if (viewport) {
            viewport.style.position = 'absolute'
            viewport.style.pointerEvents = 'none'
            viewport.append(copy)
            pane!.root.append(viewport)
          } else pane!.root.append(copy)
          Object.assign(copy.style, {
            position: 'absolute',
            margin: '0',
            transformOrigin: '0 0',
          })
          return { source, element: copy, viewport, live, width: 0, height: 0 }
        })
        pane.content = content
        this.metrics.contentBuilds++
      }
      const profile = glassOptics(
        rect.width,
        rect.height,
        parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
        true,
      )
      const width = Math.max(1, Math.round(rect.width)),
        height = Math.max(1, Math.round(rect.height))
      const key = `${width}:${height}:${profile.radius.toFixed(2)}:${profile.bevel.toFixed(2)}:${profile.magnification}:${profile.bend}`
      if (pane.geometry !== key) {
        let uri = this.mapsByGeometry.get(key)
        if (!uri) {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!,
            pixels = ctx.createImageData(width, height)
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              const shift = glassDisplacement(
                  x + 0.5,
                  y + 0.5,
                  width,
                  height,
                  profile,
                ),
                i = (y * width + x) * 4
              pixels.data[i] = Math.round(127.5 + (shift.x / 128) * 255)
              pixels.data[i + 1] = Math.round(127.5 + (shift.y / 128) * 255)
              pixels.data[i + 2] = 128
              pixels.data[i + 3] = 255
            }
          ctx.putImageData(pixels, 0, 0)
          uri = canvas.toDataURL('image/png')
          this.mapsByGeometry.set(key, uri)
          this.maps++
          if (this.mapsByGeometry.size > 12)
            this.mapsByGeometry.delete(this.mapsByGeometry.keys().next().value!)
        }
        pane.image.setAttribute('href', uri)
        pane.image.setAttribute('width', String(width))
        pane.image.setAttribute('height', String(height))
        pane.geometry = key
      }
      for (const copy of pane.copies) {
        const source = copy.source,
          projected = source.matches('.menu-project,.menu-native-panel'),
          r = source.getBoundingClientRect()
        const width = projected ? source.offsetWidth : r.width,
          height = projected ? source.offsetHeight : r.height
        if (colorChanged || copy.width !== width || copy.height !== height) {
          this.typography(source, copy.element)
          const descendants = [
            ...source.querySelectorAll<HTMLElement>('*'),
          ].filter((n) => !n.matches('canvas,video,svg,svg *'))
          const copies = [...copy.element.querySelectorAll<HTMLElement>('*')]
          descendants.forEach((n, i) => {
            if (copies[i]) this.typography(n, copies[i])
          })
          copy.width = width
          copy.height = height
        }
        Object.assign(copy.element.style, {
          position: 'absolute',
          margin: '0',
          width: `${width}px`,
          height: `${height}px`,
          left: projected ? '0px' : `${r.left - rect.left}px`,
          top: projected ? '0px' : `${r.top - rect.top}px`,
          transform: copy.viewport
            ? source.style.transform
            : projected
              ? `translate(${-rect.left}px,${-rect.top}px) ${source.style.transform}`
              : 'none',
        })
        if (copy.viewport) {
          Object.assign(copy.viewport.style, {
            left: `${-rect.left}px`,
            top: `${-rect.top}px`,
            width: `${innerWidth}px`,
            height: `${innerHeight}px`,
            clipPath: getComputedStyle(source.closest('.menu-text-viewport')!)
              .clipPath,
          })
        }
        copy.element.style.opacity = getComputedStyle(source).opacity
        for (const item of copy.live) {
          const style = getComputedStyle(item.source)
          for (const property of ['transform', 'opacity'])
            if (
              item.copy.style.getPropertyValue(property) !==
              style.getPropertyValue(property)
            )
              item.copy.style.setProperty(
                property,
                style.getPropertyValue(property),
              )
        }
        retained.add(source)
      }
    }
    this.paintExclusions(retained, active)
    this.metrics.maps = this.maps
    this.metrics.activePanes = this.panes.size
    this.metrics.copies = [...this.panes.values()].reduce(
      (n, p) => n + p.copies.length,
      0,
    )
    this.metrics.mapCache = this.mapsByGeometry.size
  }
  private paintExclusions(
    sources: Set<HTMLElement>,
    panes: readonly HTMLElement[],
  ) {
    if (!this.masks) {
      this.masks = document.createElementNS(namespace, 'svg')
      this.masks.setAttribute('width', '0')
      this.masks.setAttribute('height', '0')
      this.masks.style.position = 'fixed'
      this.masks.style.pointerEvents = 'none'
      document.body.append(this.masks)
    }
    for (const [source, exclusion] of this.exclusions)
      if (!sources.has(source)) {
        this.restore(source, exclusion)
        this.exclusions.delete(source)
      }
    for (const source of sources) {
      let exclusion = this.exclusions.get(source)
      if (!exclusion) {
        const mask = document.createElementNS(namespace, 'mask')
        mask.id = `glass-exclusion-${++identity}`
        mask.setAttribute('maskUnits', 'userSpaceOnUse')
        mask.setAttribute('maskContentUnits', 'userSpaceOnUse')
        mask.setAttribute('mask-type', 'luminance')
        const background = document.createElementNS(namespace, 'rect')
        background.setAttribute('width', '100%')
        background.setAttribute('height', '100%')
        background.setAttribute('fill', 'white')
        mask.append(background)
        this.masks.append(mask)
        exclusion = {
          image: source.style.maskImage,
          webkit: source.style.getPropertyValue('-webkit-mask-image'),
          repeat: source.style.maskRepeat,
          mask,
          paths: [],
        }
        this.exclusions.set(source, exclusion)
        source.style.maskImage = `url(#${mask.id})`
        source.style.maskRepeat = 'no-repeat'
      }
      const projected = source.matches('.menu-project,.menu-native-panel'),
        bounds = source.getBoundingClientRect()
      const sourceWidth = projected ? source.offsetWidth : bounds.width,
        sourceHeight = projected ? source.offsetHeight : bounds.height
      exclusion.mask.setAttribute('x', '0')
      exclusion.mask.setAttribute('y', '0')
      exclusion.mask.setAttribute('width', String(sourceWidth))
      exclusion.mask.setAttribute('height', String(sourceHeight))
      exclusion.mask.firstElementChild?.setAttribute(
        'width',
        String(sourceWidth),
      )
      exclusion.mask.firstElementChild?.setAttribute(
        'height',
        String(sourceHeight),
      )
      const inverse = projected
        ? new DOMMatrix(
            source.style.transform && source.style.transform !== 'none'
              ? source.style.transform
              : undefined,
          ).inverse()
        : null
      const local = (x: number, y: number) => {
        if (inverse) {
          const p = new DOMPoint(x, y).matrixTransform(inverse)
          return { x: p.x / p.w, y: p.y / p.w }
        }
        return { x: x - bounds.left, y: y - bounds.top }
      }
      while (exclusion.paths.length < panes.length) {
        const p = document.createElementNS(namespace, 'path')
        p.setAttribute('fill', 'black')
        exclusion.mask.append(p)
        exclusion.paths.push(p)
      }
      exclusion.paths.forEach((path, index) => {
        const pane = panes[index]
        if (!pane) {
          path.setAttribute('d', '')
          return
        }
        const r = pane.getBoundingClientRect(),
          radius = Math.min(
            parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0,
            r.width / 2,
            r.height / 2,
          ),
          front = Number(pane.dataset.paneFront ?? 1)
        const bottom = Math.min(r.bottom, r.top + r.height * front),
          points: { x: number; y: number }[] = []
        for (const [cx, cy, start] of [
          [r.right - radius, r.top + radius, -Math.PI / 2],
          [r.right - radius, r.bottom - radius, 0],
          [r.left + radius, r.bottom - radius, Math.PI / 2],
          [r.left + radius, r.top + radius, Math.PI],
        ])
          for (let k = 0; k <= 5; k++) {
            const a = start + (k * Math.PI) / 10
            points.push(
              local(
                cx + Math.cos(a) * radius,
                Math.min(bottom, cy + Math.sin(a) * radius),
              ),
            )
          }
        const value =
          front <= 0
            ? ''
            : points
                .map(
                  (p, i) =>
                    `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
                )
                .join('') + 'Z'
        if (path.getAttribute('d') !== value) path.setAttribute('d', value)
      })
    }
  }
}
