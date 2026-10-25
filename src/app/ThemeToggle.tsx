import { useEffect, useRef } from 'react'
import type { ResolvedTheme } from '../core/theme'
// Independent vector/material study of the supplied silent buddy footage.
// No raster extraction, third party mascot or extra graphics context.
export function ThemeToggle({
  theme,
  onToggle,
  reduced = false,
}: {
  theme: ResolvedTheme
  onToggle: () => void
  reduced?: boolean
}) {
  const button = useRef<HTMLButtonElement>(null),
    body = useRef<SVGSVGElement>(null),
    face = useRef<SVGGElement>(null)
  const state = useRef({
    hover: false,
    down: false,
    reaction: 0,
    moved: performance.now(),
    x: innerWidth / 2,
    y: innerHeight / 2,
    cancelled: false,
    startX: 0,
    startY: 0,
  })
  const wakeAnimation = useRef<() => void>(() => {})
  const label = theme === 'dark' ? 'Light mode' : 'Dark mode'
  useEffect(() => {
    let raf = 0,
      last = 0,
      fx = 0,
      fy = 0
    const draw = (now: number) => {
      raf = 0
      const s = state.current,
        rect = button.current!.getBoundingClientRect(),
        dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      const dx = s.x - rect.left - rect.width / 2,
        dy = s.y - rect.top - rect.height / 2,
        length = Math.max(160, Math.hypot(dx, dy)),
        k = 1 - Math.exp(-dt / 0.09)
      fx += ((dx / length) * 3.4 - fx) * k
      fy += ((dy / length) * 3.4 - fy) * k
      face.current!.setAttribute('transform', `translate(${fx} ${fy})`)
      const sleep = now - s.moved > 8000 && !s.hover && !s.down,
        react = Math.max(0, 1 - (now - s.reaction) / 480),
        happy = s.hover || react > 0
      body.current!.dataset.expression = s.down
        ? 'pressed'
        : happy
          ? 'smile'
          : sleep
            ? 'sleep'
            : 'awake'
      body.current!.style.transform = reduced
        ? ''
        : `translateY(${-2 * Number(happy) + 1.5 * react}px) rotate(${fx * 0.8}deg) scale(${1 + 0.1 * Number(s.down) + 0.035 * react},${1 - 0.12 * Number(s.down) - 0.03 * react})`
      button.current!.dataset.faceX = fx.toFixed(3)
      button.current!.dataset.faceY = fy.toFixed(3)
      if (
        !document.hidden &&
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        (!sleep ||
          Math.abs(fx - (dx / length) * 3.4) > 0.001 ||
          Math.abs(fy - (dy / length) * 3.4) > 0.001)
      )
        raf = requestAnimationFrame(draw)
    }
    wakeAnimation.current = () => {
      state.current.moved = performance.now()
      if (!raf && !document.hidden) {
        last = 0
        draw(performance.now())
      }
    }
    const wake = (e: PointerEvent) => {
      const s = state.current
      s.x = e.clientX
      s.y = e.clientY
      s.moved = performance.now()
      wakeAnimation.current()
      if (s.down && Math.hypot(s.x - s.startX, s.y - s.startY) > 6) {
        s.cancelled = true
        s.down = false
      }
    }
    const retire = () => {
      state.current.down = false
      state.current.hover = false
      state.current.cancelled = true
      last = 0
      cancelAnimationFrame(raf)
      if (!document.hidden) draw(performance.now())
    }
    window.addEventListener('pointermove', wake, { passive: true })
    window.addEventListener('blur', retire)
    document.addEventListener('visibilitychange', retire)
    draw(performance.now())
    return () => {
      wakeAnimation.current = () => {}
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('blur', retire)
      document.removeEventListener('visibilitychange', retire)
    }
  }, [reduced])
  return (
    <button
      ref={button}
      className="theme-toggle"
      data-audio-silent
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={theme === 'dark'}
      onPointerEnter={() => {
        state.current.hover = true
        wakeAnimation.current()
      }}
      onPointerLeave={() => {
        state.current.hover = false
        state.current.down = false
      }}
      onFocus={() => {
        state.current.hover = true
        wakeAnimation.current()
      }}
      onBlur={() => {
        state.current.hover = false
        state.current.down = false
      }}
      onPointerDown={(e) => {
        const s = state.current
        s.down = true
        s.cancelled = false
        s.startX = e.clientX
        s.startY = e.clientY
      }}
      onPointerUp={() => {
        state.current.down = false
      }}
      onPointerCancel={() => {
        state.current.down = false
        state.current.cancelled = true
      }}
      onClick={(e) => {
        if (e.detail && state.current.cancelled) return
        state.current.reaction = performance.now()
        wakeAnimation.current()
        onToggle()
      }}
    >
      <span className="buddy-shadow" aria-hidden="true" />
      <svg
        ref={body}
        className="theme-buddy"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="buddy-material" cx="52%" cy="47%" r="61%">
            <stop offset=".48" stopColor="var(--buddy-body)" />
            <stop offset=".80" stopColor="var(--buddy-body)" />
            <stop offset="1" stopColor="var(--buddy-rim)" />
          </radialGradient>
          <radialGradient id="buddy-light" cx="28%" cy="9%" r="76%">
            <stop stopColor="#fff" stopOpacity=".19" />
            <stop offset=".48" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="M32 4C49 3 60 15 60 31C61 47 48 57 32 57C15 58 4 48 4 33C3 18 15 5 32 4Z"
          fill="url(#buddy-material)"
        />
        <path
          d="M32 4C49 3 60 15 60 31C61 47 48 57 32 57C15 58 4 48 4 33C3 18 15 5 32 4Z"
          fill="url(#buddy-light)"
        />
        <g
          ref={face}
          fill="var(--buddy-face)"
          stroke="var(--buddy-face)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="buddy-open">
            <circle cx="26" cy="25" r="3.6" stroke="none" />
            <circle cx="39" cy="25" r="3.6" stroke="none" />
          </g>
          <g className="buddy-smile" fill="none">
            <path d="M22 26Q26 22 30 26M35 26Q39 22 43 26" />
          </g>
          <g className="buddy-sleep" fill="none">
            <path d="M23 26H29M36 26H42" />
          </g>
          <g className="buddy-cross" fill="none">
            <path d="M23 23L29 29M29 23L23 29M36 23L42 29M42 23L36 29" />
          </g>
        </g>
      </svg>
      <span className="theme-tooltip">{label}</span>
    </button>
  )
}
