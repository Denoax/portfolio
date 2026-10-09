import { useEffect, useRef, useState } from 'react'
import { IntroProgress } from './IntroProgress'
import type { RefObject } from 'react'
import { advanceZoom, boundedZoom } from '../core/introZoom'
import type { MenuPresentation } from '../core/menuReel'

export function IdentityIntro({
  presentation,
  staticView,
  paused,
  entryRequest,
  onDone,
  onEntryCancel,
  exiting,
  onExitStateChange,
  onActivate,
  onInteract,
  onRipple,
  ready,
}: {
  presentation: RefObject<MenuPresentation>
  staticView: boolean
  paused: boolean
  entryRequest: number
  onDone: () => void
  onEntryCancel: () => void
  exiting: boolean
  onExitStateChange: (value: boolean) => void
  onActivate: () => void
  onInteract: () => void
  onRipple: () => void
  ready: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    at: number
    moved: boolean
  } | null>(null)
  const touchPointers = useRef(new Set<number>())
  const pinched = useRef(false)
  const [staticZoom, setStaticZoom] = useState(0)
  const zoom = (delta: number) => {
    if (paused || exiting) return
    if (staticView) {
      presentation.current.intro.zoom = advanceZoom(
        presentation.current.intro.zoom,
        delta,
      )
      setStaticZoom(boundedZoom(presentation.current.intro.zoom))
    } else presentation.current.intro.zoomDelta += delta
  }
  const reset = () => {
    if (paused || exiting) return
    onInteract()
    const intro = presentation.current.intro
    if (staticView) {
      intro.zoom = { octave: 0n, phase: 0 }
      intro.zoomDelta = intro.zoomVelocity = 0
      intro.zoomReset = intro.resetActive = false
      setStaticZoom(0)
    } else intro.zoomReset = true
  }
  // The static path has no renderer clock. WAAPI supplies the same active-time
  // hint and is paused by modal/visibility state; it never drives live artwork.
  const hint = useRef<HTMLDivElement>(null)
  const [cueReady, setCueReady] = useState(false)
  useEffect(() => {
    let alive = true
    const ready = () => {
      if (!alive) return
      presentation.current.intro.cueFontsReady = true
      setCueReady(true)
    }
    const fallback = window.setTimeout(ready, 2000)
    void Promise.all([
      document.fonts.load('italic 22px "Portfolio Instrument Serif"'),
      document.fonts.load('14px "Instrument Sans Variable"'),
    ]).then(ready, ready)
    return () => {
      alive = false
      clearTimeout(fallback)
    }
  }, [presentation])
  useEffect(() => {
    presentation.current.intro.hint = hint.current
    if (!staticView || !hint.current || !cueReady)
      return () => {
        presentation.current.intro.hint = null
      }
    const intro = presentation.current.intro
    if (intro.cueEpoch === null) intro.cueEpoch = intro.elapsed
    const epoch = intro.cueEpoch
    const animation = hint.current.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: 0.45 / 5.65 },
        { opacity: 1, offset: 1.65 / 5.65 },
        { opacity: 1, offset: 3.85 / 5.65 },
        { opacity: 0, offset: 1 },
      ],
      { duration: 5650, fill: 'forwards', easing: 'ease-in-out' },
    )
    animation.currentTime = Math.max(0, intro.elapsed - epoch) * 1000
    let alive = true
    const remember = () => {
      presentation.current.intro.elapsed = Math.max(
        presentation.current.intro.elapsed,
        epoch + Number(animation.currentTime ?? 0) / 1000,
      )
    }
    const sync = () => {
      remember()
      document.hidden ? animation.pause() : animation.play()
    }
    animation.finished
      .then(() => {
        if (alive) remember()
      })
      .catch(() => {})
    sync()
    const observer = new MutationObserver(sync)
    if (root.current)
      observer.observe(root.current, {
        attributes: true,
        attributeFilter: ['inert'],
      })
    document.addEventListener('visibilitychange', sync)
    return () => {
      remember()
      alive = false
      animation.cancel()
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      presentation.current.intro.hint = null
    }
  }, [staticView, presentation, cueReady])
  const done = useRef(onDone)
  done.current = onDone
  const activate = () => {
    if (paused || exiting) return
    onActivate()
    presentation.current.intro.exiting = true
    onExitStateChange(true)
  }
  useEffect(() => {
    if (paused) {
      const pointer = gesture.current?.id
      if (pointer !== undefined && root.current?.hasPointerCapture(pointer))
        root.current.releasePointerCapture(pointer)
      gesture.current = null
      touchPointers.current.clear()
      pinched.current = false
      presentation.current.intro.holding = false
    }
  }, [paused, presentation])
  const consumedRequest = useRef(0)
  useEffect(() => {
    if (entryRequest > consumedRequest.current && !paused && !exiting) {
      consumedRequest.current = entryRequest
      activate()
    }
  }, [entryRequest, paused, exiting])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        paused ||
        exiting ||
        (e.target instanceof Element &&
          e.target.closest('button,a,input,dialog'))
      )
        return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault()
        if (e.isTrusted) onInteract()
        if (e.key === '0') reset()
        else zoom(e.key === '-' ? -0.25 : 0.25)
        return
      }
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault()
        activate()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [paused, exiting])
  useEffect(() => {
    const wheel = (e: WheelEvent) => {
      if (paused || exiting || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1
      zoom(Math.max(-0.5, Math.min(0.5, (-e.deltaY * unit) / 650)))
    }
    const node = root.current
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [paused, exiting, staticView])
  return (
    <div
      ref={root}
      className="identity-intro"
      data-exiting={exiting}
      inert={paused}
      aria-describedby="intro-instructions"
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') {
          touchPointers.current.add(e.pointerId)
          if (touchPointers.current.size > 1) pinched.current = true
        }
        if (
          exiting ||
          (e.target instanceof Element && e.target.closest('button,a'))
        )
          return
        onInteract()
        gesture.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          at: performance.now(),
          moved: false,
        }
        presentation.current.intro.holding = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const g = gesture.current
        if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10)
          g.moved = true
      }}
      onPointerCancel={() => {
        gesture.current = null
        touchPointers.current.clear()
        pinched.current = false
        presentation.current.intro.holding = false
      }}
      onPointerUp={(e) => {
        touchPointers.current.delete(e.pointerId)
        if (pinched.current) {
          if (!touchPointers.current.size) pinched.current = false
          gesture.current = null
          presentation.current.intro.holding = false
          return
        }
        const g = gesture.current
        gesture.current = null
        const intro = presentation.current.intro
        intro.holding = false
        if (!g || g.id !== e.pointerId) return
        if (g.moved || performance.now() - g.at > 260) {
          intro.pulseAt = intro.elapsed
          onRipple()
        } else activate()
      }}
    >
      {exiting && (
        <IntroProgress
          presentation={presentation}
          ready={ready}
          reduced={staticView}
          blocked={paused}
          onDone={() => done.current()}
          onCancel={() => {
            onEntryCancel()
            presentation.current.intro.exiting = false
            presentation.current.intro.exitProgress = 0
            onExitStateChange(false)
          }}
        />
      )}
      {staticView && (
        <div className="intro-static-rings" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              style={{
                width: `${200 * 2 ** (((((Math.log2(0.08 + i * 0.04) + staticZoom + 5) % 6) + 6) % 6) - 5)}vmin`,
                height: `${200 * 2 ** (((((Math.log2(0.08 + i * 0.04) + staticZoom + 5) % 6) + 6) % 6) - 5)}vmin`,
              }}
            >
              MANI · SELECT A PROJECT
            </span>
          ))}
        </div>
      )}
      <p id="intro-instructions" className="sr-only">
        Hold the artwork to ripple. Click or tap to enter. Use plus and minus to
        zoom, or zero to reset.
      </p>
      <div ref={hint} className="intro-hint" aria-hidden="true">
        <span>Hold to ripple</span>
        <span className="intro-hint-pointer">Click to enter</span>
        <span className="intro-hint-touch">Tap to enter</span>
      </div>
      <div className="intro-zoom" role="group" aria-label="Artwork zoom">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            onInteract()
            zoom(-0.25)
          }}
        >
          −
        </button>
        <button type="button" aria-label="Reset artwork zoom" onClick={reset}>
          ↺
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            onInteract()
            zoom(0.25)
          }}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="intro-skip"
        disabled={exiting}
        onClick={activate}
      >
        Enter portfolio ↗
      </button>
    </div>
  )
}
