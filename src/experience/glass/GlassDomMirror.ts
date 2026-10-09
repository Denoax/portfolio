// Only owned decorative HTML is copied. No canvas, video, scene screenshot or
// interaction is cloned. This supplies text pixels behind a native dialog lens.
export class GlassDomMirror {
  maps = 0
  private styled: { source: HTMLElement; copy: HTMLElement }[] = []
  private dialog: HTMLElement | null = null
  private root: HTMLDivElement | null = null
  private originals: {
    element: HTMLElement
    clip: string
    copy: HTMLElement
  }[] = []
  private url: string | null = null
  private key = ''
  private generation = 0
  private x = 0
  private y = 0
  private layout = ''
  clear() {
    this.generation++
    for (const { element, clip } of this.originals)
      element.style.clipPath = clip
    this.originals = []
    this.styled = []
    this.root?.remove()
    this.root = null
    this.dialog = null
    this.key = ''
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }
  dispose() {
    this.clear()
  }
  update(dialog: HTMLElement | null) {
    if (!dialog || dialog.dataset.glassMode !== 'gpu') {
      if (this.root) this.clear()
      return
    }
    const rect = dialog.getBoundingClientRect()
    const typography = (source: HTMLElement, copy: HTMLElement) => {
      const style = getComputedStyle(source)
      for (const property of [
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'letter-spacing',
        'text-align',
        'text-transform',
        'color',
        'white-space',
        'display',
        'gap',
        'align-items',
      ])
        copy.style.setProperty(property, style.getPropertyValue(property))
      if (source instanceof HTMLImageElement)
        for (const property of [
          'width',
          'height',
          'border-radius',
          'object-fit',
        ])
          copy.style.setProperty(property, style.getPropertyValue(property))
    }
    const key = `${Math.round(rect.width)}:${Math.round(rect.height)}`
    if (dialog === this.dialog && key === this.key) {
      if (
        this.layout !==
        `${innerWidth}:${innerHeight}:${document.documentElement.dataset.themeMix}`
      ) {
        for (const item of this.styled) typography(item.source, item.copy)
        for (const item of this.originals) {
          const r = item.element.getBoundingClientRect()
          item.copy.style.width = `${r.width}px`
          item.copy.style.height = `${r.height}px`
        }
      }
      // A projected native card can move under a stationary pane. Its source
      // bounds, not just the pane's bounds, determine mirror placement and clip.
      for (const item of this.originals) {
        const r = item.element.getBoundingClientRect()
        const left = `${r.left - rect.left}px`,
          top = `${r.top - rect.top}px`
        const width = `${r.width}px`,
          height = `${r.height}px`
        if (
          item.copy.style.left !== left ||
          item.copy.style.top !== top ||
          item.copy.style.width !== width ||
          item.copy.style.height !== height
        ) {
          Object.assign(item.copy.style, { left, top, width, height })
          const x = rect.left - r.left,
            y = rect.top - r.top
          item.element.style.clipPath = `path(evenodd, "M0 0H${r.width}V${r.height}H0Z M${x} ${y}h${rect.width}v${rect.height}h-${rect.width}Z")`
        }
      }
      this.x = rect.x
      this.y = rect.y
      this.layout = `${innerWidth}:${innerHeight}:${document.documentElement.dataset.themeMix}`
      return
    }
    this.clear()
    this.dialog = dialog
    this.key = key
    this.x = rect.x
    this.y = rect.y
    this.layout = `${innerWidth}:${innerHeight}:${document.documentElement.dataset.themeMix}`
    const root = document.createElement('div')
    this.root = root
    root.className = 'glass-dom-backdrop'
    root.inert = true
    root.setAttribute('aria-hidden', 'true')
    root.style.borderRadius = getComputedStyle(dialog).borderRadius
    dialog.prepend(root)
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-glass-substrate],.hub-brand,.utility-toggle',
    )) {
      if (
        !element.getClientRects().length ||
        element.closest('dialog') ||
        dialog.contains(element)
      )
        continue
      const r = element.getBoundingClientRect()
      const copy = document.createElement('div')
      const cloneText = (source: Node, target: HTMLElement) => {
        for (const child of source.childNodes) {
          if (child.nodeType === Node.TEXT_NODE)
            target.append(document.createTextNode(child.textContent ?? ''))
          else if (child instanceof HTMLBRElement)
            target.append(document.createElement('br'))
          else if (
            child instanceof HTMLImageElement &&
            child.currentSrc.startsWith(location.origin)
          ) {
            const image = document.createElement('img'),
              styles = getComputedStyle(child)
            image.src = child.currentSrc
            image.alt = ''
            for (const property of [
              'width',
              'height',
              'border-radius',
              'object-fit',
            ])
              image.style.setProperty(
                property,
                styles.getPropertyValue(property),
              )
            this.styled.push({ source: child, copy: image })
            target.append(image)
          } else if (child instanceof HTMLElement) {
            const span = document.createElement('span')
            typography(child, span)
            this.styled.push({ source: child, copy: span })
            cloneText(child, span)
            target.append(span)
          }
        }
      }
      cloneText(element, copy)
      typography(element, copy)
      this.styled.push({ source: element, copy })
      Object.assign(copy.style, {
        position: 'absolute',
        left: `${r.left - rect.left}px`,
        top: `${r.top - rect.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      })
      root.append(copy)
      this.originals.push({ element, clip: element.style.clipPath, copy })
      const x = rect.left - r.left,
        y = rect.top - r.top
      // Even-odd exclusion leaves the original semantic element in place.
      element.style.clipPath = `path(evenodd, "M0 0H${r.width}V${r.height}H0Z M${x} ${y}h${rect.width}v${rect.height}h-${rect.width}Z")`
    }
    if (!root.childElementCount) return
    const generation = this.generation,
      width = Math.round(rect.width),
      height = Math.round(rect.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!,
      pixels = context.createImageData(width, height)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const lx = x - width / 2,
          ly = y - height / 2
        const qx = Math.abs(lx) - width / 2 + 30,
          qy = Math.abs(ly) - height / 2 + 30
        const distance =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
          Math.min(Math.max(qx, qy), 0) -
          30
        const rim = Math.max(0, Math.min(1, 1 + distance / 25))
        const shift = 25 * 0.16 * rim * rim * (3 - 2 * rim)
        let nx = 0,
          ny = 0
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(qx, qy)
          nx = (qx / l) * Math.sign(lx)
          ny = (qy / l) * Math.sign(ly)
        } else if (qx > qy) nx = Math.sign(lx)
        else ny = Math.sign(ly)
        const i = (y * width + x) * 4
        const dx = lx / 1.035 - lx - nx * shift
        const dy = ly / 1.035 - ly - ny * shift
        pixels.data[i] = Math.round(127.5 + (dx / 128) * 255)
        pixels.data[i + 1] = Math.round(127.5 + (dy / 128) * 255)
        pixels.data[i + 2] = 128
        pixels.data[i + 3] = 255
      }
    context.putImageData(pixels, 0, 0)
    // This exports only the analytic displacement map, never backdrop pixels.
    canvas.toBlob((blob) => {
      if (!blob || this.generation !== generation || !root.isConnected) return
      const url = URL.createObjectURL(blob)
      this.url = url
      const id = `owned-glass-map-${generation}-${Math.random().toString(36).slice(2)}`
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.innerHTML = `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${url}" x="0" y="0" width="${width}" height="${height}" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="128" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`
      root.append(svg)
      root.style.filter = `url(#${id})`
      this.maps++
    }, 'image/png')
  }
}
