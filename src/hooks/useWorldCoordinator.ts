import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { narrative, clamp } from '../core/narrative'
import { evaluateJourney } from '../core/journey'
import { descentPhase } from '../core/descent'
import { smoothstep } from '../core/math'
import { EARTH_HOLD, launchProgress } from '../core/hubState'
import type { Surface, DestinationIntent } from '../core/hubState'
import { tourState, tourTime } from '../core/presentation'
import { advanceAutoRate } from '../core/autoRate'
import { isScrollInput } from '../core/scrollInput'

type Mode = 'manual' | 'launch' | 'tour'
// The coordinator owns progress in every world mode. R3F consumes its frame;
// input changes ownership here rather than racing a second animation/tween.
export function useWorldCoordinator({
  enabled,
  surface,
  intent,
  request,
  reduced,
  paused,
  onArrived,
  pace,
  staticView,
  speed,
}: {
  enabled: boolean
  surface: Surface
  intent: DestinationIntent
  request: number
  reduced: boolean
  paused: boolean
  onArrived: () => void
  pace: number
  staticView: boolean
  speed: number
}) {
  const targetRate = useRef(speed)
  targetRate.current = speed
  const [playing, setPlaying] = useState(false)
  const [resumeAvailable, setResumeAvailable] = useState(false)
  const control = useRef({
    mode: 'manual' as Mode,
    running: false,
    seconds: 0,
    span: 1,
    initialized: -1,
  })
  const latest = useRef({ surface, reduced, paused, onArrived })
  latest.current = { surface, reduced, paused, onArrived }
  const synchronize = (p: number) => {
    const value = clamp(Number.isFinite(p) ? p : 0)
    narrative.state = narrative.target = narrative.progress = value
    window.scrollTo({ top: value * control.current.span, behavior: 'instant' })
  }
  // Restore the displayed semantic point before paint after CSS allocation
  // changes. ResizeObserver remains responsible for ordinary viewport reflow.
  useLayoutEffect(() => {
    if (!enabled) return
    control.current.span = Math.max(
      1,
      document.querySelector<HTMLElement>('[data-world-end]')?.offsetTop ?? 1,
    )
    synchronize(narrative.state)
  }, [enabled, pace, staticView])
  const pause = () => {
    if (control.current.running) setResumeAvailable(true)
    control.current.running = false
    setPlaying(false)
  }
  const seek = (p: number) => {
    pause()
    control.current.mode = 'manual'
    setResumeAvailable(false)
    synchronize(p)
    // External seeks must publish the derived pose in the same operation.
    // R3F may render before the coordinator's next animation callback.
    narrative.frame = evaluateJourney(
      narrative.state,
      innerWidth < 720,
      innerHeight < 700,
      narrative.elapsed,
    )
    latest.current.onArrived()
  }
  const resume = () => {
    if (latest.current.reduced) return
    const c = control.current
    if (c.mode === 'manual')
      c.mode = narrative.state < EARTH_HOLD ? 'launch' : 'tour'
    c.seconds =
      c.mode === 'tour'
        ? tourTime(narrative.state) * 72
        : inverseLaunch(narrative.state)
    c.running = true
    setResumeAvailable(false)
    setPlaying(true)
  }
  const tour = () => {
    if (latest.current.reduced) return
    const c = control.current
    c.mode = 'tour'
    c.seconds = tourTime(narrative.state) * 72
    c.running = true
    setResumeAvailable(false)
    setPlaying(true)
  }
  useEffect(() => {
    narrative.reducedMotion = reduced
    if (reduced || paused) pause()
  }, [reduced, paused])
  useEffect(() => {
    if (!enabled) {
      pause()
      setResumeAvailable(false)
      narrative.state = narrative.target = narrative.progress = 0
      narrative.frame = evaluateJourney(
        0,
        innerWidth < 720,
        innerHeight < 700,
        narrative.elapsed,
      )
      for (const name of [
        '--light-ink',
        '--cloud-nav',
        '--bottom-ink',
        '--pelagic-presence',
        '--galaxy-presence',
      ])
        document.documentElement.style.removeProperty(name)
      document.documentElement.dataset.shot = 'hub'
      return
    }
    const c = control.current
    let raf = 0,
      last = performance.now(),
      rate = targetRate.current
    const measure = () => {
      const endpoint = document.querySelector<HTMLElement>('[data-world-end]')
      const span = Math.max(1, endpoint?.offsetTop ?? 1)
      if (span !== c.span) {
        c.span = span
        synchronize(narrative.state)
      }
    }
    const scroll = () => {
      if (
        !c.running &&
        !latest.current.paused &&
        ['launch', 'world'].includes(latest.current.surface)
      ) {
        c.mode = 'manual'
        narrative.target = clamp(scrollY / c.span)
      }
    }
    const takeover = (event: Event) => {
      // Explicit automatic ownership excludes passive manual takeover.
      if (
        c.running ||
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest(
            'dialog,input,textarea,select,[contenteditable=true]',
          ))
      )
        return
      if (
        event instanceof KeyboardEvent &&
        ![
          'ArrowDown',
          'ArrowUp',
          'PageDown',
          'PageUp',
          'Home',
          'End',
          ' ',
        ].includes(event.key)
      )
        return
      if (
        latest.current.paused ||
        ['loading', 'returning'].includes(latest.current.surface)
      )
        return
      if (c.mode !== 'manual') {
        pause()
        c.mode = 'manual'
        synchronize(narrative.state)
        latest.current.onArrived()
      }
    }
    const hidden = () => {
      if (document.hidden) pause()
    }
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      const { surface, reduced, paused } = latest.current
      if (
        !document.hidden &&
        !paused &&
        !['loading', 'returning'].includes(surface)
      ) {
        if (c.running && !reduced) {
          const step = advanceAutoRate(rate, targetRate.current, dt)
          rate = step.rate
          c.seconds += step.seconds
          const p =
            c.mode === 'tour'
              ? tourState(c.seconds / 72)
              : launchProgress(c.seconds)
          synchronize(p)
          if (c.seconds >= (c.mode === 'tour' ? 72 : 18)) {
            pause()
            setResumeAvailable(false)
            c.mode = 'manual'
            latest.current.onArrived()
          }
        } else if (c.mode === 'manual') {
          narrative.state +=
            (narrative.target - narrative.state) *
            (reduced ? 1 : 1 - Math.exp(-dt * 8))
        }
      }
      narrative.state = clamp(narrative.state)
      narrative.progress = narrative.state
      narrative.frame = evaluateJourney(
        narrative.state,
        innerWidth < 720,
        innerHeight < 700,
        narrative.elapsed,
      )
      const f = narrative.frame,
        phase = descentPhase(narrative.state)
      const ink = smoothstep((f.flash - 0.15) / 0.5)
      const root = document.documentElement
      root.dataset.shot = f.shot
      root.dataset.staticPose = narrative.state < 0.94 ? 'earth' : 'pelagic'
      root.style.setProperty('--light-ink', `${ink * 100}%`)
      root.style.setProperty(
        '--bottom-ink',
        `${Math.max(ink, f.cloudCover) * 100}%`,
      )
      root.style.setProperty(
        '--cloud-nav',
        String(
          smoothstep((phase - 0.58) / 0.02) *
            (1 - smoothstep((phase - 0.645) / 0.025)),
        ),
      )
      root.style.setProperty('--pelagic-presence', String(f.pelagic))
      root.style.setProperty('--galaxy-presence', String(f.galaxy))
      const content = document.querySelector<HTMLElement>('.world-content')
      if (content) {
        const opacity = smoothstep((narrative.state - 0.945) / 0.035)
        content.style.opacity = String(opacity)
        content.inert = opacity < 0.8
        content.setAttribute('aria-hidden', String(opacity < 0.8))
      }
      const cue = document.querySelector<HTMLElement>('.earth-cue')
      if (cue) {
        const visible =
          surface === 'world' && narrative.state > 0.56 && narrative.state < 0.7
        cue.inert = !visible
        cue.style.opacity = visible ? '1' : '0'
        cue.setAttribute('aria-hidden', String(!visible))
      }
      raf = requestAnimationFrame(tick)
    }
    measure()
    const observer = new ResizeObserver(measure)
    const region = document.querySelector<HTMLElement>('.world-scroll')
    if (region) observer.observe(region)
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('wheel', takeover, { passive: true })
    window.addEventListener('touchstart', takeover, { passive: true })
    window.addEventListener('keydown', takeover)
    document.addEventListener('visibilitychange', hidden)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', measure)
      window.removeEventListener('wheel', takeover)
      window.removeEventListener('touchstart', takeover)
      window.removeEventListener('keydown', takeover)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [enabled])
  useEffect(() => {
    if (surface === 'loading') {
      pause()
      control.current.mode = 'manual'
      synchronize(
        intent === 'pelagic' ? 1 : intent === 'earth' ? EARTH_HOLD : 0,
      )
    }
    if (surface === 'launch' && control.current.initialized !== request) {
      control.current.initialized = request
      control.current.mode = 'launch'
      control.current.seconds = 0
      synchronize(0)
      if (!latest.current.paused && !reduced) {
        control.current.running = true
        setPlaying(true)
      } else if (reduced) seek(EARTH_HOLD)
    }
  }, [surface, request])
  useEffect(() => {
    if (!enabled || !playing) return
    const html = document.documentElement,
      previous = html.style.overflow
    html.style.overflow = 'hidden'
    const guard = (event: Event) => {
      if (control.current.running && isScrollInput(event))
        event.preventDefault()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        pause()
      } else guard(event)
    }
    const resize = () => pause()
    window.addEventListener('wheel', guard, { passive: false })
    window.addEventListener('touchmove', guard, { passive: false })
    window.addEventListener('keydown', key)
    window.addEventListener('resize', resize)
    return () => {
      html.style.overflow = previous
      window.removeEventListener('wheel', guard)
      window.removeEventListener('touchmove', guard)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', resize)
    }
  }, [enabled, playing])
  return {
    playing,
    resumeAvailable,
    pause,
    resume,
    tour,
    seek,
    progress: narrative.state,
  }
}
function inverseLaunch(p: number) {
  let low = 0,
    high = 18
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (launchProgress(mid) < p) low = mid
    else high = mid
  }
  return (low + high) / 2
}
