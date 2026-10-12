import { useLayoutEffect, useRef } from 'react'

export const ROUTE_FADE_MS = 240

// One finite, token-owned envelope. No modal, progress choreography or dwell.
// Hidden documents complete the accepted action rather than waiting for RAF.
export function useRouteFade({
  token,
  ready,
  reduced,
  onProgress,
  onComplete,
  onCancel,
}: {
  token: number | null
  ready: boolean
  reduced: boolean
  onProgress: (fraction: number) => void
  onComplete: () => void
  onCancel: () => void
}) {
  const callbacks = useRef({ onProgress, onComplete, onCancel })
  const cancellation = useRef(0)
  callbacks.current = { onProgress, onComplete, onCancel }
  useLayoutEffect(() => {
    if (token === null) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        cancellation.current++
        callbacks.current.onCancel()
      }
    }
    document.addEventListener('keydown', cancel)
    return () => document.removeEventListener('keydown', cancel)
  }, [token])
  useLayoutEffect(() => {
    if (token === null || !ready) return
    let frame = 0
    let alive = true
    const epoch = cancellation.current
    const duration = reduced ? 0 : ROUTE_FADE_MS
    const started = performance.now()
    const trace = (phase: string) =>
      window.dispatchEvent(
        new CustomEvent('portfolio:route-fade', {
          detail: {
            token,
            phase,
            at: performance.now(),
            started,
            duration,
            reduced,
          },
        }),
      )
    trace('started')
    let feedback = false
    const finish = () => {
      if (!alive || epoch !== cancellation.current) return
      alive = false
      cancelAnimationFrame(frame)
      callbacks.current.onProgress(1)
      trace('completed')
      callbacks.current.onComplete()
    }
    const tick = (now: number) => {
      if (!alive || epoch !== cancellation.current) return
      const p = duration ? Math.min(1, (now - started) / duration) : 1
      callbacks.current.onProgress(p * p * (3 - 2 * p))
      if (!feedback) {
        feedback = true
        trace('first-feedback')
      }
      if (p === 1) finish()
      else frame = requestAnimationFrame(tick)
    }
    const hidden = () => {
      if (document.hidden) finish()
    }
    frame = requestAnimationFrame(tick)
    // Recovery only: the envelope still starts immediately and normally ends
    // at 240 ms. A suspended/lost animation callback cannot strand the page.
    const recovery = window.setTimeout(finish, duration + 80)
    document.addEventListener('visibilitychange', hidden)
    hidden()
    return () => {
      alive = false
      cancelAnimationFrame(frame)
      clearTimeout(recovery)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [token, ready, reduced])
}
