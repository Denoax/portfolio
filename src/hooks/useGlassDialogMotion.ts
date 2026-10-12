import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Retarget from the displayed pane, including an opening interrupted by Close.
// The parent retains the pane until the closing frame settles. Input ownership
// belongs to its modal or nonmodal controller.
export function useGlassDialogMotion(
  dialog: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const callback = useRef(onClose)
  callback.current = onClose
  useEffect(() => {
    if (!open || !dialog.current) return
    closing.current = false
    const node = dialog.current
    animation.current?.cancel()
    animation.current = node.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: matchMedia('(prefers-reduced-motion:reduce)').matches
          ? 0
          : 140,
        easing: 'cubic-bezier(.2,.7,.2,1)',
        fill: 'forwards',
      },
    )
    return () => {
      animation.current?.cancel()
      animation.current = null
    }
  }, [open, dialog])
  return () => {
    if (closing.current || !dialog.current) return
    closing.current = true
    const node = dialog.current,
      style = getComputedStyle(node)
    const current = { opacity: style.opacity, transform: style.transform }
    animation.current?.cancel()
    const exit = node.animate(
      [current, { opacity: 0, transform: 'translateY(8px)' }],
      {
        duration: matchMedia('(prefers-reduced-motion:reduce)').matches
          ? 0
          : 160,
        easing: 'ease-out',
        fill: 'forwards',
      },
    )
    animation.current = exit
    exit.finished
      .then(() => {
        if (animation.current === exit) callback.current()
      })
      .catch(() => {})
  }
}
