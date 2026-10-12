import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { restoreFocus } from '../core/restoreFocus'

// Ordinary panes share Escape ownership, but never browser modal inertness or
// a focus trap. Closing cannot reclaim focus deliberately moved to the site.
let activationSequence = 0
export function useNonmodalDialog(
  dialog: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
  trigger?: RefObject<HTMLElement | null> | HTMLElement,
  initialFocus = 'button',
) {
  const callback = useRef(onClose)
  callback.current = onClose
  useLayoutEffect(() => {
    const node = dialog.current
    if (!open || !node) return
    const origin =
      trigger instanceof HTMLElement
        ? trigger
        : (trigger?.current ?? document.activeElement)
    const originalZ = node.style.zIndex
    const activate = () => {
      node.dataset.paneOrder = String(++activationSequence)
      const panes = Array.from(
        document.querySelectorAll<HTMLDialogElement>(
          'dialog[open][data-pane-order]',
        ),
      ).sort(
        (a, b) => Number(a.dataset.paneOrder) - Number(b.dataset.paneOrder),
      )
      panes.forEach((pane, index) => {
        pane.style.zIndex = String(20 + index)
      })
    }
    node.show()
    activate()
    node.setAttribute('aria-modal', 'false')
    node
      .querySelector<HTMLElement>(initialFocus)
      ?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.querySelector('dialog:modal')
      )
        return
      const panes = Array.from(
        document.querySelectorAll<HTMLDialogElement>(
          'dialog[open][data-pane-order]',
        ),
      )
      const latest = panes.sort(
        (a, b) => Number(b.dataset.paneOrder) - Number(a.dataset.paneOrder),
      )[0]
      if (latest !== node) return
      event.preventDefault()
      callback.current()
    }
    node.addEventListener('focusin', activate)
    node.addEventListener('pointerdown', activate)
    document.addEventListener('keydown', escape)
    return () => {
      const restore = node.contains(document.activeElement)
      node.close()
      node.removeEventListener('focusin', activate)
      node.removeEventListener('pointerdown', activate)
      document.removeEventListener('keydown', escape)
      delete node.dataset.paneOrder
      node.style.zIndex = originalZ
      if (
        restore &&
        origin instanceof HTMLElement &&
        !origin.closest('[inert]')
      )
        restoreFocus(
          origin,
          matchMedia('(max-width:899px)').matches
            ? '.utility-toggle'
            : '.hub-brand',
        )
    }
  }, [dialog, open, trigger, initialFocus])
}
