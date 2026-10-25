import { useEffect, useRef } from 'react'
// Semantic entry, not bubbling child entry. Stationary-pointer layout/scroll
// changes and programmatic focus cannot create audible intent.
export function useIntentAudio(cue: () => void, onPress: () => void) {
  const press = useRef(onPress)
  press.current = onPress
  const callback = useRef(cue)
  callback.current = cue
  useEffect(() => {
    let target: Element | null = null,
      timer = 0,
      played = false,
      lastCue = -Infinity
    let x = NaN,
      y = NaN,
      keyboard = false
    const semantic = (e: EventTarget | null) =>
      e instanceof Element && !e.closest('[data-audio-silent]')
        ? e.closest('button,a[href],input[type="range"],[role="tab"]')
        : null
    const clear = () => {
      clearTimeout(timer)
      timer = 0
    }
    const schedule = () => {
      if (
        !target ||
        played ||
        timer ||
        target.closest('[inert]') ||
        target.matches(':disabled')
      )
        return
      const entry = target
      timer = window.setTimeout(() => {
        timer = 0
        if (
          target !== entry ||
          played ||
          document.hidden ||
          !entry.isConnected ||
          entry.closest('[inert]') ||
          entry.matches(':disabled') ||
          performance.now() - lastCue < 150
        )
          return
        played = true
        lastCue = performance.now()
        callback.current()
      }, 45)
    }
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const next = semantic(e.target)
      if (next !== target) {
        clear()
        target = next
        played = false
      }
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !e.isTrusted) return
      keyboard = false
      const moved =
        Number.isNaN(x) || Math.hypot(x - e.clientX, y - e.clientY) > 1
      x = e.clientX
      y = e.clientY
      if (moved && semantic(e.target) === target) schedule()
    }
    const out = (e: PointerEvent) => {
      if (semantic(e.relatedTarget) !== target) {
        clear()
        target = null
        played = false
      }
    }
    const key = (e: KeyboardEvent) => {
      keyboard =
        e.isTrusted &&
        ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
          e.key,
        )
    }
    const focus = (e: FocusEvent) => {
      if (!keyboard) return
      keyboard = false
      clear()
      target = semantic(e.target)
      played = false
      schedule()
    }
    const down = () => {
      clear()
      played = true
      press.current()
    }
    const visibility = () => {
      if (document.hidden) down()
    }
    const scroll = () => {
      clear()
      played = true
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerover', over)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerout', out)
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', focus)
    document.addEventListener('scroll', scroll, true)
    return () => {
      clear()
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('scroll', scroll, true)
    }
  }, [])
}
