export function isScrollInput(event: Event) {
  if (
    event.target instanceof Element &&
    event.target.closest('dialog,input,textarea,select,[contenteditable=true]')
  )
    return false
  if (event instanceof KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false
    if (
      event.key === ' ' &&
      event.target instanceof Element &&
      event.target.closest('button,a')
    )
      return false
    return [
      'ArrowDown',
      'ArrowUp',
      'PageDown',
      'PageUp',
      'Home',
      'End',
      ' ',
    ].includes(event.key)
  }
  if (event instanceof WheelEvent && (event.ctrlKey || event.metaKey))
    return false
  return event.type === 'wheel' || event.type === 'touchmove'
}
