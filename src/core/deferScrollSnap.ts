import { isScrollInput } from './scrollInput'
// Restoring mandatory snap immediately rounds a stopped fractional tour pose.
// Native scrolling is unlocked now; snap resumes with the next manual gesture.
export function deferScrollSnap(element: HTMLElement, original: string) {
  element.style.scrollSnapType = 'none'
  element.dataset.snapHeld = 'true'
  const restore = () => {
    element.style.scrollSnapType = original
    delete element.dataset.snapHeld
    element.removeEventListener('wheel', input)
    element.removeEventListener('touchmove', input)
    element.removeEventListener('keydown', input)
  }
  const input = (event: Event) => {
    if (isScrollInput(event)) restore()
  }
  element.addEventListener('wheel', input, { passive: true })
  element.addEventListener('touchmove', input, { passive: true })
  element.addEventListener('keydown', input)
  return restore
}
