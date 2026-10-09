import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ResourcePhase } from '../audio/InterfaceAudio'
import type { Project } from '../content/projects'
import type { MenuPresentation } from '../core/menuReel'
import type { RefObject } from 'react'
import { displayedThemeMix, themeColor } from '../core/theme'
import {
  advanceResource,
  createResourceProgress,
  resourceAction,
  resourceFraction,
  resourceSlice,
  smooth,
  RESOURCE_DURATION,
} from '../core/resourceProgress'
import {
  ProgressWave,
  ProgressActionIcon,
  paintProgressWave,
  emptyWaveElements,
} from './ProgressWave'
export interface ResourceRequest {
  token: number
  project: Project
  animationDone: boolean
  revealing?: boolean
}
// Original motion adaptation of Inspora 2-8 / @__causasui. Only the spatial
// approach and resolve are borrowed; every image is existing real project media.
export function ResourceTransition({
  request,
  presentation,
  reduced,
  onComplete,
  onCancel,
  onPhase,
  onRetire,
  onRevealed,
}: {
  request: ResourceRequest | null
  presentation: RefObject<MenuPresentation>
  reduced: boolean
  onComplete: (token: number) => void
  onCancel: () => void
  onPhase: (token: number, phase: ResourcePhase) => void
  onRetire: (token: number) => void
  onRevealed: (token: number) => void
}) {
  const root = useRef<HTMLDivElement>(null),
    backdrop = useRef<HTMLDivElement>(null),
    field = useRef<HTMLDivElement>(null),
    native = useRef<HTMLDivElement>(null),
    band = useRef<HTMLDivElement>(null),
    cancel = useRef<HTMLButtonElement>(null),
    pause = useRef<HTMLButtonElement>(null)
  const wave = useRef(emptyWaveElements()),
    slices = useRef<(SVGGElement | null)[]>([]),
    model = useRef(createResourceProgress())
  const revealActive = useRef(false)
  const [revealStarted, setRevealStarted] = useState(false)
  const [paused, setPaused] = useState(false),
    [imageFailed, setImageFailed] = useState(false)
  const state = useRef({
    request,
    reduced,
    onComplete,
    onCancel,
    onPhase,
    onRetire,
    onRevealed,
  })
  state.current = {
    request,
    reduced,
    onComplete,
    onCancel,
    onPhase,
    onRetire,
    onRevealed,
  }
  const token = request?.token,
    project = request?.project,
    media = project?.presentation === 'media'
  const image = media
    ? innerWidth < 720
      ? project.portrait
      : project.image
    : ''
  useLayoutEffect(() => {
    if (token === undefined) return
    model.current = createResourceProgress()
    wave.current.integer = -1
    setPaused(false)
    setRevealStarted(false)
    revealActive.current = false
    setImageFailed(false)
    const node = root.current!,
      previous = document.activeElement as HTMLElement | null
    node.style.opacity = '1'
    node.dataset.covered = 'false'
    node.dataset.phase = '0'
    node.dataset.paused = 'false'
    backdrop.current!.style.opacity = '0'
    cancel.current?.focus({ preventScroll: true })
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (state.current.request?.token === token) state.current.onCancel()
      }
      if (event.key === 'Tab') {
        const buttons = [cancel.current!, pause.current!],
          index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        buttons[
          (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        ].focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      state.current.onRetire(token)
      native.current?.replaceChildren()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [token])
  useEffect(() => {
    if (token === undefined) return
    let alive = true,
      raf = 0,
      last = 0,
      completed = false,
      reveal = 0,
      polarity = displayedThemeMix(),
      width = 0,
      height = 0,
      integerPaused = false
    const emitted = new Set<ResourcePhase>(),
      node = root.current!
    // Snapshot an existing native view once, after the first cover paint. It is
    // inert, read-only DOM: no new data fetch, physics tree or video decoder.
    let snapshotFrame = 0
    const snapshot = () => {
      if (!alive || state.current.request?.token !== token || media) return
      const target = presentation.current.nativeTargets.get(project!.id)
      const source = target?.querySelector<HTMLElement>(
        '.profile-activity,.gravity-letters',
      )
      if (source && native.current) {
        const copy = source.cloneNode(true) as HTMLElement
        copy.inert = true
        copy.setAttribute('aria-hidden', 'true')
        copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
        copy.querySelectorAll('button,a,input').forEach((n) => {
          n.setAttribute('tabindex', '-1')
          n.setAttribute('aria-hidden', 'true')
        })
        native.current.replaceChildren(copy)
        node.dataset.nativeSnapshot = 'true'
      }
    }
    snapshotFrame = requestAnimationFrame(() => {
      snapshotFrame = requestAnimationFrame(snapshot)
    })
    const resize = () => {
      width = band.current?.clientWidth ?? 0
      height = band.current?.clientHeight ?? 0
    }
    const observer = new ResizeObserver(resize)
    observer.observe(band.current!)
    resize()
    const visibility = () => {
      last = 0
      if (document.hidden) {
        cancelAnimationFrame(raf)
        state.current.onRetire(token)
      } else if (alive) raf = requestAnimationFrame(tick)
    }
    const tick = (now: number) => {
      if (!alive || state.current.request?.token !== token || document.hidden)
        return
      const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0
      last = now
      model.current = advanceResource(model.current, dt, state.current.reduced)
      const m = model.current,
        t = state.current.reduced ? (m.time / 0.35) * RESOURCE_DURATION : m.time
      if (integerPaused !== m.paused) {
        integerPaused = m.paused
        setPaused(m.paused)
      }
      const q = displayedThemeMix(),
        targetPolarity = m.paused ? 1 - q : q,
        response = state.current.reduced ? 1 : 1 - Math.exp(-dt / 0.065)
      polarity += (targetPolarity - polarity) * response
      backdrop.current!.style.backgroundColor = themeColor(
        '080808',
        'f3f5f7',
        polarity,
      )
      // The card survives read-only beneath the blocking root until cover is opaque.
      backdrop.current!.style.opacity = String(smooth(t / 0.16))
      node.dataset.covered = String(t >= 0.16)
      node.dataset.phase = String(t / RESOURCE_DURATION)
      node.dataset.activeTime = String(m.time)
      node.dataset.paused = String(m.paused)
      band.current!.style.backgroundColor = `rgb(${Math.round(polarity * 255)},${Math.round(polarity * 255)},${Math.round(polarity * 255)})`
      band.current!.style.color = `rgb(${255 - Math.round(polarity * 255)},${255 - Math.round(polarity * 255)},${255 - Math.round(polarity * 255)})`
      let p = resourceFraction(m.time, state.current.reduced)
      // Prepared graphics are eligibility, not authority to override a manual
      // pause. The protected launch remains covered/blocked until Continue.
      if (
        revealActive.current ||
        (state.current.request?.revealing &&
          !m.paused &&
          (state.current.reduced || m.transitionAge >= 0.3))
      ) {
        if (!revealActive.current) {
          revealActive.current = true
          setRevealStarted(true)
        }
        p = 1
        reveal = Math.min(
          1,
          reveal + dt / (state.current.reduced ? 0.12 : 0.24),
        )
        node.style.opacity = String(1 - reveal)
      }
      paintProgressWave(
        wave.current,
        width,
        height,
        p,
        m.waveAmplitude,
        m.wavePhase,
        m.bounce,
        state.current.reduced,
        polarity,
      )
      node.dataset.progress = String(p)
      node.dataset.wavePhase = String(m.wavePhase)
      for (let i = 0; i < slices.current.length; i++) {
        const s = resourceSlice(t, i, state.current.reduced),
          part = slices.current[i]
        if (part) {
          part.setAttribute('transform', `translate(${s.x} ${s.y})`)
          part.style.opacity = String(s.opacity)
        }
      }
      if (native.current) {
        native.current.style.opacity = String(smooth(t / 0.16))
        native.current.style.clipPath = `inset(0 ${Math.max(0, 12 * (1 - smooth((t - 0.16) / 2.29)))}% 0)`
      }
      for (const [phase, threshold] of [
        ['cover', 0],
        ['resolve', 1.35],
        ['settle', 2.75],
      ] as const) {
        if (t >= threshold && !emitted.has(phase)) {
          emitted.add(phase)
          state.current.onPhase(token, phase)
        }
      }
      if (t >= RESOURCE_DURATION && !m.paused && !completed) {
        completed = true
        state.current.onComplete(token)
      }
      if (reveal >= 1) {
        alive = false
        state.current.onRevealed(token)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      cancelAnimationFrame(snapshotFrame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [token, presentation, media, project])
  const activatePause = () => {
    if (state.current.request?.token !== token || revealActive.current) return
    model.current = resourceAction(model.current)
    setPaused(model.current.paused)
  }
  return (
    <div
      ref={root}
      hidden={!request}
      className="resource-transition"
      role="dialog"
      aria-modal="true"
      aria-label={project ? `Opening ${project.title}` : undefined}
      data-token={token}
      data-animation-done={request?.animationDone}
      data-native={!media}
      data-image-failed={imageFailed}
    >
      <div ref={backdrop} className="resource-backdrop" aria-hidden="true" />
      <div className="resource-stack">
        <div
          ref={field}
          className="resource-field"
          aria-hidden="true"
          style={{ '--resource-hue': project?.accent } as React.CSSProperties}
        >
          <svg
            viewBox="0 0 1000 625"
            className="resource-image-field"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {media && !imageFailed && (
                <image
                  id={`resource-image-${token}`}
                  href={image}
                  x="0"
                  y="0"
                  width="1000"
                  height="625"
                  preserveAspectRatio="xMidYMid meet"
                  onError={() => {
                    if (state.current.request?.token === token)
                      setImageFailed(true)
                  }}
                />
              )}
              {Array.from({ length: 12 }, (_, i) => (
                <clipPath key={i} id={`resource-clip-${token}-${i}`}>
                  <rect
                    x={(i % 2) * 500}
                    y={(Math.floor(i / 2) * 625) / 6}
                    width="500"
                    height={625 / 6 + 0.5}
                  />
                </clipPath>
              ))}
            </defs>
            {Array.from({ length: 12 }, (_, i) => (
              <g
                key={i}
                ref={(n) => {
                  slices.current[i] = n
                }}
                style={{ opacity: 0 }}
                transform={`translate(${resourceSlice(0, i, reduced).x} 0)`}
              >
                <g clipPath={`url(#resource-clip-${token}-${i})`}>
                  {media && !imageFailed ? (
                    <use href={`#resource-image-${token}`} />
                  ) : (
                    <rect
                      className="resource-hue-slice"
                      x="0"
                      y="0"
                      width="1000"
                      height="625"
                    />
                  )}
                </g>
              </g>
            ))}
          </svg>
          <div ref={native} className="resource-native-snapshot" />
        </div>
        <div ref={band} className="resource-progress">
          <ProgressWave nodes={wave} label="Resource transition progress" />
          <button
            ref={pause}
            type="button"
            className="intro-progress-pause"
            aria-label={paused ? 'Continue resource' : 'Pause resource'}
            aria-pressed={paused}
            disabled={revealStarted}
            onClick={activatePause}
          >
            <ProgressActionIcon paused={paused} />
          </button>
        </div>
      </div>
      <p className="sr-only" role="status">
        {request?.animationDone
          ? 'Waiting for project graphics'
          : 'Opening project'}
      </p>
      <button
        ref={cancel}
        type="button"
        className="resource-cancel"
        aria-label="Cancel and return to projects"
        onClick={() => {
          if (state.current.request?.token === token) state.current.onCancel()
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}
