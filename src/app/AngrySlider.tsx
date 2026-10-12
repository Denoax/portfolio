import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  predictSliderFlight,
  sliderFlightPoint,
  sliderValue,
  type SliderFlight,
  type SliderPoint,
} from '../core/sliderFlight'

type Gesture = {
  id: number
  clientX: number
  clientY: number
  anchor: SliderPoint
  origin: SliderPoint
  raw: SliderPoint
  elastic: boolean
}

// Independently adapts the inspected gsimone / Inspora interaction. Native range
// owns keyboard/AT semantics; one captured pointer owns a complete gesture.
export function AngrySlider({
  name,
  label,
  value,
  min,
  max,
  reduced,
  active,
  cancelEpoch,
  onChange,
}: {
  name: string
  label: string
  value: number
  min: number
  max: number
  reduced: boolean
  active: boolean
  cancelEpoch: number
  onChange: (value: number) => void
}) {
  const holder = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null)
  const track = useRef<SVGLineElement>(null)
  const thumb = useRef<SVGEllipseElement>(null),
    fill = useRef<SVGLineElement>(null)
  const restingThumb = useRef<SVGEllipseElement>(null)
  const [externalPaint, setExternalPaint] = useState(false)
  const painting = useRef(false)
  const frame = useRef({ left: 0, top: 0, ink: '#161a20', z: 24 })
  const generation = useRef(0)
  const tether = useRef<SVGPathElement>(null),
    trajectory = useRef<SVGPathElement>(null)
  const marker = useRef<SVGGElement>(null),
    predicted = useRef<SVGTextElement>(null)
  const callback = useRef(onChange)
  callback.current = onChange
  const chosen = useRef(value)
  chosen.current = value
  const width = useRef(300),
    length = () => Math.max(1, width.current - 24)
  const pose = useRef<SliderPoint>({ x: (value - min) / (max - min), y: 0 })
  const gesture = useRef<Gesture | null>(null),
    flight = useRef<SliderFlight | null>(null)
  const raf = useRef(0),
    phase = useRef('idle')
  const normal = () => (chosen.current - min) / (max - min)
  const localX = (x: number) => 12 + x * length()
  const px = (x: number) => frame.current.left + localX(x)
  const py = (y: number) => frame.current.top + 46 + y * length()
  const draw = (squash = 0) => {
    const p = pose.current
    const moving =
      gesture.current?.elastic === true ||
      ['flight', 'impact', 'settle'].includes(phase.current)
    if (moving !== painting.current) {
      painting.current = moving
      setExternalPaint(moving)
    }
    track.current?.setAttribute('x2', String(width.current - 12))
    holder.current?.setAttribute('data-slider-phase', phase.current)
    if (holder.current) {
      Object.assign(holder.current.dataset, {
        rawX: String(gesture.current?.raw.x ?? p.x),
        rawY: String(gesture.current?.raw.y ?? p.y),
        poseX: String(p.x),
        poseY: String(p.y),
        predicted: String(flight.current?.target ?? normal()),
        pointerId: String(gesture.current?.id ?? ''),
      })
    }
    restingThumb.current?.setAttribute(
      'visibility',
      moving ? 'hidden' : 'visible',
    )
    restingThumb.current?.setAttribute('cx', String(localX(p.x)))
    restingThumb.current?.setAttribute('cy', String(46 + p.y * length()))
    thumb.current?.setAttribute('visibility', moving ? 'visible' : 'hidden')
    thumb.current?.setAttribute('cx', String(px(p.x)))
    thumb.current?.setAttribute('cy', String(py(p.y)))
    thumb.current?.setAttribute('rx', String(6 * (1 + squash)))
    thumb.current?.setAttribute('ry', String(6 * (1 - squash)))
    fill.current?.setAttribute('x2', String(localX(normal())))
    const f = flight.current,
      pulling = gesture.current?.elastic === true
    tether.current?.setAttribute('visibility', pulling ? 'visible' : 'hidden')
    if (pulling && gesture.current) {
      const anchor = px(gesture.current.anchor.x)
      tether.current?.setAttribute(
        'd',
        `M${anchor - 4} ${py(0)} L${px(p.x)} ${py(p.y)} L${anchor + 4} ${py(0)}`,
      )
    }
    const preview = !!f && (pulling || phase.current === 'flight')
    trajectory.current?.setAttribute(
      'visibility',
      preview ? 'visible' : 'hidden',
    )
    marker.current?.setAttribute('visibility', preview ? 'visible' : 'hidden')
    if (preview && f) {
      let path = ''
      for (let i = 0; i <= 20; i++) {
        const point = sliderFlightPoint(f, i / 20)
        path += `${i ? ' L' : 'M'}${px(point.x)} ${py(point.y)}`
      }
      trajectory.current?.setAttribute('d', path)
      marker.current?.setAttribute(
        'transform',
        `translate(${px(f.target)} ${py(0)})`,
      )
      if (predicted.current)
        predicted.current.textContent = `${sliderValue(f.target, min, max)}%`
    }
  }
  const cancel = () => {
    generation.current++
    cancelAnimationFrame(raf.current)
    raf.current = 0
    const id = gesture.current?.id
    gesture.current = null
    flight.current = null
    phase.current = 'idle'
    if (id !== undefined && holder.current?.hasPointerCapture(id))
      holder.current.releasePointerCapture(id)
    pose.current = { x: normal(), y: 0 }
    draw()
  }
  useLayoutEffect(() => {
    const resize = () => {
      width.current = holder.current?.clientWidth ?? 300
      if (gesture.current || raf.current) cancel()
      else {
        pose.current = { x: normal(), y: 0 }
        draw()
      }
    }
    const observer = new ResizeObserver(resize)
    if (holder.current) observer.observe(holder.current)
    resize()
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (!gesture.current && !raf.current) pose.current = { x: normal(), y: 0 }
    draw()
  }, [value])
  useLayoutEffect(() => {
    if (!active || reduced || cancelEpoch) cancel()
  }, [active, reduced, cancelEpoch])
  useLayoutEffect(() => {
    draw()
  }, [externalPaint])
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) cancel()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('pagehide', cancel)
    window.addEventListener('keydown', escape)
    document.addEventListener('visibilitychange', hidden)
    const pane = holder.current?.closest('dialog')
    const moved = (event: Event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.contains(holder.current)
      )
        cancel()
    }
    pane?.addEventListener('scroll', moved, true)
    window.addEventListener('resize', cancel)
    window.visualViewport?.addEventListener('resize', cancel)
    window.visualViewport?.addEventListener('scroll', cancel)
    return () => {
      cancel()
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pagehide', cancel)
      window.removeEventListener('keydown', escape)
      document.removeEventListener('visibilitychange', hidden)
      pane?.removeEventListener('scroll', moved, true)
      window.removeEventListener('resize', cancel)
      window.visualViewport?.removeEventListener('resize', cancel)
      window.visualViewport?.removeEventListener('scroll', cancel)
    }
  }, [])
  const commit = (position: number) => {
    const next = sliderValue(position, min, max)
    chosen.current = next
    callback.current(next)
  }
  const release = () => {
    const g = gesture.current,
      f = flight.current
    if (!g) return
    gesture.current = null
    if (holder.current?.hasPointerCapture(g.id))
      holder.current.releasePointerCapture(g.id)
    if (!g.elastic || !f || reduced) {
      flight.current = null
      phase.current = 'idle'
      pose.current = { x: normal(), y: 0 }
      draw()
      return
    }
    commit(f.target)
    phase.current = 'flight'
    const ticket = ++generation.current
    const started = performance.now(),
      duration = f.duration * 1000
    const step = (now: number) => {
      if (ticket !== generation.current) return
      const age = now - started
      if (age < duration) {
        pose.current = sliderFlightPoint(f, age / duration)
        draw()
      } else {
        const t = (age - duration) / 1000
        phase.current = t < 0.07 ? 'impact' : 'settle'
        pose.current = {
          x: normal(),
          y: -0.018 * Math.exp(-t * 13) * Math.sin(t * 38),
        }
        draw(0.18 * Math.exp(-t * 16))
      }
      if (age < duration + 360) raf.current = requestAnimationFrame(step)
      else {
        raf.current = 0
        flight.current = null
        phase.current = 'idle'
        pose.current = { x: normal(), y: 0 }
        draw()
      }
    }
    raf.current = requestAnimationFrame(step)
  }
  return (
    <div className="angry-slider" data-reduced={reduced}>
      <div className="angry-slider-label">
        <label htmlFor={`setting-${name}`}>{label}</label>
        <output htmlFor={`setting-${name}`}>{value}%</output>
      </div>
      <div
        ref={holder}
        className="angry-slider-gesture"
        data-slider-phase="idle"
        onPointerDown={(e) => {
          if (
            reduced ||
            !active ||
            e.button !== 0 ||
            !e.isPrimary ||
            gesture.current
          )
            return
          e.preventDefault()
          input.current?.focus({ preventScroll: true })
          const rect = e.currentTarget.getBoundingClientRect()
          const pane = e.currentTarget.closest('dialog')
          frame.current = {
            left: rect.left,
            top: rect.top,
            ink: getComputedStyle(e.currentTarget).color,
            z: Number(pane ? getComputedStyle(pane).zIndex : 23) + 1,
          }
          const inFlight = raf.current !== 0
          if (!inFlight) {
            const x = (e.clientX - rect.left - 12) / length()
            if (Math.abs(x - pose.current.x) * length() > 16) {
              pose.current = { x: Math.max(0, Math.min(1, x)), y: 0 }
              commit(pose.current.x)
            }
          }
          cancelAnimationFrame(raf.current)
          generation.current++
          raf.current = 0
          flight.current = null
          gesture.current = {
            id: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            origin: { ...pose.current },
            raw: { ...pose.current },
            anchor: { x: normal(), y: 0 },
            elastic: inFlight,
          }
          phase.current = 'press'
          e.currentTarget.setPointerCapture(e.pointerId)
          draw()
        }}
        onPointerMove={(e) => {
          const g = gesture.current
          if (!g || g.id !== e.pointerId) return
          const dx = (e.clientX - g.clientX) / length(),
            dy = (e.clientY - g.clientY) / length()
          g.raw = { x: g.origin.x + dx, y: g.origin.y + dy }
          if (
            !g.elastic &&
            (Math.abs(dy) > 0.025 || g.raw.x < -0.015 || g.raw.x > 1.015)
          ) {
            // Rebase to the last legal drag pose, without changing the frozen
            // input origin. Crossing an endpoint also arms a horizontal sling.
            g.anchor = { x: Math.max(0, Math.min(1, pose.current.x)), y: 0 }
            g.elastic = true
          }
          pose.current = {
            x: Math.max(
              g.elastic ? -0.6 : 0,
              Math.min(g.elastic ? 1.6 : 1, g.raw.x),
            ),
            y: g.elastic ? Math.max(-0.6, Math.min(0.6, g.raw.y)) : 0,
          }
          if (g.elastic) {
            phase.current = 'pull'
            flight.current = predictSliderFlight(g.anchor, pose.current)
          } else {
            phase.current = 'drag'
            commit(pose.current.x)
          }
          draw()
        }}
        onPointerUp={(e) => {
          if (gesture.current?.id === e.pointerId) release()
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel()
        }}
      >
        <svg aria-hidden="true" width="100%" height="94">
          <line
            ref={track}
            className="angry-slider-track"
            x1="12"
            y1="46"
            y2="46"
          />
          <line
            ref={fill}
            className="angry-slider-fill"
            x1="12"
            y1="46"
            y2="46"
          />
          <ellipse ref={restingThumb} rx="6" ry="6" />
        </svg>
        <input
          ref={input}
          id={`setting-${name}`}
          type="range"
          min={min}
          max={max}
          step="1"
          value={value}
          aria-valuetext={`${value} percent`}
          className="angry-slider-native"
          onKeyDown={() => {
            if (raf.current || gesture.current) cancel()
          }}
          onChange={(e) => {
            chosen.current = Number(e.target.value)
            callback.current(chosen.current)
          }}
        />
      </div>
      {externalPaint &&
        createPortal(
          <svg
            className="slider-paint-layer"
            data-slider-owner={name}
            aria-hidden="true"
            style={
              {
                '--settings-ink': frame.current.ink,
                color: frame.current.ink,
                zIndex: frame.current.z,
              } as CSSProperties
            }
          >
            <path
              ref={trajectory}
              className="angry-slider-trajectory"
              visibility="hidden"
            />
            <path
              ref={tether}
              className="angry-slider-tether"
              visibility="hidden"
            />
            <g ref={marker} className="angry-slider-target" visibility="hidden">
              <path d="M0 -5 V5" />
              <text ref={predicted} textAnchor="middle" y="-13" />
            </g>
            <ellipse ref={thumb} rx="6" ry="6" />
          </svg>,
          document.body,
        )}
    </div>
  )
}
