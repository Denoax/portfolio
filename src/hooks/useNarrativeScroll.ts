import { useEffect } from 'react'
import { clamp, narrative, smoothstep } from '../core/narrative'

interface NarrativeScrollOptions {
  chapterCount: number
  onActiveChange: (index: number) => void
}

export function useNarrativeScroll({ chapterCount, onActiveChange }: NarrativeScrollOptions) {
  useEffect(() => {
    narrative.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement
    const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter-layer]'))
    const progressLine = document.querySelector<HTMLElement>('[data-progress-line]')
    let frame = 0
    let lastTime = performance.now()
    let lastProgress = 0
    let active = -1

    const measure = () => {
      const scrollRange = Math.max(1, root.scrollHeight - window.innerHeight)
      narrative.target = clamp(window.scrollY / scrollRange)
    }

    const tick = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000)
      const response = narrative.reducedMotion ? 1 : 1 - Math.exp(-delta * 7.5)
      narrative.progress += (narrative.target - narrative.progress) * response
      narrative.state = narrative.progress * (chapterCount - 1)
      narrative.velocity +=
        ((narrative.progress - lastProgress) / Math.max(delta, 0.001) - narrative.velocity) *
        (1 - Math.exp(-delta * 5))
      lastProgress = narrative.progress
      lastTime = time

      const nextActive = Math.min(chapterCount - 1, Math.max(0, Math.round(narrative.state)))
      if (nextActive !== active) {
        active = nextActive
        narrative.active = active
        onActiveChange(active)
      }

      root.style.setProperty('--narrative-progress', narrative.progress.toFixed(5))
      root.style.setProperty('--scroll-velocity', Math.min(1, Math.abs(narrative.velocity)).toFixed(4))
      if (progressLine) progressLine.style.transform = `scaleY(${narrative.progress})`

      const baseChapter = Math.floor(narrative.state)
      const transition = narrative.state - baseChapter
      layers.forEach((layer, index) => {
        const distance = narrative.state - index
        let visibility = 0
        if (baseChapter === chapterCount - 1 && index === baseChapter) {
          visibility = 1
        } else if (index === baseChapter) {
          visibility = 1 - smoothstep((transition - 0.34) / 0.16)
        } else if (index === baseChapter + 1) {
          visibility = smoothstep((transition - 0.5) / 0.16)
        }
        const travel = clamp(distance, -1, 1) * (window.innerWidth < 720 ? -24 : -40)
        layer.style.opacity = visibility.toFixed(4)
        layer.style.transform = `translate3d(0, ${travel}px, 0)`
        layer.style.filter = `blur(${(1 - visibility) * 2.5}px)`
        layer.style.pointerEvents = visibility > 0.75 ? 'auto' : 'none'
        layer.toggleAttribute('aria-hidden', visibility < 0.2)
      })

      frame = requestAnimationFrame(tick)
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [chapterCount, onActiveChange])
}

export function navigateToChapter(index: number, chapterCount: number) {
  const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({
    top: (index / (chapterCount - 1)) * scrollRange,
    behavior: narrative.reducedMotion ? 'auto' : 'smooth',
  })
}
