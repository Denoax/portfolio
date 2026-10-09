import type { Project } from '../content/projects'

export type PreviewState =
  | 'poster'
  | 'preparing'
  | 'playing'
  | 'paused'
  | 'gif'
  | 'error'
export interface PreviewSnapshot {
  projectId: string | null
  state: PreviewState
  generation: number
  firstFrameMs: number | null
}
interface MediaOwner {
  generation: number
  project: Project
  video: HTMLVideoElement
  frame: number | null
  timeout: ReturnType<typeof setTimeout> | null
  started: number
  decoded: () => void
  fail: () => void
}

// One owner can hold one decoder. Retired callbacks close only their own
// element; they cannot start departed A or pause a newly acquired B.
export class PreviewPlayback {
  private sequence = 0
  private allowed = true
  private canStart = true
  private intent: 'hover' | 'explicit' | null = null
  private paused = false
  private owner: MediaOwner | null = null
  private snapshot: PreviewSnapshot = {
    projectId: null,
    state: 'poster',
    generation: 0,
    firstFrameMs: null,
  }
  private listeners = new Set<() => void>()
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  get explicitlyStarted() {
    return this.intent === 'explicit'
  }
  get video() {
    return ['playing', 'paused'].includes(this.snapshot.state)
      ? (this.owner?.video ?? null)
      : null
  }
  private publish(
    state: PreviewState,
    projectId: string | null,
    firstFrameMs: number | null = null,
  ) {
    this.snapshot = {
      state,
      projectId,
      generation: this.sequence,
      firstFrameMs,
    }
    this.listeners.forEach((listener) => listener())
  }
  setPolicy(canStart: boolean, canContinue: boolean) {
    this.canStart = canStart
    this.allowed = canContinue
    if (!canContinue || (!canStart && this.intent === 'hover')) this.stop()
  }
  stopHover() {
    if (this.intent === 'hover') this.stop()
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    const owner = this.owner
    if (!owner) return
    if (paused) {
      owner.video.pause()
      if (owner.timeout) clearTimeout(owner.timeout)
      owner.timeout = null
      if (this.snapshot.state === 'playing')
        this.publish('paused', owner.project.id, this.snapshot.firstFrameMs)
    } else if (this.allowed && !document.hidden) {
      if (owner.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
        owner.timeout = setTimeout(owner.fail, 8000)
      void owner.video.play().then(() => {
        if (this.owner !== owner || this.paused || !this.allowed) return
        if (owner.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
          owner.decoded()
        else
          owner.video.addEventListener('loadeddata', owner.decoded, {
            once: true,
          })
      }, owner.fail)
    }
  }
  stop() {
    this.sequence++
    this.intent = null
    this.paused = false
    const owner = this.owner
    this.owner = null
    if (owner) {
      if (owner.timeout) clearTimeout(owner.timeout)
      if (owner.frame !== null)
        owner.video.cancelVideoFrameCallback?.(owner.frame)
      owner.video.onerror = null
      owner.video.removeEventListener('loadeddata', owner.decoded)
      owner.video.pause()
      owner.video.removeAttribute('src')
      owner.video.load()
      owner.video.remove()
    }
    if (this.snapshot.state !== 'poster') this.publish('poster', null)
  }
  start(project: Project, intent: 'hover' | 'explicit' = 'hover') {
    if (!this.canStart || !this.allowed || this.paused || document.hidden)
      return
    if (
      this.snapshot.projectId === project.id &&
      ['preparing', 'playing', 'gif'].includes(this.snapshot.state)
    ) {
      if (intent === 'explicit') this.intent = intent
      return
    }
    this.stop()
    this.intent = intent
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.preload = 'auto'
    video.className = 'owned-preview-decoder'
    video.setAttribute('aria-hidden', 'true')
    const portrait = matchMedia(
      '(max-width:719px) and (min-height:601px)',
    ).matches
    const source = video.canPlayType('video/webm; codecs="vp9"')
      ? portrait
        ? project.portraitVideo
        : project.video
      : video.canPlayType('video/mp4; codecs="avc1.64001F"')
        ? portrait
          ? project.portraitMp4
          : project.mp4
        : null
    if (!source) {
      this.publish('gif', project.id)
      return
    }
    const owner: MediaOwner = {
      generation: ++this.sequence,
      project,
      video,
      frame: null,
      timeout: null,
      started: performance.now(),
      decoded: () => {},
      fail: () => {},
    }
    this.owner = owner
    const current = () =>
      this.owner === owner &&
      this.sequence === owner.generation &&
      this.allowed &&
      !document.hidden
    const fail = () => {
      if (!current()) return
      this.stop()
      this.publish('error', project.id)
    }
    video.onerror = fail
    video.src = source
    document.body.appendChild(video)
    owner.timeout = setTimeout(fail, 8000)
    const decoded = () => {
      if (!current() || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
        return
      if (owner.timeout) clearTimeout(owner.timeout)
      owner.timeout = null
      this.publish(
        this.paused ? 'paused' : 'playing',
        project.id,
        this.snapshot.firstFrameMs ?? performance.now() - owner.started,
      )
    }
    owner.decoded = decoded
    owner.fail = fail
    // play() is called directly from the input event and its rejection is real.
    // A poster stays visible until a current decoded frame is available.
    void video.play().then(() => {
      if (!current()) return
      if (this.paused) {
        video.pause()
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) decoded()
        else video.addEventListener('loadeddata', decoded, { once: true })
        return
      }
      if (video.requestVideoFrameCallback)
        owner.frame = video.requestVideoFrameCallback(decoded)
      else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) decoded()
      else video.addEventListener('loadeddata', decoded, { once: true })
    }, fail)
    this.publish('preparing', project.id)
  }
  dispose() {
    this.stop()
    this.listeners.clear()
  }
}
