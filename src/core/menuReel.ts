import { clamp } from './math'
import { createIntroRipples, type IntroRipples } from './introRipples'
import { projects } from '../content/projects'

export const menuViews = projects

export const REEL_RADIUS = 12.5
export const REEL_STEP = 1.9 / REEL_RADIUS

export function scrollProgress(
  top: number,
  height: number,
  clientHeight: number,
) {
  const span = height - clientHeight
  return span > 0 && Number.isFinite(top) ? clamp(top / span) : 0
}
export function activeMenuView(progress: number, count = menuViews.length) {
  return Math.round(
    (Number.isFinite(progress) ? clamp(progress) : 0) * Math.max(0, count - 1),
  )
}
export function reelPose(
  index: number,
  progress: number,
  count = menuViews.length,
) {
  const angle =
    (index -
      (Number.isFinite(progress) ? clamp(progress) : 0) *
        Math.max(0, count - 1)) *
    REEL_STEP
  return {
    angle,
    y: -REEL_RADIUS * Math.sin(angle),
    z: REEL_RADIUS * (Math.cos(angle) - 1),
  }
}
// Native menu scroll owns target. The menu scene alone writes its smoothed pose;
// neither value ever enters the protected world coordinator.
export interface MenuPresentation {
  hovered: boolean
  clock: number
  target: number
  rendered: number
  saved: number
  selectedId: string
  settledId: string | null
  savedProjectId: string
  savedOffset: number
  paused: boolean
  decorativeRunning: boolean
  reduced: boolean
  mediaTarget: HTMLElement | null
  nativeTargets: Map<string, HTMLElement>
  scrollElement: HTMLElement | null
  textTargets: Map<string, HTMLElement>
  selectProject: ((id: string, silent?: boolean) => void) | null
  scrollReelBy: ((delta: number) => void) | null
  intro: {
    zoom: import('./introZoom').IntroZoom
    zoomDelta: number
    zoomReset: boolean
    zoomVelocity: number
    resetActive: boolean
    resetDistance: number
    hint: HTMLElement | null
    active: boolean
    paused: boolean
    inputBlocked: boolean
    cueFontsReady: boolean
    cueEpoch: number | null
    elapsed: number
    completed: boolean
    exiting: boolean
    exitProgress: number
    holding: boolean
    ripples: IntroRipples
    finish: (() => void) | null
  }
}
export function restoredProgress(
  id: string,
  offset: number,
  ids: readonly string[],
) {
  if (ids.length < 2) return 0
  const index = ids.indexOf(id)
  return index < 0
    ? 0
    : clamp(
        (index + Math.max(-0.49, Math.min(0.49, offset))) / (ids.length - 1),
      )
}
export function createMenuPresentation(): MenuPresentation {
  let id = projects[0]?.id ?? '',
    offset = 0
  try {
    const saved = JSON.parse(
      sessionStorage.getItem('portfolio:menu:v11') ?? 'null',
    )
    if (
      saved &&
      projects.some((p) => p.id === saved.id) &&
      Number.isFinite(saved.offset)
    ) {
      id = saved.id
      offset = Math.max(-0.49, Math.min(0.49, saved.offset))
    }
  } catch {
    /* Persistence is optional. */
  }
  const progress = restoredProgress(
    id,
    offset,
    projects.map((p) => p.id),
  )
  return {
    hovered: false,
    clock: 0,
    target: progress,
    rendered: progress,
    saved: progress,
    selectedId: id,
    settledId: null,
    savedProjectId: id,
    savedOffset: offset,
    paused: false,
    decorativeRunning: true,
    reduced: false,
    mediaTarget: null,
    nativeTargets: new Map(),
    scrollElement: null,
    textTargets: new Map(),
    selectProject: null,
    scrollReelBy: null,
    intro: {
      zoom: { octave: 0n, phase: 0 },
      zoomDelta: 0,
      zoomReset: false,
      zoomVelocity: 0,
      resetActive: false,
      resetDistance: 0,
      hint: null,
      active: false,
      paused: false,
      inputBlocked: false,
      cueFontsReady: false,
      cueEpoch: null,
      elapsed: 0,
      completed: false,
      exiting: false,
      exitProgress: 0,
      holding: false,
      ripples: createIntroRipples(),
      finish: null,
    },
  }
}
