import {boot,nativeTarget} from '../boot/runtime'
import {useBoot} from '../boot/useBoot'
import { clearIntroRipples } from '../core/introRipples'
import { resetIntroTransport } from '../core/introMotion'
import { GlobalProximityRail } from './GlobalProximityRail'
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
import { hubReducer, parseHubRoute } from '../core/hubState'
import type { HubState } from '../core/hubState'
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
    surface: parsed === 'hub' && !introSeen() && !url.hash ? 'intro' : 'hub',
    request: 1,
    notice:
      parsed === 'removed'
        ? 'This project is not in the current selection.'
        : '',
  }
}
function Home({ route }: { route: string }) {
  const bootState = useBoot()
  const [introExiting, setIntroExiting] = useState(false)
  const [hub, dispatch] = useReducer(hubReducer, route, initialState)
  const hubRef = useRef(hub)
  hubRef.current = hub
  const [settings, setSettings] = useState(loadSettings),
    [settingsOpen, setSettingsOpen] = useState(false),
    [infoOpen, setInfoOpen] = useState(false)
  const theme = useSiteTheme(settings.theme, settings.motion === 'less')
  const routeSurface = useRef<HTMLDivElement>(null)
  const navGroup = useRef<HTMLDivElement>(null)
  const [help, setHelp] = useState<HelpRequest | null>(null)
  const presentation = useRef(createMenuPresentation())
  const [resource, setResource] = useState<ResourceRequest | null>(null)
  const resourceRef = useRef(resource)
  resourceRef.current = resource
  const resourceSequence = useRef(0)
  const audio = useRef<InterfaceAudio | null>(null)
  const resourceOrigin = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const engine = new InterfaceAudio()
    audio.current = engine
    engine.configure(
      settings.soundVolume > 0,
      settings.soundVolume / 100,
      settings.ambienceVolume / 100,
    )
    let prepared = false
    const prepareAudio = () => {
      if (!prepared && ['REVEALING','COMPLETE'].includes(boot.getSnapshot().phase)) {
        prepared = true
        engine.prepare()
      }
    }
    const stopBootAudio = boot.subscribe(prepareAudio)
    prepareAudio()
    const retire = () => engine.retireAll()
    const hidden = () => {
      engine.visibility()
    }
    window.addEventListener('pagehide', retire)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      stopBootAudio()
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
    audio.current?.setScene(hub.surface === 'intro' ? 'intro' : 'selection')
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
  const closeUtilities = useGlassDialogMotion(
    utilityPanel,
    utilitiesOpen,
    () => setUtilitiesOpen(false),
    '.utility-toggle',
  )
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
    [storageUnavailable, setStorageUnavailable] = useState(false)
  useEffect(() => {
    setStorageUnavailable(!saveSettings(settings))
  }, [])
  const [failed, setFailed] = useState(() => boot.getSnapshot().phase === 'FALLBACK'),
    [hubReady, setHubReady] = useState(false)
  const closeOrdinaryPanes = (dismissIndex = true) => {
    setInfoOpen(false)
    setSettingsOpen(false)
    setHelp(null)
    setUtilitiesOpen(false)
    if (dismissIndex) setDismissIndexRequest((value) => value + 1)
  }
  const panelOpen = settingsOpen || infoOpen || projectsOpen || Boolean(help)
  presentation.current.paused = hub.surface !== 'hub' || Boolean(resource) || !bootState.motionAllowed
  presentation.current.reduced = reduced
  presentation.current.intro.active = hub.surface === 'intro'
  presentation.current.decorativeRunning =
    ['intro', 'hub'].includes(hub.surface) && !reduced && bootState.motionAllowed
  presentation.current.intro.paused = reduced || !bootState.motionAllowed
  presentation.current.intro.inputBlocked = Boolean(resource) || bootState.phase !== 'COMPLETE'
  const preferences = useRef({ settings, panelOpen, theme })
  preferences.current = {
    settings,
    theme,
    panelOpen: Boolean(resource) || hub.surface === 'intro',
  }
  const routeRef = useRef(route),
    previousSurface = useRef(hub.surface)
  const onHubReady = useCallback(() => setHubReady(true), [])
  const onFailure = useCallback(() => { boot.fail('Graphics preparation unavailable');setFailed(true) }, [])
  const onOverload = useCallback(() => {
    setQuality(lowerQuality)
  }, [])
  useEffect(() => {
    const fallback = () => setFailed(true)
    window.addEventListener('portfolio:boot-fallback', fallback)
    if (boot.getSnapshot().phase === 'FALLBACK') fallback()
    return () => window.removeEventListener('portfolio:boot-fallback', fallback)
  }, [])
  useEffect(() => {
    if (!failed && !(reduced && hub.surface !== 'intro')) return
    const element = routeSurface.current
    if (element) void nativeTarget(element, hub.surface + '-static')
  }, [failed, reduced, hub.surface])
  useEffect(() => {
    if (!hubReady) return
    const token = boot.getSnapshot().generation
    if (routeSurface.current?.getClientRects().length) boot.resource(token, 'native-layout')
  }, [hubReady, bootState.generation])
  const updateSettings = (value: Settings) => {
    const next = validateSettings(value)
    if (next.graphics !== settings.graphics) {
      setQuality(selectQuality(next.graphics))
    }
    const changed = (Object.keys(next) as (keyof Settings)[]).filter(
      (key) => next[key] !== settings[key],
    )
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
    const url = new URL(route, location.origin)
    // Old bookmarks return to the project reel; they can never mount the
    // retired galaxy/descent or automatically send a visitor elsewhere.
    if (['#earth', '#pelagic', '#work'].includes(url.hash)) {
      routeRef.current = '/#worlds'
      dispatch({ type: 'hub' })
      window.scrollTo(0, 0)
      navigate('/#worlds', true, history.state)
      return
    }
    if (route === routeRef.current) return
    routeRef.current = route
    dispatch({
      type: 'hub',
      notice:
        parseHubRoute(url.pathname, url.hash) === 'removed'
          ? 'This project is not in the current selection.'
          : '',
    })
    window.scrollTo(0, 0)
  }, [route])
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
    previousSurface.current = hub.surface
  }, [hub.surface])
  const openResource = (project: Project) => {
    if (resourceRef.current || hubRef.current.surface !== 'hub') return
    closeOrdinaryPanes()
    previews.stop()
    const request = {
      token: ++resourceSequence.current,
      project,
    }
    resourceRef.current = request
    audio.current?.unlock()
    cue('activate')
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
  }
  const completeResource = (token: number) => {
    const current = resourceRef.current
    if (!current || current.token !== token) return
    location.assign(current.project.action.href)
  }
  useEffect(() => {
    const restore = (event?: PageTransitionEvent) => {
      audio.current?.retireAll()
      if (event && history.state?.returnToMenu) {
        dispatch({ type: 'hub' })
        routeRef.current = '/#worlds'
        window.scrollTo(0, 0)
      }
      resourceRef.current = null
      setResource(null)
      presentation.current.intro.exiting = false
      presentation.current.intro.exitProgress = 0
      setIntroExiting(false)
      routeSurface.current?.style.removeProperty('opacity')
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
  const cancelResource = () => {
    resourceRef.current = null
    setResource(null)
    audio.current?.retireSfx()
    routeSurface.current?.style.removeProperty('opacity')
    resourceOrigin.current?.focus({ preventScroll: true })
  }
  return (
    <div
      ref={routeSurface}
      className="site selection-site"
      data-surface={hub.surface}
      data-resource={Boolean(resource)}
      data-reduced={reduced}
      data-static={failed || reduced}
      style={
        {
          '--scroll-pace': settings.scrollPace / 100,
          '--fallback-brightness':
            failed || reduced ? settings.displayBrightness / 100 : undefined,
        } as CSSProperties
      }
    >
      <a className="skip-link" href={pelagic.caseStudy}>
        Skip to Pelagic case study
      </a>
      {!failed && (!reduced || hub.surface === 'intro') && (
        <ExperienceCanvas
          preferences={preferences}
          quality={quality}
          onHubReady={onHubReady}
          presentation={presentation}
          previews={previews}
          onFailure={onFailure}
          onOverload={onOverload}
          visible={hubReady}
        />
      )}
      <header className="hub-header" inert={Boolean(resource)}>
        <button
          type="button"
          className="hub-brand"
          onClick={() => {
            cue('toggle')
            closeOrdinaryPanes()
            setInfoOpen(true)
          }}
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
          <div ref={navGroup} className="portfolio-nav-group">
            <GooeyNav
              aria-label="Portfolio navigation"
              reduced={reduced}
              value={settingsOpen ? 2 : infoOpen ? 1 : projectsOpen ? 0 : -1}
              items={[
                {
                  label: 'Projects',
                  id: 'projects-trigger',
                  icon: <NavIcon kind="projects" />,
                  expanded: projectsOpen,
                  controls: 'projects-index',
                },
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
                const action = index
                if (action === 3) return
                cue('toggle')
                closeOrdinaryPanes(action !== 0)
                if (action === 0) setIndexRequest((x) => x + 1)
                else if (action === 1) setInfoOpen(true)
                else if (action === 2) setSettingsOpen(true)
              }}
            />
          </div>
        </div>
      </header>
      <SelectionHub
        staticView={failed || reduced}
        notice={hub.notice}
        aligning={false}
        active={hub.surface === 'hub'}
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
        onCue={cue}
        navGroup={navGroup}
      />
      {!introExiting && hub.surface === 'hub' && (
        <GlobalProximityRail
          surface="hub"
          presentation={presentation}
          reduced={reduced}
          blocked={Boolean(resource)}
          onSelect={(id) => {
            if (
              resourceRef.current ||
              presentation.current.intro.exiting ||
              id === 'intro'
            )
              return
            presentation.current.selectProject?.(id)
          }}
        />
      )}
      {['intro', 'hub'].includes(hub.surface) && (
        <div className="portfolio-dock" inert={Boolean(resource)}>
          <ThemeToggle
            theme={theme}
            reduced={reduced}
            onToggle={() =>
              updateSettings({
                ...settings,
                theme: theme === 'dark' ? 'light' : 'dark',
              })
            }
          />
        </div>
      )}
      {hub.surface === 'intro' && (
        <IdentityIntro
          presentation={presentation}
          staticView={failed || reduced}
          paused={Boolean(resource) || bootState.phase !== 'COMPLETE'}
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
          onSnap={(id) => audio.current?.playIntroSnap(id)}
          onHold={(holding) => {
            if (holding) audio.current?.startIntroCharge()
            else audio.current?.stopIntroCharge()
          }}
          ready={hubReady || failed || reduced}
        />
      )}
      <ResourceTransition
        surface={routeSurface}
        request={resource}
        ready={true}
        reduced={failed || reduced}
        slow={false}
        onComplete={completeResource}
        onCancel={cancelResource}
      />
      {failed && (
        <p className="hub-degraded" role="status">
          Graphics unavailable. Project links remain available.{' '}
          <button
            type="button"
            // Retire the lost context and retry essential imports in a new document.
            onClick={() => window.location.reload()}
          >
            Retry graphics
          </button>
        </p>
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
        anchor={navGroup}
        onReplay={() => {
          cue('toggle')
          setInfoOpen(false)
          previews.stop()
          resetIntroTransport(presentation.current.intro)
          presentation.current.intro.elapsed = 0
          presentation.current.intro.cueEpoch = null
          setIntroEntryRequest(0)
          presentation.current.intro.completed = false
          presentation.current.intro.exiting = false
          presentation.current.intro.exitProgress = 0
          presentation.current.intro.holding = false
          clearIntroRipples(presentation.current.intro.ripples)
          dispatch({ type: 'replay' })
        }}
      />
      <ExperienceSettings
        open={settingsOpen}
        onClose={() => {
          cue('cancel')
          setSettingsOpen(false)
        }}
        trigger={settingsButton}
        anchor={navGroup}
        settings={settings}
        onChange={updateSettings}
        reduced={reduced}
        storageUnavailable={storageUnavailable}
      />
    </div>
  )
}

function ThemedDocument({ children }: { children: ReactNode }) {
  useEffect(() => { const root=document.getElementById('root');if(root) void nativeTarget(root,'document') }, [])
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
