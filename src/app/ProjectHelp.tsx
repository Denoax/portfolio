import { useAnchoredHelp } from '../hooks/useAnchoredHelp'
import { CloseIcon } from './UiIcons'
import { PELAGIC_LIVE_URL } from '../core/pelagicHandoff'
import { useNonmodalDialog } from '../hooks/useNonmodalDialog'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Project } from '../content/projects'
import { projectHelp } from '../content/projectHelp'

export interface HelpRequest {
  project: Project
  trigger: HTMLButtonElement
}
const options = ['Overview', 'Details', 'Links']
export function ProjectHelp({
  request,
  onClose,
  onResource,
  onCue,
}: {
  request: HelpRequest
  onClose: () => void
  onResource: (project: Project) => void
  onCue: () => void
}) {
  const { project, overview, details } = projectHelp(request.project.id)
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useGlassDialogMotion(dialog, true, onClose)
  useAnchoredHelp(dialog, request)
  const [selected, setSelected] = useState(0)
  const [focused, setFocused] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const contentAnimation = useRef<Animation | null>(null)
  const lastOption = useRef(selected)
  useLayoutEffect(() => {
    if (lastOption.current === selected) return
    lastOption.current = selected
    const previous = contentAnimation.current
    const transitioning = previous?.playState === 'running'
    const target = dialog.current?.querySelector<HTMLElement>(
      `#help-panel-${selected}`,
    )
    const former =
      previous?.effect instanceof KeyframeEffect ? previous.effect.target : null
    const style =
      former instanceof HTMLElement ? getComputedStyle(former) : null
    const from =
      transitioning && style
        ? { opacity: style.opacity, transform: style.transform }
        : { opacity: 0.75, transform: 'translateY(3px)' }
    previous?.cancel()
    if (target && !matchMedia('(prefers-reduced-motion:reduce)').matches)
      contentAnimation.current = target.animate(
        [from, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 160, easing: 'ease-out' },
      )
  }, [selected])
  useEffect(() => () => contentAnimation.current?.cancel(), [])
  useNonmodalDialog(dialog, true, close, request.trigger, '[role=tab]')
  const link =
    project.action.kind === 'pelagic' ? PELAGIC_LIVE_URL : project.action.href
  return (
    <dialog
      ref={dialog}
      className="project-help glass-window"
      data-glass-lens="window"
      aria-labelledby="project-help-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close()
        }
      }}
    >
      <div className="help-heading">
        <p id="project-help-title">{project.title}</p>
        <button
          className="settings-close"
          type="button"
          aria-label="Close project help"
          onClick={close}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="help-body">
        <div
          className="help-options"
          role="tablist"
          aria-label="Project information"
          onKeyDown={(e) => {
            let next = focused
            if (e.key === 'Home') next = 0
            else if (e.key === 'End') next = 2
            else if (['ArrowDown', 'ArrowRight'].includes(e.key))
              next = (focused + 1) % 3
            else if (['ArrowUp', 'ArrowLeft'].includes(e.key))
              next = (focused + 2) % 3
            else return
            e.preventDefault()
            setFocused(next)
            tabs.current[next]?.focus()
          }}
        >
          {options.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              id={`help-tab-${i}`}
              aria-selected={selected === i}
              aria-controls={`help-panel-${i}`}
              tabIndex={focused === i ? 0 : -1}
              ref={(node) => {
                tabs.current[i] = node
              }}
              onFocus={() => setFocused(i)}
              onClick={() => {
                setSelected(i)
                setFocused(i)
                onCue()
              }}
            >
              {label}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="help-detail">
          {options.map((label, i) => (
            <section
              key={label}
              role="tabpanel"
              id={`help-panel-${i}`}
              aria-labelledby={`help-tab-${i}`}
              hidden={selected !== i}
              tabIndex={0}
            >
              <h2>{label}</h2>
              {i === 0 && <p>{overview}</p>}
              {i === 1 && details.map((text) => <p key={text}>{text}</p>)}
              {i === 2 && (
                <div className="help-links">
                  <a
                    href={link}
                    onClick={(e) => {
                      if (
                        e.button ||
                        e.ctrlKey ||
                        e.metaKey ||
                        e.altKey ||
                        e.shiftKey
                      )
                        return
                      e.preventDefault()
                      onResource(project)
                    }}
                  >
                    {project.action.kind === 'pelagic'
                      ? 'Explore Pelagic'
                      : 'Open resource'}{' '}
                    <span aria-hidden="true">↗</span>
                  </a>
                  <a href={project.repository} target="_blank" rel="noreferrer">
                    Repository ↗
                  </a>
                  {project.action.kind === 'pelagic' && (
                    <>
                      <a href="/work/pelagic">Case study ↗</a>
                      <a
                        href={PELAGIC_LIVE_URL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Live website ↗
                      </a>
                    </>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
