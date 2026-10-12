import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

export function useAnchoredProjects(
  dialog: RefObject<HTMLDialogElement | null>,
  navGroup: RefObject<HTMLDivElement | null>,
  open: boolean,
  preferredWidth = 420,
) {
  useLayoutEffect(() => {
    const node = dialog.current
    if (!open || !node) return
    const place = () => {
      const group = navGroup.current
      const anchor = group?.getClientRects().length
        ? group
        : document.querySelector<HTMLElement>('.utility-toggle')
      const rect = anchor?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(preferredWidth, innerWidth - 32)
      const left = Math.max(
        16,
        Math.min(innerWidth - width - 16, rect.right - width),
      )
      const top = Math.max(16, Math.min(rect.bottom + 11, innerHeight - 100))
      Object.assign(node.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        maxHeight: `${Math.max(60, innerHeight - top - 16)}px`,
      })
    }
    const observer = new ResizeObserver(place)
    if (navGroup.current) observer.observe(navGroup.current)
    const header = document.querySelector('.hub-header')
    if (header) observer.observe(header)
    place()
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [dialog, navGroup, open, preferredWidth])
}
