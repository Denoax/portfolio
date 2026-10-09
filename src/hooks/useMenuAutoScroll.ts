import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { isScrollInput } from '../core/scrollInput'
import { advanceAutoRate } from '../core/autoRate'
import { deferScrollSnap } from '../core/deferScrollSnap'
export function useMenuAutoScroll(
  scroll: RefObject<HTMLDivElement | null>,
  eligible: boolean,
  reduced: boolean,
  count: number,
  speed: number,
  temporaryPause = false,
) {
  const targetRate = useRef(speed)
  targetRate.current = speed
  const [mode, setMode] = useState<
    'manual' | 'running' | 'suspended' | 'stopped'
  >('manual')
  const resumeAfterHelp = useRef(false)
  const deferredSnap = useRef<(() => void) | null>(null)
  const live = useRef(mode)
  live.current = mode
  const stop = () => {
    resumeAfterHelp.current = false
    live.current = 'stopped'
    setMode('stopped')
  }
  const suspend = () => {
    if (live.current === 'running') {
      live.current = 'suspended'
      setMode('suspended')
    }
  }
  const toggle = () => {
    if (live.current === 'running') stop()
    else if (eligible && !document.hidden) {
      const el = scroll.current!
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1)
        el.scrollTop = 0
      live.current = 'running'
      setMode('running')
    }
  }
  useEffect(() => {
    if (!eligible) {
      if (temporaryPause && live.current === 'running')
        resumeAfterHelp.current = true
      else if (!temporaryPause) resumeAfterHelp.current = false
      suspend()
    } else if (resumeAfterHelp.current && !document.hidden && !reduced) {
      resumeAfterHelp.current = false
      live.current = 'running'
      setMode('running')
    }
  }, [eligible, temporaryPause, reduced])
  useEffect(() => {
    suspend()
  }, [reduced])
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        resumeAfterHelp.current = false
        suspend()
      }
    }
    const page = () => stop()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', page)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', page)
    }
  }, [])
  useEffect(() => {
    const el = scroll.current
    if (mode !== 'running' || !eligible || !el) return
    deferredSnap.current?.()
    deferredSnap.current = null
    const previous = {
      overflow: el.style.overflowY,
      snap: el.style.scrollSnapType,
    }
    el.style.overflowY = 'hidden'
    el.style.scrollSnapType = 'none'
    el.dataset.auto = 'running'
    let raf = 0,
      last = 0,
      position = el.scrollTop,
      rate = targetRate.current
    const tick = (now: number) => {
      if (live.current !== 'running') return
      if (last && !document.hidden) {
        const step = advanceAutoRate(
          rate,
          targetRate.current,
          (now - last) / 1000,
        )
        rate = step.rate
        position = Math.min(
          el.scrollHeight - el.clientHeight,
          position + (step.seconds * el.clientHeight) / 5,
        )
      }
      el.scrollTop = position
      last = now
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 0.5) stop()
      else raf = requestAnimationFrame(tick)
    }
    const guard = (e: Event) => {
      if (isScrollInput(e)) e.preventDefault()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        stop()
      } else guard(e)
    }
    const resize = () => suspend()
    el.addEventListener('wheel', guard, { passive: false })
    el.addEventListener('touchmove', guard, { passive: false })
    el.addEventListener('keydown', key)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.style.overflowY = previous.overflow
      deferredSnap.current = deferScrollSnap(el, previous.snap)
      delete el.dataset.auto
      el.removeEventListener('wheel', guard)
      el.removeEventListener('touchmove', guard)
      el.removeEventListener('keydown', key)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', resize)
    }
  }, [mode, eligible, count])
  useEffect(() => () => deferredSnap.current?.(), [])
  return { mode, stop, toggle }
}
