import PortfolioGravity from './rare/PortfolioGravity'
import { ProfileActivity } from './rare/ProfileActivity'
import { CloseIcon } from './UiIcons'
import { createPortal } from 'react-dom'
import { useNonmodalDialog } from '../hooks/useNonmodalDialog'
import { restoreFocus } from '../core/restoreFocus'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { RefObject, KeyboardEvent, MouseEvent } from 'react'
import {
  activeMenuView,
  menuViews,
  restoredProgress,
  scrollProgress,
} from '../core/menuReel'
import type { MenuPresentation } from '../core/menuReel'
import { PreviewPlayback } from '../core/previewPlayback'
import type { Project } from '../content/projects'
import { AutoScrollControl } from './AutoScrollControl'
import { useMenuAutoScroll } from '../hooks/useMenuAutoScroll'
import { deferScrollSnap } from '../core/deferScrollSnap'

export function SelectionHub({
  staticView,
  notice,
  aligning,
  active,
  presentation,
  actionRef,
  onResource,
  onProjectHelp,
  helpOpen,
  indexRequest,
  dismissIndexRequest,
  hidden,
  onIndexChange,
  onIntroEnter,
  selectionEpoch,
  previews,
  speed,
  onSpeed,
  onCue,
  dockSlot,
}: {
  staticView: boolean
  notice: string
  aligning: boolean
  active: boolean
  presentation: RefObject<MenuPresentation>
  actionRef: RefObject<HTMLElement | null>
  onResource: (project: Project) => void
  onProjectHelp: (project: Project, trigger: HTMLButtonElement) => void
  helpOpen: boolean
  indexRequest: number
  dismissIndexRequest: number
  hidden: boolean
  onIndexChange: (open: boolean) => void
  onIntroEnter: () => void
  selectionEpoch: number
  previews: PreviewPlayback
  speed: number
  onSpeed: (value: number) => void
  onCue: (cue: import('../audio/InterfaceAudio').SoundCue) => void
  dockSlot: HTMLElement | null
}) {
  const scroll = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null)
  const indexDialog = useRef<HTMLDialogElement>(null)
  const [indexOpen, setIndexOpen] = useState(false)
  const pendingSelection = useRef<{
    id: string
    token: number
    fromIntro: boolean
  } | null>(null)
  const selectionSequence = useRef(0)
  const indexTrigger = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    pendingSelection.current = null
    selectionSequence.current++
  }, [selectionEpoch])
  const auto = useMenuAutoScroll(
    scroll,
    active,
    presentation.current.reduced,
    menuViews.length,
    speed,
    false,
  )
  const helpSnap = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    const element = scroll.current
    if (active || hidden || !element || element.dataset.auto === 'running')
      return
    // Native smooth scroll otherwise continues behind the modal while its
    // scroll handler is paused. Freeze at the actual offset without rounding.
    helpSnap.current?.()
    helpSnap.current = deferScrollSnap(element, element.style.scrollSnapType)
    element.scrollTo({ top: element.scrollTop, behavior: 'instant' })
  }, [active, hidden])
  useEffect(() => () => helpSnap.current?.(), [])
  const closeIndex = () => {
    onCue('cancel')
    setIndexOpen(false)
    onIndexChange(false)
    indexDialog.current?.close()
    if (pendingSelection.current?.fromIntro) onIntroEnter()
    else if (indexDialog.current?.contains(document.activeElement))
      restoreFocus(
        indexTrigger.current,
        matchMedia('(max-width:899px)').matches
          ? '.utility-toggle'
          : '#projects-trigger',
      )
  }
  const dismissIndex = useGlassDialogMotion(indexDialog, indexOpen, closeIndex)
  useEffect(() => {
    if (!indexRequest) return
    pendingSelection.current = null
    selectionSequence.current++
    indexTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setIndexOpen(true)
    onIndexChange(true)
    // The shared nonmodal owner opens after this state commit.
  }, [indexRequest])
  useEffect(() => () => onIndexChange(false), [])
  useNonmodalDialog(indexDialog, indexOpen, dismissIndex, indexTrigger)
  useEffect(() => {
    if (!dismissIndexRequest) return
    pendingSelection.current = null
    setIndexOpen(false)
    onIndexChange(false)
  }, [dismissIndexRequest])
  const mediaTarget = useRef<HTMLElement | null>(null)
  const mediaHit = useRef<HTMLDivElement>(null)
  const [mediaEligible, setMediaEligible] = useState(false)
  const [glyphBudget, setGlyphBudget] = useState(() =>
    innerWidth < 720 ? 64 : 96,
  )
  const touchPreview = useRef<string | null>(null)
  const gesture = useRef({
    x: 0,
    y: 0,
    dragged: false,
    project: null as Project | null,
  })
  const scrolledAt = useRef(-Infinity),
    pointer = useRef({ x: NaN, y: NaN })
  const [view, setView] = useState(() =>
    activeMenuView(
      restoredProgress(
        presentation.current.savedProjectId,
        presentation.current.savedOffset,
        menuViews.map((p) => p.id),
      ),
    ),
  )
  const preview = useSyncExternalStore(previews.subscribe, previews.getSnapshot)
  const project = menuViews[view],
    playing =
      preview.projectId === project.id &&
      ['playing', 'paused', 'gif'].includes(preview.state)
  // Native cards keep one owner throughout approach, selection and departure.
  // The selected hit target is derived from the same stable card registry.
  useLayoutEffect(() => {
    const target =
      project.presentation === 'media'
        ? mediaHit.current
        : (presentation.current.nativeTargets.get(project.id) ?? null)
    mediaTarget.current = target
    presentation.current.mediaTarget = target
  }, [project.id, presentation])
  useLayoutEffect(() => {
    if (!staticView) return
    for (const target of presentation.current.nativeTargets.values()) {
      target.dataset.ready = 'false'
      target.style.opacity = '0'
      target.style.visibility = 'hidden'
    }
    const current = mediaTarget.current
    if (!current) return
    current.style.opacity = '1'
    current.style.visibility = 'visible'
    const art = scroll.current!.querySelector<HTMLElement>(
      '.menu-static-art, .menu-static-geometry',
    )
    if (!art) {
      const target = mediaTarget.current!
      Object.assign(target.style, {
        left: '',
        top: '',
        width: '',
        height: '',
        transform: 'none',
      })
      target.dataset.ready = 'true'
      return
    }
    const fitTarget = () => {
      const bounds = art.getBoundingClientRect()
      const parent = stage.current!.getBoundingClientRect()
      const target = mediaTarget.current!
      target.style.transform = 'none'
      Object.assign(target.style, {
        left: `${bounds.left - parent.left}px`,
        top: `${bounds.top - parent.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      })
      target.dataset.ready = 'true'
    }
    const observer = new ResizeObserver(fitTarget)
    observer.observe(art)
    fitTarget()
    return () => observer.disconnect()
  }, [staticView, view])
  useLayoutEffect(() => {
    const element = scroll.current!,
      state = presentation.current
    state.stage = stage.current
    state.mediaTarget = mediaTarget.current
    state.target = restoredProgress(
      state.savedProjectId,
      state.savedOffset,
      menuViews.map((p) => p.id),
    )
    state.saved = state.target
    state.rendered = state.target
    let previousWidth = element.clientWidth,
      previousHeight = element.clientHeight
    const restore = () => {
      setGlyphBudget(innerWidth < 720 ? 64 : 96)
      if (
        previousWidth !== element.clientWidth ||
        previousHeight !== element.clientHeight
      ) {
        previews.stop()
        previousWidth = element.clientWidth
        previousHeight = element.clientHeight
      }
      element.scrollTop =
        state.target * Math.max(0, element.scrollHeight - element.clientHeight)
    }
    const restoreSnap = state.savedOffset
      ? deferScrollSnap(element, element.style.scrollSnapType)
      : null
    // Disable snap before writing the fractional pose; otherwise the browser
    // can queue a rounded snap even after scroll-snap-type becomes none.
    restore()
    const observer = new ResizeObserver(restore)
    observer.observe(element)
    return () => {
      observer.disconnect()
      restoreSnap?.()
      state.stage = null
      state.mediaTarget = null
    }
  }, [presentation, previews])
  const readScroll = () => {
    if (!active) return
    previews.stop()
    touchPreview.current = null
    presentation.current.hovered = false
    scrolledAt.current = performance.now()
    const element = scroll.current!,
      state = presentation.current
    const target = scrollProgress(
        element.scrollTop,
        element.scrollHeight,
        element.clientHeight,
      ),
      next = activeMenuView(target)
    state.target = target
    state.saved = target
    state.selectedId = menuViews[next].id
    state.savedProjectId = state.selectedId
    state.savedOffset = target * Math.max(0, menuViews.length - 1) - next
    if (staticView) state.rendered = target
    setView((previous) => (previous === next ? previous : next))
  }
  const select = (index: number, silent = false) => {
    if (!active && !indexOpen) return
    if (!silent) onCue('activate')
    auto.stop()
    previews.stop()
    presentation.current.hovered = false
    const next = menuViews[index],
      state = presentation.current
    if (staticView) {
      state.target = index / Math.max(1, menuViews.length - 1)
      state.saved = state.target
      state.selectedId = state.savedProjectId = next.id
      state.savedOffset = 0
      state.rendered = state.target
      setView(index)
    }
    scroll.current!.scrollTo({
      top:
        (index / Math.max(1, menuViews.length - 1)) *
        Math.max(
          0,
          scroll.current!.scrollHeight - scroll.current!.clientHeight,
        ),
      behavior: staticView ? 'instant' : 'smooth',
    })
  }
  useLayoutEffect(() => {
    const state = presentation.current
    state.stopAuto = auto.stop
    state.scrollReelBy = (delta) => {
      if (!active || hidden || presentation.current.paused) return
      auto.stop()
      scroll.current?.scrollBy({ top: delta, behavior: 'instant' })
    }
    state.selectProject = (id, silent) => {
      const index = menuViews.findIndex((item) => item.id === id)
      if (index < 0) return
      if (hidden) {
        auto.stop()
        pendingSelection.current = {
          id,
          token: ++selectionSequence.current,
          fromIntro: true,
        }
        onIntroEnter()
      } else select(index, silent)
    }
    return () => {
      state.selectProject = null
      state.stopAuto = null
      state.scrollReelBy = null
    }
  })
  useLayoutEffect(() => {
    const ticket = pendingSelection.current
    if (!active || indexOpen || !ticket) return
    const index = menuViews.findIndex((item) => item.id === ticket.id)
    pendingSelection.current = null
    if (index < 0 || ticket.token !== selectionSequence.current) return
    select(index)
    // Reconcile after eligibility against native dimensions, then focus only
    // once this request's visible reel pose settles. No duration-based timer.
    readScroll()
    let frame = 0
    const focusSelected = () => {
      if (
        ticket.token !== selectionSequence.current ||
        presentation.current.paused
      )
        return
      if (
        Math.abs(
          presentation.current.rendered - index / (menuViews.length - 1),
        ) > 0.003
      ) {
        frame = requestAnimationFrame(focusSelected)
      } else actionRef.current?.focus({ preventScroll: true })
    }
    frame = requestAnimationFrame(focusSelected)
    return () => cancelAnimationFrame(frame)
  }, [active, indexOpen])
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      auto.mode === 'running' ||
      event.target !== event.currentTarget ||
      !active
    )
      return
    const last = menuViews.length - 1
    const keys: Record<string, number> = {
      ArrowDown: Math.min(last, view + 1),
      PageDown: Math.min(last, view + 1),
      ArrowUp: Math.max(0, view - 1),
      PageUp: Math.max(0, view - 1),
      Home: 0,
      End: last,
    }
    if (event.key in keys) {
      event.preventDefault()
      select(keys[event.key])
    }
  }
  const hover = (x: number, y: number) => {
    const moved = x !== pointer.current.x || y !== pointer.current.y
    pointer.current = { x, y }
    if (
      moved &&
      active &&
      !presentation.current.reduced &&
      performance.now() - scrolledAt.current > 180 &&
      matchMedia('(hover:hover) and (pointer:fine)').matches
    ) {
      presentation.current.hovered = true
      if (project.presentation === 'media') previews.start(project)
    }
  }
  const actionHref =
    project.action.kind === 'pelagic'
      ? 'https://denoax.github.io/pelagic-jellyfish-webgl/'
      : project.action.href
  const openProject = (event: MouseEvent<HTMLAnchorElement>, media = false) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    if (!active || (media && gesture.current.dragged)) return
    auto.stop()
    onResource(
      event.detail > 0 ? (gesture.current.project ?? project) : project,
    )
  }
  // Eligibility is recomputed after a native scroll settles, including a
  // new card beneath a stationary pointer. Foreground panes suppress only the
  // actually occluded target; normal pane state never disables every decoder.
  useEffect(() => {
    let raf = 0,
      eligible = false
    const sync = () => {
      const target = mediaTarget.current,
        m = presentation.current
      const settled =
        active &&
        !hidden &&
        !document.hidden &&
        target?.dataset.ready === 'true' &&
        performance.now() - scrolledAt.current > 180
      if (Boolean(settled) !== eligible) {
        eligible = Boolean(settled)
        setMediaEligible(eligible)
      }
      const hit = Number.isFinite(pointer.current.x)
        ? document.elementFromPoint(pointer.current.x, pointer.current.y)
        : null
      const exposed = Boolean(hit && target?.contains(hit))
      const focused = Boolean(target?.contains(document.activeElement))
      const hovered = Boolean(
        settled && (exposed || focused || touchPreview.current === project.id),
      )
      m.hovered = hovered
      if (hovered && project.presentation === 'media' && !m.reduced)
        previews.start(project)
      else previews.stopHover()
      raf = requestAnimationFrame(sync)
    }
    sync()
    const visibility = () => {
      if (!document.hidden) return
      // A tab switch retires intent as well as the decoder. Returning cannot
      // start a fresh video from a stale pointer coordinate or touch tap.
      pointer.current = { x: NaN, y: NaN }
      touchPreview.current = null
      presentation.current.hovered = false
      previews.stop()
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [active, hidden, project.id, previews, presentation])
  return (
    <main
      className="selection-hub"
      aria-label="Public projects"
      data-static={staticView}
      data-previewing={playing}
      data-media-kind={project.kind}
      data-theme={project.accent}
      aria-hidden={hidden}
      style={{ '--project-accent': project.accent } as React.CSSProperties}
    >
      <div
        className="menu-scroll"
        ref={scroll}
        onScroll={readScroll}
        onKeyDown={navigate}
        tabIndex={active ? 0 : -1}
        inert={!active}
        aria-label={`${menuViews.length} public projects. Scroll or use arrow keys.`}
      >
        {staticView && project.presentation !== 'media' && (
          <div className="menu-static-geometry" aria-hidden="true" />
        )}
        {project.presentation === 'media' &&
          (staticView || preview.state === 'gif') && (
            <picture
              key={preview.generation}
              className="menu-static-art"
              data-emphasis={presentation.current.hovered}
              aria-hidden="true"
            >
              {preview.state !== 'gif' && (
                <source
                  media="(max-width:719px) and (min-height:601px)"
                  srcSet={project.portrait}
                />
              )}
              <img
                src={
                  preview.projectId === project.id && preview.state === 'gif'
                    ? matchMedia('(max-width:719px) and (min-height:601px)')
                        .matches
                      ? project.portraitGif
                      : project.gif
                    : project.image
                }
                alt=""
              />
            </picture>
          )}
        {project.presentation === 'media' &&
          staticView &&
          playing &&
          previews.video && <StaticPreview video={previews.video} />}
        <div className="menu-stage" ref={stage} inert={!active}>
          <div
            className={`menu-projected-target ${project.presentation === 'media' ? 'menu-preview-target' : ''}`}
            ref={mediaHit}
            hidden={project.presentation !== 'media'}
            data-project-id={project.id}
            data-smoke-target={
              project.presentation === 'media' ? 'media' : undefined
            }
            data-ready={staticView ? 'true' : undefined}
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse') {
                pointer.current = { x: event.clientX, y: event.clientY }
                hover(event.clientX, event.clientY)
              }
            }}
            onPointerLeave={() => {
              pointer.current = { x: NaN, y: NaN }
              touchPreview.current = null
              presentation.current.hovered = false
              previews.stopHover()
            }}
          >
            <a
              href={actionHref}
              className="menu-media-action"
              aria-label={`Preview or open ${project.title}`}
              aria-description="Hover or focus to preview. On touch, tap once to preview and again to open."
              onPointerDown={(event) => {
                gesture.current = {
                  x: event.clientX,
                  y: event.clientY,
                  dragged: false,
                  project,
                }
              }}
              onPointerMove={(event) => {
                if (
                  event.buttons &&
                  Math.hypot(
                    event.clientX - gesture.current.x,
                    event.clientY - gesture.current.y,
                  ) > 8
                )
                  gesture.current.dragged = true
              }}
              onFocus={() => {
                if (!presentation.current.reduced) {
                  presentation.current.hovered = true
                  previews.start(project)
                }
              }}
              onBlur={() => {
                touchPreview.current = null
                presentation.current.hovered = false
                previews.stopHover()
              }}
              onClick={(event) => {
                if (
                  event.button ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return
                if (gesture.current.dragged) {
                  event.preventDefault()
                  return
                }
                if (
                  matchMedia('(pointer:coarse)').matches &&
                  event.detail > 0 &&
                  touchPreview.current !== project.id &&
                  !presentation.current.reduced
                ) {
                  event.preventDefault()
                  touchPreview.current = project.id
                  previews.start(project)
                  return
                }
                openProject(event, true)
              }}
            />
          </div>
          <div className="menu-native-viewport">
            {menuViews
              .filter((view) => view.presentation !== 'media')
              .map((native) => {
                const current = native.id === project.id
                return (
                  <div
                    key={native.id}
                    className={`menu-projected-target menu-native-panel ${current ? 'menu-preview-target' : ''}`}
                    ref={(node) => {
                      if (node)
                        presentation.current.nativeTargets.set(native.id, node)
                      else presentation.current.nativeTargets.delete(native.id)
                    }}
                    data-project-id={native.id}
                    data-current={current}
                    data-smoke-target={current ? 'media' : undefined}
                    inert={!active || hidden || !current}
                    onPointerMove={(event) => {
                      if (current && event.pointerType === 'mouse') {
                        pointer.current = { x: event.clientX, y: event.clientY }
                        hover(event.clientX, event.clientY)
                      }
                    }}
                    onPointerLeave={() => {
                      pointer.current = { x: NaN, y: NaN }
                      presentation.current.hovered = false
                    }}
                  >
                    {native.presentation === 'gravity' ? (
                      <PortfolioGravity
                        maxGlyphs={glyphBudget}
                        deviceTilt={false}
                        active={current && mediaEligible}
                        reduced={presentation.current.reduced}
                      >
                        <div
                          className="portfolio-gravity-cue"
                          data-glass-substrate
                        >
                          <p>This is my Portfolio</p>
                          <p>click anywhere in this box</p>
                        </div>
                      </PortfolioGravity>
                    ) : (
                      <ProfileActivity
                        active={current && mediaEligible}
                        reduced={presentation.current.reduced}
                        onProfile={(event) => {
                          if (
                            event.button ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return
                          event.preventDefault()
                          onResource(native)
                        }}
                      />
                    )}
                  </div>
                )
              })}
          </div>
          <div className="menu-project">
            <h1
              data-glass-substrate
              className={project.titleLines.length > 1 ? 'menu-title--two' : ''}
            >
              {project.titleLines.map((line, index) => (
                <span key={line}>
                  {index > 0 && <br />}
                  {line}
                </span>
              ))}
            </h1>
            <p data-glass-substrate className="menu-description">
              {project.description}
            </p>
            <div className="menu-actions">
              <a
                ref={(element) => {
                  actionRef.current = element
                }}
                className="ui-action ui-primary"
                data-smoke-target="resource"
                data-project-id={project.id}
                href={actionHref}
                aria-disabled={aligning || undefined}
                onPointerDown={(event) => {
                  gesture.current = {
                    x: event.clientX,
                    y: event.clientY,
                    dragged: false,
                    project,
                  }
                }}
                onClick={openProject}
              >
                {project.action.label}
              </a>
              <button
                type="button"
                className="ui-action ui-circle"
                data-smoke-target="help"
                data-project-id={project.id}
                aria-label={`About ${project.title}`}
                aria-haspopup="dialog"
                aria-expanded={helpOpen}
                onClick={(event) => onProjectHelp(project, event.currentTarget)}
              >
                <span aria-hidden="true">?</span>
              </button>
            </div>
            {preview.projectId === project.id && preview.state === 'error' && (
              <p className="preview-error" role="status">
                Preview unavailable. Project link remains available.
              </p>
            )}
          </div>
          {dockSlot &&
            !hidden &&
            createPortal(
              <div className="menu-auto">
                <AutoScrollControl
                  running={auto.mode === 'running'}
                  suspended={
                    auto.mode === 'suspended' || auto.mode === 'stopped'
                  }
                  speed={speed}
                  reduced={presentation.current.reduced}
                  onSpeed={onSpeed}
                  onCommit={() => onCue('speed')}
                  onToggle={() => {
                    onCue('auto')
                    auto.toggle()
                  }}
                />
              </div>,
              dockSlot,
            )}
        </div>
        {menuViews.map((item) => (
          <section
            className="menu-section"
            id={`project-${item.id}`}
            key={item.id}
            aria-label={item.title}
          />
        ))}
      </div>
      {createPortal(
        <dialog
          id="projects-index"
          ref={indexDialog}
          className="projects-index glass-window"
          data-glass-lens="window"
          aria-label="Projects index"
          onCancel={(event) => {
            event.preventDefault()
            pendingSelection.current = null
            selectionSequence.current++
            dismissIndex()
          }}
        >
          <div className="index-heading">
            <h2>Projects</h2>
            <button
              type="button"
              className="settings-close"
              aria-label="Close projects index"
              onClick={() => {
                pendingSelection.current = null
                selectionSequence.current++
                dismissIndex()
              }}
            >
              <CloseIcon />
            </button>
          </div>
          {menuViews.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-current={view === index ? 'true' : undefined}
              onClick={() => {
                pendingSelection.current = {
                  id: item.id,
                  token: ++selectionSequence.current,
                  fromIntro: hidden,
                }
                dismissIndex()
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item.title}
              <b aria-hidden="true">↗</b>
            </button>
          ))}
        </dialog>,
        document.body,
      )}
      {notice && (
        <p className="hub-notice" role="status">
          {notice}
        </p>
      )}
    </main>
  )
}

// The same authoritative element is moved into the static surface: no second
// decoder, duplicated playback state or hidden auto-playing clone.
function StaticPreview({ video }: { video: HTMLVideoElement }) {
  const slot = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const container = slot.current!
    video.classList.add('static-preview-video')
    container.appendChild(video)
    return () => {
      video.classList.remove('static-preview-video')
      if (video.parentElement === container) document.body.appendChild(video)
    }
  }, [video])
  return <div ref={slot} className="menu-static-preview" aria-hidden="true" />
}
