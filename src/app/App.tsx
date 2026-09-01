import { useCallback, useEffect, useMemo, useState } from 'react'
import { chapters, contact } from '../content/portfolio'
import { selectQuality } from '../core/quality'
import { ExperienceCanvas } from '../experience/ExperienceCanvas'
import { navigateToChapter, useNarrativeScroll } from '../hooks/useNarrativeScroll'
import { ChapterLayer } from './ChapterLayer'

export function App() {
  const [ready, setReady] = useState(false)
  const [displayValue, setDisplayValue] = useState(4)
  const [activeChapter, setActiveChapter] = useState(0)
  const [indexOpen, setIndexOpen] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const quality = useMemo(selectQuality, [])
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const handleReady = useCallback(() => setReady(true), [])
  const handleActiveChange = useCallback((index: number) => setActiveChapter(index), [])
  useNarrativeScroll({ chapterCount: chapters.length, onActiveChange: handleActiveChange })

  useEffect(() => {
    if (ready) {
      setDisplayValue(100)
      return
    }
    const timer = window.setInterval(() => {
      setDisplayValue((value) => Math.min(value + Math.ceil((92 - value) * 0.08), 92))
    }, 90)
    return () => window.clearInterval(timer)
  }, [ready])

  useEffect(() => {
    const cursor = document.querySelector<HTMLElement>('.cursor')
    if (!cursor) return
    let frame = 0
    let currentX = -30
    let currentY = -30
    let targetX = -30
    let targetY = -30
    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
    }
    const tick = () => {
      currentX += (targetX - currentX) * 0.22
      currentY += (targetY - currentY) * 0.22
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      frame = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  const selectChapter = (index: number) => {
    navigateToChapter(index, chapters.length)
    setIndexOpen(false)
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
      setEmailCopied(true)
      window.setTimeout(() => setEmailCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${contact.email}`
    }
  }

  return (
    <div className={ready ? 'site is-ready' : 'site'}>
      <a className="skip-link" href="#signal">Skip to content</a>
      <ExperienceCanvas quality={quality} reducedMotion={reducedMotion} onReady={handleReady} />

      <div className={`loader ${ready ? 'loader--complete' : ''}`} aria-live="polite">
        <div className="loader__mark">M / FIELD</div>
        <div className="loader__value">{String(displayValue).padStart(3, '0')}</div>
        <div className="loader__status">FIELD INITIALIZATION</div>
      </div>

      <header className="frame-ui">
        <button className="frame-ui__brand" type="button" onClick={() => selectChapter(0)}>
          Mani
        </button>
        <button
          className="frame-ui__chapter"
          type="button"
          onClick={() => setIndexOpen((open) => !open)}
          aria-expanded={indexOpen}
          aria-controls="chapter-index"
        >
          <span>{chapters[activeChapter].number}</span>
          <span>{chapters[activeChapter].label}</span>
        </button>
        <div className="frame-ui__links">
          <a href={contact.github} target="_blank" rel="noreferrer">GITHUB ↗</a>
          <button type="button" onClick={copyEmail}>{emailCopied ? 'COPIED' : 'EMAIL'}</button>
        </div>
      </header>

      <nav id="chapter-index" className={`chapter-index ${indexOpen ? 'is-open' : ''}`} aria-label="Portfolio chapters">
        <ol>
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => selectChapter(index)}
                aria-current={activeChapter === index ? 'step' : undefined}
              >
                <span>{chapter.number}</span>
                <span>{chapter.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <aside className="progress-rail" aria-hidden="true">
        <span>00</span>
        <i><b data-progress-line /></i>
        <span>07</span>
      </aside>

      <main className="narrative">
        {chapters.map((chapter, index) => (
          <ChapterLayer
            key={chapter.id}
            index={index}
            onCopyEmail={copyEmail}
            emailCopied={emailCopied}
          />
        ))}
      </main>

      <div className="cursor" aria-hidden="true"><i /></div>
    </div>
  )
}
