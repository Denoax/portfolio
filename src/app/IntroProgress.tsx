import { displayedThemeMix } from '../core/theme'
import {
  ProgressWave,
  ProgressActionIcon,
  paintProgressWave,
  emptyWaveElements,
} from './ProgressWave'
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  advanceEntry,
  createEntryProgress,
  entryAction,
} from '../core/entryProgress'
import type { PauseReason } from '../core/entryProgress'
import type { MenuPresentation } from '../core/menuReel'

// Original SVG adaptation of Petar Cirkovic's inspected progress study.
// One active-time transaction; asset readiness is a separate reveal condition.
let entryEpoch = 0
export function IntroProgress({
  presentation,
  ready,
  reduced,
  blocked,
  onDone,
  onCancel,
}: {
  presentation: RefObject<MenuPresentation>
  ready: boolean
  reduced: boolean
  blocked: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    wave = useRef(emptyWaveElements())
  const [reason, setReason] = useState<PauseReason>(null)
  const model = useRef(createEntryProgress(0))
  const paused = reason !== null
  const state = useRef({ ready, blocked, paused, reduced, onDone, onCancel })
  state.current = { ready, blocked, paused, reduced, onDone, onCancel }
  useLayoutEffect(() => {
    const node = dialog.current!
    wave.current.integer = -1
    const previousFocus = document.activeElement as HTMLElement | null
    node.showModal()
    node.querySelector<HTMLButtonElement>('button')!.focus()
    model.current = createEntryProgress(++entryEpoch)
    const initialLight = document.documentElement.dataset.colorTheme === 'light'
    let alive = true,
      last = 0,
      polarity = initialLight ? 1 : 0,
      raf = 0
    let width = innerWidth,
      height = innerHeight
    const resize = () => {
      width = innerWidth
      height = innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const tick = (now: number) => {
      if (!alive) return
      const dt =
        last && !document.hidden
          ? Math.max(0, Math.min(0.05, (now - last) / 1000))
          : 0
      last = now
      const previousReason = model.current.reason
      if (!document.hidden && !state.current.blocked)
        model.current = advanceEntry(
          model.current,
          dt,
          state.current.ready,
          state.current.reduced,
        )
      const m = model.current,
        { age, p, reveal } = m
      if (previousReason !== m.reason) setReason(m.reason)
      const response = state.current.reduced ? 1 : 1 - Math.exp(-dt / 0.065)
      const q = displayedThemeMix()
      const targetPolarity = m.reason ? 1 - q : q
      polarity += (targetPolarity - polarity) * response
      const bg = Math.round(polarity * 255),
        ink = 255 - bg
      node.style.backgroundColor = `rgb(${bg},${bg},${bg})`
      node.style.color = `rgb(${ink},${ink},${ink})`
      node.style.opacity = String(Math.min(1, age / 0.18) * (1 - reveal))
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
      node.dataset.paused = String(Boolean(m.reason))
      node.dataset.phase = m.phase
      node.dataset.epoch = String(m.epoch)
      node.dataset.reason = m.reason ?? ''
      node.dataset.consumed = String(m.checkpointConsumed)
      node.dataset.waveAmplitude = String(m.waveAmplitude)
      node.dataset.wavePhase = String(m.wavePhase)
      node.dataset.waveVelocity = String(m.waveVelocity)
      const cue = node.querySelector<HTMLElement>('.entry-continue-cue')!
      cue.style.opacity = m.reason
        ? String(
            state.current.reduced
              ? 1
              : Math.min(1, m.pauseAge / 0.4) *
                  (m.pauseAge < 4
                    ? 1
                    : 0.55 + 0.15 * Math.sin(m.pauseAge * 0.65)),
          )
        : '0'
      presentation.current.intro.exitProgress = reveal
      if (reveal >= 1) {
        alive = false
        node.close()
        state.current.onDone()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    tick(performance.now())
    const hidden = () => {
      last = 0
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      node.close()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', hidden)
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true })
    }
  }, [presentation])
  return (
    <dialog
      className="intro-progress"
      ref={dialog}
      aria-label="Enter portfolio"
      onCancel={(e) => {
        e.preventDefault()
        state.current.onCancel()
      }}
    >
      <ProgressWave nodes={wave} label="Portfolio entry animation" />
      <button
        type="button"
        className="intro-progress-pause"
        aria-label={
          reason === 'checkpoint'
            ? 'Continue'
            : paused
              ? 'Resume entry'
              : 'Pause entry'
        }
        aria-pressed={paused}
        onClick={() => {
          model.current = entryAction(model.current)
          setReason(model.current.reason)
        }}
      >
        <ProgressActionIcon paused={paused} />
      </button>
      <p className="entry-continue-cue" aria-hidden="true">
        <span className="intro-hint-pointer">Click to continue</span>
        <span className="intro-hint-touch">Tap to continue</span>
      </p>
      <p className="sr-only" role="status">
        {reason === 'checkpoint'
          ? 'Entry paused at 67%. Continue to enter the portfolio.'
          : ''}
      </p>
      <p className="entry-ready-message" role="status">
        Preparing the project view. Escape returns to the opening.
      </p>
    </dialog>
  )
}
