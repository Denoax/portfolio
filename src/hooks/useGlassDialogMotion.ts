import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { paneFlights } from '../experience/glass/PaneFlights'

// Visibility/focus belongs to the native owner. Decorative exit paint never
// holds a pane open or gates a resource selection behind its settling time.
export function useGlassDialogMotion(
  dialog: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  trigger?: RefObject<HTMLElement | null> | HTMLElement | string,
) {
  const callback = useRef(onClose),
    closing = useRef(false),
    generation = useRef(0)
  callback.current = onClose
  useLayoutEffect(() => {
    if (!open || !dialog.current) return
    const node = dialog.current,
      token = ++generation.current
    closing.current = false
    const supplied =
      typeof trigger === 'string'
        ? document.querySelector<HTMLElement>(trigger)
        : trigger instanceof HTMLElement
          ? trigger
          : trigger?.current
    const origin =
      supplied ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    // All native show()/anchor layout effects complete before measuring paint.
    // This microtask still runs before the browser presents an opening frame.
    queueMicrotask(() => {
      if (generation.current !== token || !node.isConnected || closing.current)
        return
      // Portrait navigation closes in the same event as the pane opens. Keep
      // that real button's measured origin; native anchoring/focus stay separate.
      const visibleOrigin = paneFlights.recentOrigin() ?? (origin?.getClientRects().length
        ? origin
        : document.querySelector<HTMLElement>('.utility-toggle'))
      paneFlights.request(node, true, visibleOrigin)
    })
    return () => {
      generation.current++
      if (!closing.current) paneFlights.request(node, false)
    }
  }, [open, dialog, trigger])
  return () => {
    if (closing.current) return
    closing.current = true
    generation.current++
    if (dialog.current) paneFlights.request(dialog.current, false)
    callback.current()
  }
}
