import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { HelpRequest } from '../app/ProjectHelp'
export function useAnchoredHelp(
  dialog: RefObject<HTMLDialogElement | null>,
  request: HelpRequest,
) {
  useLayoutEffect(() => {
    const node = dialog.current!
    let raf = 0,
      last = ''
    const place = () => {
      const trigger = request.trigger
      // React reuses the CTA as the reel moves. Its new identity must not move or
      // rewrite an already opened project's help.
      if (
        trigger.isConnected &&
        trigger.dataset.projectId === request.project.id
      ) {
        const group = trigger.closest('.menu-actions')
        const boxes = group
          ? [...group.children]
              .map((child) => child.getBoundingClientRect())
              .filter((r) => r.width && r.height)
          : [trigger.getBoundingClientRect()]
        // Anchor to the visible controls, not their wider layout container.
        const anchor = {
          left: Math.min(...boxes.map((r) => r.left)),
          right: Math.max(...boxes.map((r) => r.right)),
          top: Math.min(...boxes.map((r) => r.top)),
          bottom: Math.max(...boxes.map((r) => r.bottom)),
          height: 0,
        }
        anchor.height = anchor.bottom - anchor.top
        if (anchor.bottom > 0 && anchor.top < innerHeight) {
          const r = node.getBoundingClientRect(),
            pad = 16,
            gap = 14,
            narrow = innerWidth < 720
          let x = anchor.right + gap,
            y = anchor.top + (anchor.height - r.height) / 2
          if (narrow) {
            x = anchor.left
            y = anchor.top - r.height - gap
            if (y < pad) y = anchor.bottom + gap
          } else if (x + r.width > innerWidth - pad) {
            x = anchor.left
            y = anchor.top - r.height - gap
            if (y < 80) y = anchor.bottom + gap
          }
          x = Math.max(pad, Math.min(innerWidth - pad - r.width, x))
          y = Math.max(pad, Math.min(innerHeight - pad - r.height, y))
          const key = `${x.toFixed(2)}:${y.toFixed(2)}`
          if (key !== last) {
            node.style.left = `${x}px`
            node.style.top = `${y}px`
            last = key
          }
          node.dataset.anchorProject = request.project.id
        }
      }
      raf = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [dialog, request])
}
