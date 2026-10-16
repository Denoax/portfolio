import { useEffect, useRef, useState } from 'react'
import { admitIntroRipple, admitIntroSnap } from '../core/introRipples'
import { useRouteFade } from '../hooks/useRouteFade'
import type { RefObject } from 'react'
import { advanceZoom, boundedZoom } from '../core/introZoom'
import type { MenuPresentation } from '../core/menuReel'
import {
  beginIntroGesture,
  cancelIntroTransport,
  exitIntroTransport,
  releaseIntroGesture,
  requestIntroReset,
  requestIntroScroll,
  requestIntroZoom,
} from '../core/introMotion'

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
  onSnap,
  onHold,
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
  onSnap: (id: number) => void
  onHold: (holding: boolean) => void
  ready: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    at: number
    moved: boolean
    token: number
  } | null>(null)
  const touchPointers = useRef(new Set<number>())
  const pinched = useRef(false)
  const [staticZoom, setStaticZoom] = useState(0)
  const cancelGesture = () => {
    const id = gesture.current?.id
    gesture.current = null
    touchPointers.current.clear()
    pinched.current = false
    onHold(false)
    cancelIntroTransport(presentation.current.intro)
    if (id !== undefined && root.current?.hasPointerCapture(id))
      root.current.releasePointerCapture(id)
  }
  useEffect(() => {
    const cancel = () => cancelGesture()
    const hidden = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('pagehide', cancel)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      cancel()
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pagehide', cancel)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [presentation])
  const zoom = (delta: number) => {
    if (paused || exiting || presentation.current.intro.holding) return
    if (staticView) {
      presentation.current.intro.zoom = advanceZoom(
        presentation.current.intro.zoom,
        delta,
      )
      setStaticZoom(
        boundedZoom(
          presentation.current.intro.zoom,
          presentation.current.intro.loopPeriod,
        ),
      )
    } else requestIntroZoom(presentation.current.intro, delta)
  }
  const reset = () => {
    if (paused || exiting || presentation.current.intro.holding) return
    onInteract()
    const intro = presentation.current.intro
    if (staticView) {
      intro.zoom = { octave: 0n, phase: 0 }
      intro.zoomDelta = intro.zoomVelocity = 0
      intro.zoomReset = intro.resetActive = false
      setStaticZoom(0)
    } else requestIntroReset(intro)
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
    if (presentation.current.intro.exiting) return
    onActivate()
    exitIntroTransport(presentation.current.intro)
    presentation.current.intro.exiting = true
    onExitStateChange(true)
  }
  const cancelEntry = () => {
    presentation.current.intro.exiting = false
    presentation.current.intro.exitProgress = 0
    cancelIntroTransport(presentation.current.intro)
    root.current?.style.removeProperty('--intro-exit-opacity')
    onEntryCancel()
    onExitStateChange(false)
  }
  useRouteFade({
    token: exiting ? 1 : null,
    ready,
    reduced: staticView,
    onProgress: (p) => {
      presentation.current.intro.exitProgress = p
      root.current?.style.setProperty('--intro-exit-opacity', String(1 - p))
    },
    onComplete: () => {
      if (presentation.current.intro.exiting) done.current()
    },
    onCancel: cancelEntry,
  })
  useEffect(() => {
    if (paused || staticView) {
      cancelGesture()
      if (staticView) presentation.current.intro.zoomVelocity = 0
    }
  }, [paused, staticView, presentation])
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
          e.target.closest(
            'button,a,input,textarea,select,dialog,[contenteditable="true"]',
          ))
      )
        return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault()
        if (e.isTrusted) onInteract()
        if (e.key === '0') reset()
        else zoom(e.key === '-' ? -0.15 : 0.15)
        return
      }
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault()
        activate()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [paused, exiting, staticView, presentation])
  useEffect(() => {
    const wheel = (e: WheelEvent) => {
      if (paused || exiting || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1
      const distance = Math.max(-0.25, Math.min(0.25, (-e.deltaY * unit) / 1400))
      const delta = distance / 1.75
      if (staticView) zoom(delta)
      else requestIntroScroll(presentation.current.intro, delta)
    }
    const node = root.current
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [paused, exiting, staticView])
  return (
    <>
      {exiting && !ready && (
        <div className="route-preparation" role="status">
          Preparing graphics.{' '}
          <button type="button" onClick={cancelEntry}>
            Cancel
          </button>
        </div>
      )}
      <div
        ref={root}
        className="identity-intro"
        data-exiting={exiting}
        aria-disabled={exiting}
        inert={paused}
        role="button"
        tabIndex={0}
        aria-label="Enter projects through the artwork"
        aria-describedby="intro-instructions"
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') {
            touchPointers.current.add(e.pointerId)
            if (touchPointers.current.size > 1) {
              pinched.current = true
              const id = gesture.current?.id
              gesture.current = null
              onHold(false)
              cancelIntroTransport(presentation.current.intro)
              if (id !== undefined && e.currentTarget.hasPointerCapture(id))
                e.currentTarget.releasePointerCapture(id)
            }
          }
          if (
            paused ||
            exiting ||
            pinched.current ||
            !e.isPrimary ||
            e.button !== 0 ||
            (e.target instanceof Element &&
              e.target.closest(
                'button,a,input,textarea,select,dialog,[contenteditable="true"]',
              ))
          )
            return
          onInteract()
          const token = beginIntroGesture(presentation.current.intro)
          if (token === null) return
          onHold(true)
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            at: performance.now(),
            moved: false,
            token,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const g = gesture.current
          if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10)
            g.moved = true
        }}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={(e) => {
          // Normal pointerup implicitly loses capture after its accepted release.
          // Only an unfinished gesture is a cancellation.
          if (gesture.current?.id === e.pointerId) cancelGesture()
        }}
        onPointerUp={(e) => {
          touchPointers.current.delete(e.pointerId)
          if (pinched.current) {
            if (!touchPointers.current.size) pinched.current = false
            gesture.current = null
            cancelIntroTransport(presentation.current.intro)
            return
          }
          const g = gesture.current
          gesture.current = null
          const intro = presentation.current.intro
          if (!g || g.id !== e.pointerId) return
          onHold(false)
          const action = releaseIntroGesture(
            intro,
            g.token,
            (performance.now() - g.at) / 1000,
            g.moved,
            !staticView,
          )
          if (action === 'reverse' || action === 'ripple') {
            admitIntroRipple(intro.ripples, intro.elapsed)
            const id = admitIntroSnap(intro.ripples, intro.elapsed, !staticView)
            if (id !== null) onSnap(id)
          } else if (action === 'enter') activate()
        }}
      >
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
          {staticView
            ? 'Automatic motion is off. '
            : 'Hold the artwork to pause; release to reverse. '}
          Click, tap, Enter or Space to enter.
          Scroll to zoom. Plus and minus zoom the artwork; zero resets it.
        </p>
        <div
          ref={hint}
          className="intro-hint"
          aria-hidden="true"
          style={{ textShadow: '0 0 1px var(--site-base), 0 0 1px var(--site-base), 0 0 1px var(--site-base), 0 0 6px var(--site-base)' }}
        >
          <span>
            {staticView ? 'Scroll to zoom' : 'Hold to pause · release to reverse'}
          </span>
          <span className="intro-hint-pointer">Click to enter</span>
          <span className="intro-hint-touch">Tap to enter</span>
        </div>
      </div>
    </>
  )
}
