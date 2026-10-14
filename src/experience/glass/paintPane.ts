import { panePaintColor } from './panePaintTheme'

// Paint only our measured native labels, controls, vectors and owned images.
// This transient texture is renderer data, never an external/generated asset.
export function paintPane(
  node: HTMLElement,
  width: number,
  height: number,
  reusable?: HTMLCanvasElement,
  mode?: 'dark' | 'light',
) {
  const canvas = reusable ?? document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  const ctx = canvas.getContext('2d')!,
    origin = node.getBoundingClientRect()
  const color = mode ? panePaintColor(node, mode) : (value: string) => value
  const visible = (e: Element) => {
    const s = getComputedStyle(e)
    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      !e.closest('[hidden],[data-glass-copy],.pane-close')
    )
  }
  for (const element of node.querySelectorAll<HTMLElement>(
    'button,a,input,img',
  )) {
    if (!visible(element)) continue
    const r = element.getBoundingClientRect(),
      s = getComputedStyle(element),
      x = r.left - origin.left,
      y = r.top - origin.top
    if (element instanceof HTMLImageElement) {
      if (
        element.complete &&
        element.naturalWidth &&
        element.currentSrc.startsWith(location.origin)
      ) {
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, r.width, r.height, parseFloat(s.borderRadius) || 0)
        ctx.clip()
        ctx.drawImage(element, x, y, r.width, r.height)
        ctx.restore()
      }
      continue
    }
    if (element instanceof HTMLInputElement && element.type === 'range')
      continue
    ctx.fillStyle = color(s.backgroundColor)
    ctx.beginPath()
    ctx.roundRect(
      x,
      y,
      r.width,
      r.height,
      Math.min(r.height / 2, parseFloat(s.borderRadius) || 0),
    )
    ctx.fill()
    const border = parseFloat(s.borderTopWidth)
    if (border > 0 && s.borderTopStyle !== 'none') {
      ctx.strokeStyle = color(s.borderTopColor)
      ctx.lineWidth = border
      ctx.stroke()
    }
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      ctx.fillStyle = color(s.color)
      ctx.beginPath()
      ctx.arc(
        x + (element.checked ? r.width - 10 : 10),
        y + r.height / 2,
        6,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
  const svgElements = node.querySelectorAll<SVGSVGElement>('svg')
  for (const svg of svgElements) {
    if (!visible(svg) || svg.closest('[data-glass-copy]')) continue
    const r = svg.getBoundingClientRect(),
      vb = svg.viewBox.baseVal
    if (!r.width || !r.height) continue
    ctx.save()
    ctx.translate(r.left - origin.left, r.top - origin.top)
    ctx.scale(
      r.width / (vb.width || r.width),
      r.height / (vb.height || r.height),
    )
    ctx.translate(-vb.x, -vb.y)
    const draw = (element: SVGElement) => {
      const s = getComputedStyle(element)
      ctx.save()
      if (element instanceof SVGGraphicsElement) {
        const own = element.transform.baseVal.consolidate()?.matrix
        if (own) ctx.transform(own.a, own.b, own.c, own.d, own.e, own.f)
      }
      let path: Path2D | null = null
      const value = (name: string) => Number(element.getAttribute(name) || 0)
      if (element instanceof SVGPathElement)
        path = new Path2D(element.getAttribute('d') || '')
      else if (element instanceof SVGCircleElement) {
        path = new Path2D()
        path.arc(value('cx'), value('cy'), value('r'), 0, Math.PI * 2)
      } else if (element instanceof SVGEllipseElement) {
        path = new Path2D()
        path.ellipse(
          value('cx'),
          value('cy'),
          value('rx'),
          value('ry'),
          0,
          0,
          Math.PI * 2,
        )
      } else if (element instanceof SVGLineElement) {
        path = new Path2D()
        path.moveTo(value('x1'), value('y1'))
        path.lineTo(value('x2'), value('y2'))
      } else if (element instanceof SVGRectElement) {
        path = new Path2D()
        path.roundRect(
          value('x'),
          value('y'),
          value('width'),
          value('height'),
          value('rx'),
        )
      }
      if (path) {
        if (s.fill !== 'none') {
          ctx.fillStyle = color(s.fill)
          ctx.fill(path)
        }
        if (s.stroke !== 'none') {
          ctx.strokeStyle = color(s.stroke)
          ctx.lineWidth = parseFloat(s.strokeWidth) || 1
          ctx.lineCap = s.strokeLinecap as CanvasLineCap
          ctx.lineJoin = s.strokeLinejoin as CanvasLineJoin
          ctx.stroke(path)
        }
      }
      for (const child of element.children)
        if (child instanceof SVGElement) draw(child)
      ctx.restore()
    }
    for (const child of svg.children)
      if (child instanceof SVGElement) draw(child)
    ctx.restore()
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const text = walker.currentNode as Text,
      parent = text.parentElement
    if (
      !parent ||
      parent.closest('svg,[data-glass-copy],.pane-close') ||
      !visible(parent) ||
      !text.data.trim()
    )
      continue
    const style = getComputedStyle(parent)
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    ctx.fillStyle = color(style.color)
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing =
      style.letterSpacing === 'normal' ? '0px' : style.letterSpacing
    const words = [...text.data.matchAll(/\S+\s*/g)]
    for (const word of words) {
      const range = document.createRange()
      range.setStart(text, word.index!)
      range.setEnd(text, word.index! + word[0].length)
      const r = range.getBoundingClientRect(),
        metrics = ctx.measureText(word[0])
      const ascent =
          metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8,
        descent =
          metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * 0.2
      ctx.fillText(
        word[0],
        r.left - origin.left,
        r.top - origin.top + (r.height - ascent - descent) / 2 + ascent,
      )
    }
  }
  return canvas
}
