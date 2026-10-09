import { GlassLayer } from './glass/GlassLayer'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type { ReactNode, RefObject } from 'react'
import type { ExperiencePreferences } from '../core/experienceSettings'
import { WorldFrameObserver } from './WorldFrameObserver'
import { configureDisplayOutput } from './displayOutput'
import { retainCompilingMaterials } from './retainCompilingMaterials'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { AmbientClock } from './AmbientClock'
import { QualityController } from './QualityController'
import { RuntimeDiagnostics } from './RuntimeDiagnostics'
import { HubScene } from './hub/HubScene'

import type { PreviewPlayback } from '../core/previewPlayback'
import type { MenuPresentation } from '../core/menuReel'

const WorldScene = lazy(() => import('./WorldScene'))

interface ExperienceCanvasProps {
  preferences: RefObject<ExperiencePreferences>
  quality: QualityProfile
  onReady: () => void
  onFailure: () => void
  onOverload: () => void
  onAssetState: (state: 'loading' | 'ready' | 'failed') => void
  parked: boolean
  visible: boolean
  world: boolean
  presentation: RefObject<MenuPresentation>
  previews: PreviewPlayback
  onHubReady: () => void
  onWorldFrame: () => void
}

class GraphicsBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

// Both surfaces share one renderer, but retire different offscreen targets and
// materials. The returning menu retires that GPU state. The destination
// keeps ownership of its existing shader/binding setup; the new menu does
// not invalidate that protected pipeline.
function RendererHandover({ world }: { world: boolean }) {
  const { gl } = useThree()
  const previous = useRef<boolean | null>(null)
  useFrame(() => {
    if (previous.current === world) return
    previous.current = world
    if (!world) gl.resetState()
    gl.setRenderTarget(null)
    gl.setScissorTest(false)
    gl.autoClear = true
    gl.autoClearColor = true
    gl.autoClearDepth = true
    gl.autoClearStencil = true
  }, -3)
  return null
}

export function ExperienceCanvas({
  quality,
  world,
  presentation,
  previews,
  onHubReady,
  preferences,
  onReady,
  onFailure,
  onOverload,
  visible,
  parked,
  onAssetState,
  onWorldFrame,
}: ExperienceCanvasProps) {
  const baseFrame = useRef(0)
  // R3F retires its root asynchronously. Callbacks from that retired renderer
  // must not mark a replacement canvas ready or failed after a preference change.
  const alive = useRef(true)
  const detachContextListener = useRef<(() => void) | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      detachContextListener.current?.()
    }
  }, [])
  const reportReady = useCallback(() => {
    if (alive.current) onReady()
  }, [onReady])
  const reportFailure = useCallback(() => {
    if (alive.current) onFailure()
  }, [onFailure])
  const reportAssets = useCallback(
    (state: 'loading' | 'ready' | 'failed') => {
      if (alive.current) onAssetState(state)
    },
    [onAssetState],
  )
  const webglAvailable = useMemo(() => {
    try {
      return Boolean(document.createElement('canvas').getContext('webgl2'))
    } catch {
      return false
    }
  }, [])
  useEffect(() => {
    if (!webglAvailable) reportFailure()
  }, [webglAvailable, reportFailure])
  if (!webglAvailable) return null

  return (
    <div
      className={`experience-canvas ${visible ? 'experience-canvas--visible' : ''}`}
      aria-hidden="true"
    >
      <GraphicsBoundary onFailure={reportFailure}>
        <Canvas
          dpr={quality.dpr}
          frameloop={parked ? 'demand' : 'always'}
          camera={{ position: [0.2, 4.2, 13.5], fov: 41, near: 0.1, far: 140 }}
          gl={{
            antialias: quality.tier !== 'low',
            alpha: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.9,
          }}
          onCreated={({ gl }) => {
            if (!alive.current) return
            configureDisplayOutput(gl)
            retainCompilingMaterials(gl)
            gl.setClearColor('#020205', 1)
            const lost = (event: Event) => {
              event.preventDefault()
              reportFailure()
            }
            detachContextListener.current?.()
            gl.domElement.addEventListener('webglcontextlost', lost)
            detachContextListener.current = () =>
              gl.domElement.removeEventListener('webglcontextlost', lost)
          }}
        >
          <RendererHandover world={world} />
          <AmbientClock />
          <QualityController quality={quality} onOverload={onOverload} />
          {world ? (
            <>
              <Suspense fallback={null}>
                <WorldScene
                  quality={quality}
                  preferences={preferences}
                  onReady={reportReady}
                  onFailure={reportFailure}
                  onAssetState={reportAssets}
                />
              </Suspense>
            </>
          ) : (
            <HubScene
              baseFrame={baseFrame}
              quality={quality}
              preferences={preferences}
              presentation={presentation}
              previews={previews}
              onReady={onHubReady}
              onFailure={reportFailure}
            />
          )}
          {world && (
            <WorldFrameObserver enabled={visible} onFrame={onWorldFrame} />
          )}
          <GlassLayer
            key={world ? 'world-glass' : 'hub-glass'}
            world={world}
            baseFrame={baseFrame}
          />
          <RuntimeDiagnostics quality={quality} presentation={presentation} />
        </Canvas>
      </GraphicsBoundary>
    </div>
  )
}
