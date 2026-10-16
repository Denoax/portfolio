import { GlassLayer } from './glass/GlassLayer'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type { ReactNode, RefObject } from 'react'
import type { ExperiencePreferences } from '../core/experienceSettings'
import { configureDisplayOutput } from './displayOutput'
import { retainCompilingMaterials } from './retainCompilingMaterials'
import { bindDefaultFramebuffer } from './defaultFramebuffer'
import * as THREE from 'three'
import type { QualityProfile } from '../core/quality'
import { AmbientClock } from './AmbientClock'
import { QualityController } from './QualityController'
import { RuntimeDiagnostics } from './RuntimeDiagnostics'
import { HubScene } from './hub/HubScene'

import type { PreviewPlayback } from '../core/previewPlayback'
import type { MenuPresentation } from '../core/menuReel'

interface ExperienceCanvasProps {
  preferences: RefObject<ExperiencePreferences>
  quality: QualityProfile
  onFailure: () => void
  onOverload: () => void
  visible: boolean
  presentation: RefObject<MenuPresentation>
  previews: PreviewPlayback
  onHubReady: () => void
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

// Restore the main target before the hub's offscreen simulation/render passes.
// This remains necessary after resizes and browser drawing-buffer clamps.
function DefaultFramebuffer() {
  const { gl } = useThree()
  const initialized = useRef(false)
  useFrame(() => {
    if (!initialized.current) {
      initialized.current = true
      gl.resetState()
      gl.autoClear = true
      gl.autoClearColor = true
      gl.autoClearDepth = true
      gl.autoClearStencil = true
    }
    // Establish the default target before any simulation/render pass, including
    // resizes, DPR changes and recovery from a browser allocation clamp.
    bindDefaultFramebuffer(gl)
    gl.setScissorTest(false)
  }, -3)
  return null
}

export function ExperienceCanvas({
  quality,
  presentation,
  previews,
  onHubReady,
  preferences,
  onFailure,
  onOverload,
  visible,
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
  const reportFailure = useCallback(() => {
    if (alive.current) onFailure()
  }, [onFailure])
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
          frameloop="always"
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
          <DefaultFramebuffer />
          <AmbientClock />
          <QualityController quality={quality} onOverload={onOverload} />
          <HubScene
            baseFrame={baseFrame}
            quality={quality}
            preferences={preferences}
            presentation={presentation}
            previews={previews}
            onReady={onHubReady}
            onFailure={reportFailure}
          />
          <GlassLayer world={false} baseFrame={baseFrame} />
          <RuntimeDiagnostics quality={quality} presentation={presentation} />
        </Canvas>
      </GraphicsBoundary>
    </div>
  )
}
