import { GlobalProximityRail, type RailLocation } from './GlobalProximityRail'
import { useSiteTheme } from '../core/theme'
import { ThemeToggle } from './ThemeToggle'
import { GooeyNav } from './GooeyNav'
import { CloseIcon, NavIcon } from './UiIcons'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import { ProjectHelp } from './ProjectHelp'
import type { HelpRequest } from './ProjectHelp'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ExperienceSettings } from './ExperienceSettings'
import {
  loadSettings,
  saveSettings,
  validateSettings,
} from '../core/experienceSettings'
import type { ExperienceSettings as Settings } from '../core/experienceSettings'
import { lowerQuality, selectQuality } from '../core/quality'
import { narrative } from '../core/narrative'
import { hubReducer, parseHubRoute, EARTH_HOLD } from '../core/hubState'
import type { HubState, DestinationIntent } from '../core/hubState'
import { useWorldCoordinator } from '../hooks/useWorldCoordinator'
import { ExperienceCanvas } from '../experience/ExperienceCanvas'
import { PelagicCaseStudy } from './PelagicCaseStudy'
import { pelagic } from '../content/destinations'
import { contact } from '../content/portfolio'
import '../styles/selection-hub.css'
import { InfoPanel } from './InfoPanel'
import { Credits } from './Credits'
import { SelectionHub } from './SelectionHub'
import { PreviewPlayback } from '../core/previewPlayback'
import { createMenuPresentation } from '../core/menuReel'
import { projects } from '../content/projects'
import type { Project } from '../content/projects'
import { IdentityIntro } from './IdentityIntro'
import { useIntentAudio } from '../hooks/useIntentAudio'
import { InterfaceAudio } from '../audio/InterfaceAudio'
import type { SoundCue } from '../audio/InterfaceAudio'
import { PelagicHandoffGate, PELAGIC_LIVE_URL } from '../core/pelagicHandoff'
import { AutoScrollControl } from './AutoScrollControl'
import { ResourceTransition } from './ResourceTransition'
import type { ResourceRequest } from './ResourceTransition'

function navigate(url: string, replace = false, state: unknown = null) {
  history[replace ? 'replaceState' : 'pushState'](state, '', url)
  window.dispatchEvent(new Event('portfolio:navigate'))
}
function introSeen() {
  try {
    return sessionStorage.getItem('portfolio:intro:v11') === 'seen'
  } catch {
    return false
  }
}
function markIntro() {
  try {
    sessionStorage.setItem('portfolio:intro:v11', 'seen')
  } catch {
    /* Session memory in Home still prevents a return replay. */
  }
}
function initialState(route: string): HubState {
  const url = new URL(route, location.origin),
    parsed = parseHubRoute(url.pathname, url.hash)
  return {
    surface:
      parsed === 'earth' || parsed === 'pelagic'
        ? 'loading'
        : parsed === 'hub' && !introSeen() && !url.hash
          ? 'intro'
          : 'hub',
    request: 1,
    intent:
      parsed === 'pelagic'
        ? 'pelagic'
        : parsed === 'earth'
          ? 'earth'
          : 'launch',
    notice:
      parsed === 'removed'
        ? 'This project is not in the current selection.'
        : '',
  }
}
const worldRailLocations: RailLocation[] = [
  {
    id: 'space',
    label: 'Star entry',
    kind: 'title',
    hue: '#89cada',
    progress: 0,
  },
  {
    id: 'light',
    label: 'Light passage',
    kind: 'section',
    hue: '#89cada',
    progress: 0.38,
  },
  {
    id: 'earth',
    label: 'Earth',
    kind: 'section',
    hue: '#89cada',
    progress: EARTH_HOLD,
  },
  {
    id: 'clouds',
    label: 'Cloud passage',
    kind: 'section',
    hue: '#89cada',
    progress: 0.76,
  },
  {
    id: 'ocean',
    label: 'Ocean approach',
    kind: 'section',
    hue: '#89cada',
    progress: 0.9,
  },
]

function Home({ route }: { route: string }) {
  const [introExiting, setIntroExiting] = useState(false)
  const [hub, dispatch] = useReducer(hubReducer, route, initialState)
  const hubRef = useRef(hub)
  hubRef.current = hub
  const [settings, setSettings] = useState(loadSettings),
    [settingsOpen, setSettingsOpen] = useState(false),
    [infoOpen, setInfoOpen] = useState(false)
  const theme = useSiteTheme(settings.theme, settings.motion === 'less')
  const [dockSlot, setDockSlot] = useState<HTMLDivElement | null>(null)
  const [help, setHelp] = useState<HelpRequest | null>(null)
  const presentation = useRef(createMenuPresentation())
  const [resource, setResource] = useState<ResourceRequest | null>(null)
  const resourceRef = useRef(resource)
  resourceRef.current = resource
  const resourceSequence = useRef(0)
  const audio = useRef<InterfaceAudio | null>(null)
  const resourceOrigin = useRef<HTMLElement | null>(null)
  const handoffGate = useRef(new PelagicHandoffGate())
  const departing = useRef(false)
  const [outbound, setOutbound] = useState(false)
  useEffect(() => {
    const engine = new InterfaceAudio()
    audio.current = engine
    engine.configure(
      settings.soundVolume > 0,
      settings.soundVolume / 100,
      settings.ambienceVolume / 100,
    )
    engine.prepare()
    const retire = () => engine.retireAll()
    const hidden = () => {
      engine.visibility()
    }
    window.addEventListener('pagehide', retire)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      engine.dispose()
      audio.current = null
      window.removeEventListener('pagehide', retire)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])
  const cue = (name: SoundCue) => {
    audio.current?.unlock()
    audio.current?.play(name)
  }
  useIntentAudio(
    () => audio.current?.play('hover'),
    () => audio.current?.retireHover(),
  )
  useEffect(() => {
    audio.current?.setScene(
      hub.surface === 'intro'
        ? 'intro'
        : resource || hub.surface === 'loading'
          ? 'loading'
          : hub.surface === 'hub' || hub.surface === 'returning'
            ? 'selection'
            : 'world',
    )
  }, [hub.surface, resource?.token])
  const [indexRequest, setIndexRequest] = useState(0)
  const [dismissIndexRequest, setDismissIndexRequest] = useState(0)
  const [introEntryRequest, setIntroEntryRequest] = useState(0)
  const queuedIntroProject = useRef<string | null>(null)
  useEffect(() => {
    if (hub.surface !== 'hub' || !queuedIntroProject.current) return
    const id = queuedIntroProject.current
    queuedIntroProject.current = null
    presentation.current.selectProject?.(id, true)
  }, [hub.surface])
  const [projectsOpen, setProjectsOpen] = useState(false)
  const previews = useMemo(() => new PreviewPlayback(), [])
  const [utilitiesOpen, setUtilitiesOpen] = useState(false)
  const utilityPanel = useRef<HTMLDivElement>(null)
  const closeUtilities = useGlassDialogMotion(utilityPanel, utilitiesOpen, () =>
    setUtilitiesOpen(false),
  )
  const returnStarted = useRef(0)
  const settingsButton = useRef<HTMLButtonElement>(null),
    infoButton = useRef<HTMLButtonElement>(null),
    enterButton = useRef<HTMLElement | null>(null)
  const [osReduced, setOsReduced] = useState(
    () => matchMedia('(prefers-reduced-motion:reduce)').matches,
  )
  const reduced = osReduced || settings.motion === 'less'
  const [quality, setQuality] = useState(() =>
      selectQuality(settings.graphics),
    ),
    [adjusted, setAdjusted] = useState(false),
    [storageUnavailable, setStorageUnavailable] = useState(false)
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [hubReady, setHubReady] = useState(false),
    [assets, setAssets] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [preparedFrame, setPreparedFrame] = useState(false)
  const preparedFrameRef = useRef(false)
  const [destinationMounted, setDestinationMounted] = useState(
    () => !['hub', 'intro'].includes(hub.surface),
  )
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slow, setSlow] = useState(false),
    [cover, setCover] = useState(false),
    [coveredHub, setCoveredHub] = useState(false)
  const world =
    ['loading', 'launch', 'world', 'returning'].includes(hub.surface) &&
    !coveredHub &&
    destinationMounted
  const closeOrdinaryPanes = (dismissIndex = true) => {
    setInfoOpen(false)
    setSettingsOpen(false)
    setHelp(null)
    setUtilitiesOpen(false)
    if (dismissIndex) setDismissIndexRequest((value) => value + 1)
  }
  const panelOpen = settingsOpen || infoOpen || projectsOpen || Boolean(help)
  presentation.current.paused = hub.surface !== 'hub' || Boolean(resource)
  presentation.current.reduced = reduced
  presentation.current.intro.active = hub.surface === 'intro'
  presentation.current.decorativeRunning =
    ['intro', 'hub'].includes(hub.surface) && !reduced && !resource
  presentation.current.intro.paused = reduced
  presentation.current.intro.inputBlocked = Boolean(resource)
  const preferences = useRef({ settings, panelOpen, theme })
  preferences.current = {
    settings,
    theme,
    panelOpen:
      Boolean(resource) ||
      hub.surface === 'loading' ||
      hub.surface === 'launch' ||
      hub.surface === 'returning' ||
      hub.surface === 'intro',
  }
  const onArrived = useCallback(() => dispatch({ type: 'arrived' }), [])
  const controller = useWorldCoordinator({
    enabled: world,
    surface: hub.surface,
    intent: hub.intent,
    request: hub.request,
    reduced: reduced || failed,
    paused: Boolean(resource),
    onArrived,
    pace: settings.scrollPace,
    staticView: failed || reduced,
    speed: settings.autoScrollSpeed,
  })
  const controllerRef = useRef(controller)
  controllerRef.current = controller
  const routeRef = useRef(route),
    previousSurface = useRef(hub.surface)
  const onReady = useCallback(() => setReady(true), []),
    onHubReady = useCallback(() => setHubReady(true), [])
  const onFailure = useCallback(() => setFailed(true), [])
  const onOverload = useCallback(() => {
    setQuality(lowerQuality)
    setAdjusted(true)
  }, [])
  const updateSettings = (value: Settings) => {
    const next = validateSettings(value)
    if (next.graphics !== settings.graphics) {
      setQuality(selectQuality(next.graphics))
      setAdjusted(false)
    }
    const changed = (Object.keys(next) as (keyof Settings)[]).filter(
      (key) => next[key] !== settings[key],
    )
    if (
      changed.some(
        (key) =>
          ![
            'autoScrollSpeed',
            'soundVolume',
            'ambienceVolume',
            'theme',
          ].includes(key),
      )
    )
      controllerRef.current.pause()
    audio.current?.configure(
      next.soundVolume > 0,
      next.soundVolume / 100,
      next.ambienceVolume / 100,
    )
    if (changed.includes('soundVolume') || changed.includes('ambienceVolume'))
      audio.current?.unlock()
    setSettings(next)
    setStorageUnavailable(!saveSettings(next))
  }
  const setAutoSpeed = (value: number) =>
    updateSettings({ ...settings, autoScrollSpeed: value })
  const skipIntro = useCallback(() => {
    markIntro()
    presentation.current.intro.completed = true
    presentation.current.intro.exiting = false
    setIntroExiting(false)
    dispatch({ type: 'introDone' })
    requestAnimationFrame(() =>
      enterButton.current?.focus({ preventScroll: true }),
    )
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion:reduce)'),
      change = () => setOsReduced(media.matches)
    media.addEventListener('change', change)
    history.replaceState(
      { ...history.state, portfolio: true },
      '',
      location.href,
    )
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    narrative.fallback = failed
    return () => {
      narrative.fallback = false
    }
  }, [failed])
  useEffect(() => {
    const policy = () => {
      const allowed =
        hubRef.current.surface === 'hub' &&
        !resourceRef.current &&
        !reduced &&
        !document.hidden
      previews.setPolicy(allowed, allowed)
    }
    policy()
    document.addEventListener('visibilitychange', policy)
    return () => document.removeEventListener('visibilitychange', policy)
  }, [
    previews,
    reduced,
    panelOpen,
    hub.surface,
    settingsOpen,
    infoOpen,
    projectsOpen,
    help,
    utilitiesOpen,
    resource,
  ])
  useEffect(() => () => previews.dispose(), [previews])
  useEffect(() => {
    if (route === routeRef.current) return
    routeRef.current = route
    handoffGate.current.disarm()
    departing.current = false
    setOutbound(false)
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    setCover(false)
    const url = new URL(route, location.origin),
      parsed = parseHubRoute(url.pathname, url.hash)
    if (parsed === 'hub' || parsed === 'removed') {
      controllerRef.current.pause()
      dispatch({
        type: 'hub',
        notice:
          parsed === 'removed'
            ? 'This project is not in the current selection.'
            : '',
      })
      setReady(false)
      setCoveredHub(false)
      setCover(false)
      window.scrollTo(0, 0)
    } else if (
      hubRef.current.surface === 'hub' ||
      hubRef.current.surface === 'intro' ||
      hubRef.current.surface === 'loading'
    ) {
      setDestinationMounted(true)
      dispatch({ type: 'hub' })
      dispatch({ type: 'enter', intent: parsed })
      setReady(false)
      setAssets('loading')
    } else {
      controllerRef.current.seek(parsed === 'pelagic' ? 1 : EARTH_HOLD)
    }
  }, [route])
  useEffect(() => {
    if (hub.surface !== 'loading') return
    if (!destinationMounted) {
      const token = hub.request
      const alignment = setTimeout(
        () => {
          if (
            hubRef.current.request === token &&
            hubRef.current.surface === 'loading'
          )
            setDestinationMounted(true)
        },
        reduced ? 0 : 700,
      )
      return () => clearTimeout(alignment)
    }
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), 15000)
    if (
      ((ready && assets !== 'loading' && preparedFrame) || reduced || failed) &&
      (!resource || resource.animationDone)
    )
      dispatch({ type: 'ready', request: hub.request })
    return () => clearTimeout(timer)
  }, [
    hub.surface,
    hub.request,
    ready,
    assets,
    reduced,
    failed,
    destinationMounted,
    preparedFrame,
    resource,
  ])
  useEffect(() => {
    if (hub.surface === 'hub' && previousSurface.current !== 'hub') {
      window.scrollTo(0, 0)
      requestAnimationFrame(() =>
        (resourceOrigin.current?.isConnected
          ? resourceOrigin.current
          : enterButton.current
        )?.focus({ preventScroll: true }),
      )
    }
    if (
      previousSurface.current === 'loading' &&
      ['launch', 'world'].includes(hub.surface)
    )
      setCover(false)
    previousSurface.current = hub.surface
    if (
      ['launch', 'world'].includes(hub.surface) &&
      resourceRef.current?.project.action.kind === 'pelagic'
    ) {
      const next = { ...resourceRef.current, revealing: true }
      resourceRef.current = next
      setResource(next)
    }
    if (hub.surface === 'world')
      document
        .querySelector<HTMLElement>('#world-title')
        ?.focus({ preventScroll: true })
  }, [hub.surface])
  // The world retires under the cover; reveal only after the restored menu
  // has compiled its own resources. No reset is applied to the world pipeline.
  useEffect(() => {
    if (hub.surface !== 'returning') return
    returnStarted.current = performance.now()
    controllerRef.current.pause()
    setHubReady(false)
    setCover(true)
    const switchTimer = setTimeout(
      () => {
        setCoveredHub(true)
        window.scrollTo(0, 0)
      },
      reduced ? 0 : 340,
    )
    return () => clearTimeout(switchTimer)
  }, [hub.surface, hub.request, reduced])
  useEffect(() => {
    if (
      hub.surface !== 'returning' ||
      !coveredHub ||
      (!hubReady && !failed && !reduced)
    )
      return
    const request = hub.request
    const elapsed = performance.now() - returnStarted.current
    const revealDelay = reduced ? 0 : Math.max(0, 430 - elapsed)
    const revealTimer = setTimeout(() => setCover(false), revealDelay)
    const finishTimer = setTimeout(
      () => {
        dispatch({ type: 'returned', request })
        setCoveredHub(false)
        setReady(false)
      },
      revealDelay + (reduced ? 50 : 330),
    )
    return () => {
      clearTimeout(revealTimer)
      clearTimeout(finishTimer)
    }
  }, [hub.surface, hub.request, coveredHub, hubReady, failed, reduced])
  const enter = (intent: DestinationIntent = 'launch') => {
    if (!['hub', 'intro'].includes(hubRef.current.surface)) return
    previews.stop()
    markIntro()
    departing.current = false
    setOutbound(false)
    presentation.current.saved = presentation.current.target
    presentation.current.paused = true
    setUtilitiesOpen(false)
    setCover(!resourceRef.current)
    setDestinationMounted(false)
    preparedFrameRef.current = false
    setPreparedFrame(false)
    setHubReady(false)
    setReady(false)
    setAssets('loading')
    setSlow(false)
    // Dispatch intent before history notification; repeated Enter is gated by
    // reducer and immediate ref, even before React commits a disabled button.
    hubRef.current = hubReducer(hubRef.current, { type: 'enter', intent })
    dispatch({ type: 'enter', intent })
    handoffGate.current.arm(hubRef.current.request)
    const url = intent === 'pelagic' ? '/#pelagic' : '/#earth'
    routeRef.current = url
    navigate(url, false, { portfolio: true, fromHub: true })
  }
  const openResource = (project: Project) => {
    if (resourceRef.current || hubRef.current.surface !== 'hub') return
    closeOrdinaryPanes()
    previews.stop()
    const request = {
      token: ++resourceSequence.current,
      project,
      animationDone: false,
    }
    resourceRef.current = request
    audio.current?.unlock()
    audio.current?.begin(request.token)
    resourceOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : enterButton.current
    setResource(request)
    try {
      sessionStorage.setItem(
        'portfolio:menu:v11',
        JSON.stringify({
          id: presentation.current.savedProjectId,
          offset: presentation.current.savedOffset,
        }),
      )
    } catch {
      /* Navigation remains usable without storage. */
    }
    if (project.action.kind === 'pelagic') enter()
  }
  const completeResource = (token: number) => {
    const current = resourceRef.current
    if (!current || current.token !== token) return
    if (current.project.action.kind === 'link')
      location.assign(current.project.action.href)
    else {
      const next = { ...current, animationDone: true }
      resourceRef.current = next
      setResource(next)
    }
  }
  useEffect(() => {
    const restore = (event?: PageTransitionEvent) => {
      handoffGate.current.disarm()
      audio.current?.retireAll()
      if (event && history.state?.returnToMenu) {
        if (jumpTimer.current) clearTimeout(jumpTimer.current)
        departing.current = false
        setOutbound(false)
        controllerRef.current.pause()
        dispatch({ type: 'hub' })
        setCoveredHub(false)
        setCover(false)
        setDestinationMounted(false)
        preparedFrameRef.current = false
        setPreparedFrame(false)
        routeRef.current = '/#worlds'
        window.scrollTo(0, 0)
      }
      resourceRef.current = null
      setResource(null)
      try {
        const saved = history.state?.returnToMenu
          ? history.state.menu
          : JSON.parse(sessionStorage.getItem('portfolio:menu:v11') ?? 'null')
        if (saved && projects.some((p) => p.id === saved.id)) {
          presentation.current.savedProjectId = saved.id
          presentation.current.savedOffset = Number(saved.offset) || 0
        }
      } catch {
        /* Invalid persisted data is ignored. */
      }
    }
    restore()
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])
  const returnToHub = () => {
    handoffGate.current.disarm()
    departing.current = false
    setOutbound(false)
    audio.current?.retireSfx()
    audio.current?.setScene('selection')
    cue('cancel')
    resourceRef.current = null
    setResource(null)
    setUtilitiesOpen(false)
    if (hubRef.current.surface === 'returning') return
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    if (hubRef.current.surface === 'loading') {
      dispatch({ type: 'hub' })
      setReady(false)
      setCover(false)
    } else dispatch({ type: 'return' })
    // Replace the destination entry deliberately. Back remains available to
    // restore the prior app-owned hub; external deep links never leave site.
    routeRef.current = '/#worlds'
    navigate('/#worlds', true, { portfolio: true })
  }
  const departPelagic = () => {
    if (departing.current) return
    departing.current = true
    handoffGate.current.disarm()
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    controllerRef.current.pause()
    previews.stop()
    audio.current?.retireAll()
    resourceRef.current = null
    setResource(null)
    markIntro()
    const menu = {
      id: presentation.current.savedProjectId,
      offset: presentation.current.savedOffset,
    }
    try {
      sessionStorage.setItem('portfolio:menu:v11', JSON.stringify(menu))
    } catch {
      /* History also carries the manual return state. */
    }
    history.replaceState(
      {
        portfolio: true,
        returnToMenu: true,
        consumedHandoff: hubRef.current.request,
        menu,
      },
      '',
      '/#worlds',
    )
    setOutbound(true)
    setCover(true)
    jumpTimer.current = setTimeout(
      () => {
        if (departing.current && !document.hidden)
          location.assign(PELAGIC_LIVE_URL)
      },
      reduced ? 0 : 220,
    )
  }
  const onWorldFrame = () => {
    if (
      hubRef.current.surface === 'loading' &&
      ready &&
      assets !== 'loading' &&
      !preparedFrameRef.current &&
      !document.hidden
    ) {
      preparedFrameRef.current = true
      setPreparedFrame(true)
    }
    const token = handoffGate.current.observe(
      narrative.state,
      narrative.frame,
      world &&
        ready &&
        !failed &&
        !reduced &&
        !cover &&
        ['launch', 'world'].includes(hubRef.current.surface),
    )
    if (token !== null && token === hubRef.current.request) {
      window.dispatchEvent(
        new CustomEvent('portfolio:pelagic-handoff', {
          detail: {
            token,
            progress: narrative.state,
            depth: narrative.frame.depth,
            submerged: narrative.frame.submerged,
            observedAt: performance.now(),
          },
        }),
      )
      departPelagic()
    }
  }
  const openPelagic = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return
    event.preventDefault()
    departPelagic()
  }
  const replayIntro = () => {
    if (hubRef.current.surface !== 'hub' || resourceRef.current) return
    presentation.current.stopAuto?.()
    closeOrdinaryPanes()
    previews.stop()
    const intro = presentation.current.intro
    Object.assign(intro, {
      zoomReset: false,
      resetActive: false,
      zoomVelocity: 0,
      zoomDelta: 0,
      elapsed: 0,
      cueEpoch: null,
      completed: false,
      exiting: false,
      exitProgress: 0,
      holding: false,
      pulseAt: -20,
    })
    setIntroEntryRequest(0)
    dispatch({ type: 'replay' })
  }
  const jumpTo = (progress: number) => {
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    cue('activate')
    setCover(true)
    controller.pause()
    const request = hub.request
    jumpTimer.current = setTimeout(
      () => {
        if (
          hubRef.current.request !== request ||
          !['launch', 'world'].includes(hubRef.current.surface)
        )
          return
        controllerRef.current.seek(progress)
        // Keep the covered pose through the first destination render.
        jumpTimer.current = setTimeout(
          () => {
            if (
              hubRef.current.request === request &&
              ['launch', 'world'].includes(hubRef.current.surface)
            )
              setCover(false)
          },
          reduced ? 0 : 60,
        )
      },
      reduced ? 0 : 340,
    )
  }
  useEffect(() => {
    const retire = (event: Event) => {
      if (event.type === 'pagehide') handoffGate.current.disarm()
      if (document.hidden) handoffGate.current.suspend()
      if (departing.current && document.hidden) {
        handoffGate.current.disarm()
        if (jumpTimer.current) clearTimeout(jumpTimer.current)
        departing.current = false
        setOutbound(false)
        setCover(false)
        dispatch({ type: 'hub' })
      }
    }
    document.addEventListener('visibilitychange', retire)
    window.addEventListener('pagehide', retire)
    return () => {
      document.removeEventListener('visibilitychange', retire)
      window.removeEventListener('pagehide', retire)
    }
  }, [])
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current)
    },
    [],
  )
  const staticWorld = world && (failed || reduced)
  const showHub = !world
  return (
    <div
      className="site selection-site"
      data-surface={hub.surface}
      data-resource={Boolean(resource)}
      data-outbound={outbound}
      data-reduced={reduced}
      data-static={failed || reduced}
      style={{ '--scroll-pace': settings.scrollPace / 100 } as CSSProperties}
    >
      <a className="skip-link" href={pelagic.caseStudy}>
        Skip to Pelagic case study
      </a>
      {!failed && !reduced && (
        <ExperienceCanvas
          preferences={preferences}
          quality={quality}
          onReady={onReady}
          onHubReady={onHubReady}
          world={world}
          presentation={presentation}
          previews={previews}
          onFailure={onFailure}
          onOverload={onOverload}
          visible={world ? ready : hubReady}
          parked={Boolean(
            resource && world && preparedFrame && hub.surface === 'loading',
          )}
          onAssetState={setAssets}
          onWorldFrame={onWorldFrame}
        />
      )}
      {staticWorld && (
        <div className="world-still" aria-hidden="true">
          <picture className="static-earth">
            <source
              media="(max-width:720px)"
              srcSet="/assets/projects/earth-portrait.webp"
            />
            <img src="/assets/projects/earth-desktop.webp" alt="" />
          </picture>
          <picture className="static-pelagic">
            <source
              media="(max-width:720px)"
              srcSet="/assets/projects/pelagic-portrait.webp"
            />
            <img src="/assets/projects/pelagic-ocean.webp" alt="" />
          </picture>
        </div>
      )}
      <header className="hub-header" inert={Boolean(resource)}>
        <button
          type="button"
          className="hub-brand"
          onClick={
            showHub
              ? () => {
                  cue('toggle')
                  closeOrdinaryPanes()
                  setInfoOpen(true)
                }
              : returnToHub
          }
        >
          <img
            src="/assets/profile/profile-v12-48.png"
            srcSet="/assets/profile/profile-v12-48.png 48w, /assets/profile/profile-v12-128.png 128w"
            sizes="(max-width:719px) 32px, 40px"
            width="40"
            height="40"
            alt=""
          />
          <span className="hub-brand-label">Mani Marami Milani</span>
        </button>
        <button
          type="button"
          className="utility-toggle"
          aria-label="Portfolio menu"
          aria-expanded={utilitiesOpen}
          aria-controls="portfolio-utilities"
          onClick={() => {
            cue('toggle')
            if (utilitiesOpen) closeUtilities()
            else setUtilitiesOpen(true)
          }}
        >
          <span aria-hidden="true">
            {utilitiesOpen ? (
              <CloseIcon />
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </span>
        </button>
        <div
          id="portfolio-utilities"
          ref={utilityPanel}
          className={`portfolio-nav-shell ${utilitiesOpen ? 'portfolio-nav-shell--open' : ''}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              closeUtilities()
              document
                .querySelector<HTMLButtonElement>('.utility-toggle')
                ?.focus()
            }
          }}
        >
          {world && hub.surface !== 'loading' && (
            <button
              type="button"
              className="world-return"
              onClick={returnToHub}
            >
              Return to projects
            </button>
          )}
          <GooeyNav
            aria-label="Portfolio navigation"
            reduced={reduced}
            value={
              settingsOpen
                ? world
                  ? 1
                  : 2
                : infoOpen
                  ? world
                    ? 0
                    : 1
                  : projectsOpen || hub.surface === 'hub'
                    ? 0
                    : -1
            }
            items={[
              ...(world
                ? []
                : [
                    {
                      label: 'Projects',
                      id: 'projects-trigger',
                      icon: <NavIcon kind="projects" />,
                      expanded: projectsOpen,
                      controls: 'projects-index',
                    },
                  ]),
              {
                label: 'About me',
                id: 'about-trigger',
                icon: <NavIcon kind="about" />,
                expanded: infoOpen,
                controls: 'info-panel',
                buttonRef: infoButton,
              },
              {
                label: 'Settings',
                id: 'settings-trigger',
                expanded: settingsOpen,
                controls: 'experience-settings',
                buttonRef: settingsButton,
              },
              {
                label: 'Contact',
                icon: <NavIcon kind="contact" />,
                href: `mailto:${contact.email}`,
              },
            ]}
            onChange={(index) => {
              setUtilitiesOpen(false)
              const action = world ? index + 1 : index
              if (action === 3) return
              cue('toggle')
              closeOrdinaryPanes(action !== 0)
              if (action === 0) setIndexRequest((x) => x + 1)
              else if (action === 1) setInfoOpen(true)
              else if (action === 2) setSettingsOpen(true)
            }}
          />
        </div>
      </header>
      {showHub && (
        <SelectionHub
          staticView={failed || reduced || !hubReady}
          notice={hub.notice}
          aligning={hub.surface === 'loading'}
          active={hub.surface === 'hub' && !resource}
          presentation={presentation}
          previews={previews}
          actionRef={enterButton}
          onResource={openResource}
          helpOpen={Boolean(help)}
          onProjectHelp={(project, trigger) => {
            cue('toggle')
            closeOrdinaryPanes()
            setHelp({ project, trigger })
          }}
          indexRequest={indexRequest}
          dismissIndexRequest={dismissIndexRequest}
          hidden={hub.surface === 'intro'}
          onIndexChange={setProjectsOpen}
          onIntroEnter={() => setIntroEntryRequest((value) => value + 1)}
          selectionEpoch={hub.request}
          speed={settings.autoScrollSpeed}
          onSpeed={setAutoSpeed}
          onCue={cue}
          dockSlot={dockSlot}
        />
      )}
      {!introExiting &&
        ['hub', 'launch', 'world', 'loading', 'returning'].includes(
          hub.surface,
        ) && (
          <GlobalProximityRail
            surface={hub.surface}
            presentation={presentation}
            reduced={reduced}
            blocked={
              Boolean(resource) ||
              ['loading', 'launch', 'returning'].includes(hub.surface) ||
              introExiting
            }
            readWorldProgress={() => narrative.state}
            locations={world ? worldRailLocations : undefined}
            onSelect={(id) => {
              if (resourceRef.current || presentation.current.intro.exiting)
                return
              if (world) {
                const points: Record<string, number> = {
                  space: 0,
                  light: 0.38,
                  earth: EARTH_HOLD,
                  clouds: 0.76,
                  ocean: 0.9,
                }
                if (id in points && hubRef.current.surface === 'world')
                  jumpTo(points[id])
              } else if (id === 'intro') {
                if (hubRef.current.surface === 'hub') {
                  cue('activate')
                  replayIntro()
                }
              } else if (hubRef.current.surface === 'intro') {
                queuedIntroProject.current = id
                setIntroEntryRequest((value) => value + 1)
              } else presentation.current.selectProject?.(id)
            }}
          />
        )}
      {['intro', 'hub'].includes(hub.surface) && (
        <div className="portfolio-dock" inert={Boolean(resource)}>
          <ThemeToggle
            theme={theme}
            reduced={reduced}
            onReact={() => cue('buddy')}
            onToggle={() =>
              updateSettings({
                ...settings,
                theme: theme === 'dark' ? 'light' : 'dark',
              })
            }
          />
          <div className="portfolio-speed-slot" ref={setDockSlot} />
        </div>
      )}
      {hub.surface === 'intro' && (
        <IdentityIntro
          presentation={presentation}
          staticView={failed || reduced}
          paused={Boolean(resource)}
          entryRequest={introEntryRequest}
          onDone={skipIntro}
          exiting={introExiting}
          onExitStateChange={setIntroExiting}
          onEntryCancel={() => {
            queuedIntroProject.current = null
          }}
          onActivate={() => {
            closeOrdinaryPanes()
            cue('enter')
          }}
          onInteract={() => audio.current?.unlock()}
          onRipple={() => audio.current?.play('ripple')}
          ready={hubReady || failed || reduced}
        />
      )}
      <ResourceTransition
        presentation={presentation}
        request={resource}
        reduced={failed || reduced}
        onComplete={completeResource}
        onPhase={(token, phase) => {
          if (resourceRef.current?.token !== token) return
          audio.current?.phase(token, phase)
        }}
        onRetire={(token) => audio.current?.retireSfx(token)}
        onCancel={returnToHub}
        onRevealed={(token) => {
          if (resourceRef.current?.token !== token) return
          const resumeLaunch =
            resourceRef.current.project.action.kind === 'pelagic' &&
            hubRef.current.surface === 'launch'
          resourceRef.current = null
          setResource(null)
          // The blocking resource gate pauses travel while preparing. Release
          // that same transaction into the existing authored launch clock.
          if (resumeLaunch) controllerRef.current.resume()
        }}
      />
      {world && (
        <main className="world-scroll" aria-label="Pelagic journey">
          <div className="world-span" data-section />
          <section
            data-world-end
            data-section
            className="world-end"
            aria-label="Pelagic"
          >
            <h1 id="world-title" tabIndex={-1} className="sr-only">
              Pelagic journey
            </h1>
            <div
              className="world-content feature-copy"
              inert
              aria-hidden="true"
            >
              <p className="eyebrow">Creative development · WebGL</p>
              <h2>Pelagic</h2>
              <p className="feature-intro">
                A living ocean.
                <br />
                Anatomy, motion, and light.
              </p>
              <div className="actions">
                <a href={pelagic.caseStudy}>View project ↗</a>
                <a href={pelagic.live} target="_blank" rel="noreferrer">
                  Live experience ↗
                </a>
              </div>
              <p className="project-footnote">
                Original procedural anatomy · running live
              </p>
            </div>
          </section>
        </main>
      )}
      {world && hub.surface !== 'loading' && (
        <>
          <div className="earth-cue" aria-hidden="true" inert>
            <span>Scroll to descend</span>
            {failed || reduced ? (
              <a href={PELAGIC_LIVE_URL} onClick={openPelagic}>
                Open Pelagic ↗
              </a>
            ) : (
              <button
                className="hub-text"
                type="button"
                onClick={() => {
                  cue('auto')
                  controller.tour()
                }}
              >
                Continue descent ↓
              </button>
            )}
          </div>
          <div className="world-controls">
            <span>Pelagic</span>
            <div>
              {hub.surface === 'launch' && (
                <button type="button" onClick={() => jumpTo(EARTH_HOLD)}>
                  Skip travel
                </button>
              )}
              {!reduced && !failed && (
                <AutoScrollControl
                  running={controller.playing}
                  suspended={controller.resumeAvailable}
                  speed={settings.autoScrollSpeed}
                  onSpeed={setAutoSpeed}
                  onCommit={() => cue('speed')}
                  label={
                    controller.resumeAvailable ? 'Resume travel' : 'Auto-scroll'
                  }
                  onToggle={() => {
                    cue('auto')
                    if (controller.playing) controller.pause()
                    else if (
                      hub.surface === 'launch' ||
                      controller.resumeAvailable
                    )
                      controller.resume()
                    else controller.tour()
                  }}
                />
              )}
              <a
                className="hub-text"
                href={PELAGIC_LIVE_URL}
                onClick={openPelagic}
              >
                {failed || reduced ? 'Open Pelagic ↗' : 'Go to Pelagic ↗'}
              </a>
            </div>
          </div>
        </>
      )}
      {hub.surface === 'loading' && world && !resource && (
        <div className="world-loader">
          <div className="world-loading-field" aria-hidden="true" />
          <p className="sr-only" role="status">
            {!ready
              ? 'Preparing graphics'
              : assets === 'loading'
                ? 'Loading Earth detail'
                : 'Ready'}
          </p>
          <div className="loader-actions">
            <button type="button" onClick={returnToHub}>
              Cancel · Return to projects
            </button>
            <a href={pelagic.caseStudy}>View Pelagic ↗</a>
          </div>
          {slow && (
            <>
              <p>Graphics are taking longer than expected.</p>
              <button type="button" onClick={() => setFailed(true)}>
                Use static experience
              </button>
            </>
          )}
        </div>
      )}
      {failed && (
        <p className="hub-degraded" role="status">
          Graphics unavailable. Static Pelagic remains available.{' '}
          <button
            type="button"
            // A rejected lazy module can remain cached for this document.
            // Reload retries essential imports and retires the lost renderer.
            onClick={() => window.location.reload()}
          >
            Retry graphics
          </button>
        </p>
      )}
      {assets === 'failed' && world && !failed && (
        <p className="hub-degraded" role="status">
          Earth detail unavailable; procedural fallback active.
        </p>
      )}
      {hub.surface === 'launch' && (
        <div className="launch-veil" aria-hidden="true" />
      )}
      <div
        className={`journey-cover ${cover ? 'journey-cover--on' : ''}`}
        aria-hidden="true"
      />
      {hub.surface === 'loading' && !world && !resource && (
        <button
          type="button"
          className="alignment-cancel"
          onClick={returnToHub}
        >
          Cancel launch
        </button>
      )}
      {help && (
        <ProjectHelp
          key={help.project.id}
          request={help}
          onClose={() => {
            cue('cancel')
            setHelp(null)
          }}
          onCue={() => cue('toggle')}
          onResource={(project) => {
            setHelp(null)
            openResource(project)
          }}
        />
      )}
      <InfoPanel
        open={infoOpen}
        onClose={() => {
          cue('cancel')
          setInfoOpen(false)
        }}
        trigger={infoButton}
        onReplay={
          world
            ? undefined
            : () => {
                cue('toggle')
                setInfoOpen(false)
                previews.stop()
                presentation.current.intro.zoomReset = false
                presentation.current.intro.resetActive = false
                presentation.current.intro.zoomVelocity = 0
                presentation.current.intro.zoomDelta = 0
                presentation.current.intro.elapsed = 0
                presentation.current.intro.cueEpoch = null
                setIntroEntryRequest(0)
                presentation.current.intro.completed = false
                presentation.current.intro.exiting = false
                presentation.current.intro.exitProgress = 0
                presentation.current.intro.holding = false
                presentation.current.intro.pulseAt = -20
                dispatch({ type: 'replay' })
              }
        }
      />
      <ExperienceSettings
        open={settingsOpen}
        onClose={() => {
          cue('cancel')
          setSettingsOpen(false)
        }}
        trigger={settingsButton}
        settings={settings}
        onChange={updateSettings}
        onCue={cue}
        reduced={reduced}
        staticView={failed || reduced}
        adjusted={adjusted}
        storageUnavailable={storageUnavailable}
      />
    </div>
  )
}

function ThemedDocument({ children }: { children: ReactNode }) {
  useSiteTheme(loadSettings().theme)
  return children
}

export function App() {
  const [route, setRoute] = useState(() => location.pathname + location.hash)
  useEffect(() => {
    const change = () => setRoute(location.pathname + location.hash)
    for (const event of ['popstate', 'hashchange', 'portfolio:navigate'])
      window.addEventListener(event, change)
    return () => {
      for (const event of ['popstate', 'hashchange', 'portfolio:navigate'])
        window.removeEventListener(event, change)
    }
  }, [])
  const path = route.split('#')[0].replace(/\/$/, '')
  if (path === '/work/pelagic')
    return (
      <ThemedDocument>
        <PelagicCaseStudy />
      </ThemedDocument>
    )
  if (path === '/credits')
    return (
      <ThemedDocument>
        <Credits />
      </ThemedDocument>
    )
  return <Home route={route} />
}
