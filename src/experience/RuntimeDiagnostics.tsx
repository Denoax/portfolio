import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { MenuPresentation } from '../core/menuReel'
import type { QualityProfile } from '../core/quality'
import { narrative } from '../core/narrative'
interface Diagnostics {
  introZoom: {
    octave: string
    phase: number
    pending: number
    instances: number
    attributeBytes: number
    geometryId: number
    velocity: number
    resetting: boolean
    age: number
    cueAge: number | null
    inputBlocked: boolean
    holding: boolean
    ripples: {
      id: number
      startedAt: number
      age: number
      active: boolean
    }[]
  }
  menu: {
    clock: number
    target: number
    rendered: number
    settledId: string | null
    inputBlocked: boolean
  }
  backend: string
  flash: number
  clouds: number
  cloudCover: number
  exposure: number
  outputColorSpace: string
  drawingBufferColorSpace: string
  outputPath: string
  textureColorSpaces: { name: string; space: string }[]
  altitude: number
  cloudSteps: number
  cloudResolution: number
  renderer: string
  shot: string
  surfaceHeight: number
  submerged: number
  tier: string
  particles: number
  dpr: number
  state: number
  elapsed: number
  camera: number[]
  calls: number
  triangles: number
  points: number
  geometries: number
  textures: number
}
declare global {
  interface Window {
    __portfolio?: Diagnostics
  }
}
// Read-only evidence hook. Renderer.info is CPU-visible resource/draw evidence,
// never a substitute for GPU timing. Sampling avoids per-frame object allocation.
export function RuntimeDiagnostics({
  quality,
  presentation,
}: {
  quality: QualityProfile
  presentation: RefObject<MenuPresentation>
}) {
  const { gl, camera, scene } = useThree()
  const textureCount = useRef(-1)
  const elapsed = useRef(0)
  const owned = useRef<Diagnostics | null>(null)
  useEffect(() => {
    const context = gl.getContext(),
      extension = context.getExtension('WEBGL_debug_renderer_info')
    const diagnostic: Diagnostics = {
      introZoom: {
        octave: '0',
        phase: 0,
        pending: 0,
        instances: 0,
        attributeBytes: 0,
        geometryId: 0,
        velocity: 0,
        resetting: false,
        age: 0,
        cueAge: null,
        inputBlocked: false,
        holding: false,
        ripples: [],
      },
      flash: 0,
      clouds: 0,
      cloudCover: 0,
      exposure: gl.toneMappingExposure,
      outputColorSpace: gl.outputColorSpace,
      drawingBufferColorSpace: context.drawingBufferColorSpace ?? 'unsupported',
      outputPath: 'direct',
      textureColorSpaces: [],
      altitude: 0,
      cloudSteps: quality.cloudSteps,
      cloudResolution: quality.cloudResolution,
      menu: {
        clock: 0,
        target: 0,
        rendered: 0,
        settledId: null,
        inputBlocked: false,
      },
      backend: 'WebGL2 / Three 0.180',
      renderer: extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : 'not exposed',
      shot: narrative.frame.shot,
      surfaceHeight: narrative.frame.surfaceY,
      submerged: narrative.frame.submerged,
      tier: quality.tier,
      particles: quality.particles,
      dpr: gl.getPixelRatio(),
      state: 0,
      elapsed: 0,
      camera: camera.position.toArray(),
      calls: 0,
      triangles: 0,
      points: 0,
      geometries: 0,
      textures: 0,
    }
    owned.current = diagnostic
    window.__portfolio = diagnostic
    return () => {
      if (window.__portfolio === diagnostic) delete window.__portfolio
      owned.current = null
    }
  }, [gl, camera, quality])
  useFrame((_, delta) => {
    elapsed.current += delta
    if (
      elapsed.current < 0.25 ||
      !owned.current ||
      window.__portfolio !== owned.current
    )
      return
    elapsed.current = 0
    const intro = presentation.current.intro
    owned.current.introZoom.octave = intro.zoom.octave.toString()
    owned.current.introZoom.phase = intro.zoom.phase
    owned.current.introZoom.pending = intro.zoomDelta
    owned.current.introZoom.velocity = intro.zoomVelocity
    owned.current.introZoom.resetting = intro.resetActive || intro.zoomReset
    owned.current.introZoom.age = intro.elapsed
    owned.current.introZoom.cueAge =
      intro.cueEpoch === null ? null : intro.elapsed - intro.cueEpoch
    owned.current.introZoom.inputBlocked = intro.inputBlocked
    owned.current.introZoom.holding = intro.holding
    owned.current.introZoom.ripples = intro.ripples.slots.map((slot) => ({
      ...slot,
      age: intro.elapsed - slot.startedAt,
    }))
    owned.current.menu.clock = presentation.current.clock
    owned.current.menu.target = presentation.current.target
    owned.current.menu.rendered = presentation.current.rendered
    owned.current.menu.settledId = presentation.current.settledId
    owned.current.menu.inputBlocked = presentation.current.paused
    const ring = scene.getObjectByName(
      'Ringwriter-independent-instanced-typography',
    ) as THREE.Mesh | undefined
    owned.current.introZoom.instances = ring
      ? (ring.geometry as THREE.InstancedBufferGeometry).instanceCount
      : 0
    owned.current.introZoom.attributeBytes = ring
      ? Object.values(ring.geometry.attributes).reduce(
          (sum, attribute) => sum + attribute.array.byteLength,
          0,
        )
      : 0
    owned.current.introZoom.geometryId = ring?.geometry.id ?? 0
    if (textureCount.current !== gl.info.memory.textures) {
      textureCount.current = gl.info.memory.textures
      const textures = new Map<number, THREE.Texture>()
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points))
          return
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.set(value.id, value)
          if (material instanceof THREE.ShaderMaterial)
            for (const uniform of Object.values(material.uniforms)) {
              if (uniform.value instanceof THREE.Texture)
                textures.set(uniform.value.id, uniform.value)
            }
        }
      })
      owned.current.textureColorSpaces = [...textures.values()].map(
        (texture) => ({
          name:
            texture.name ||
            (texture.image?.src
              ? new URL(texture.image.src, location.href).pathname
              : 'procedural numeric texture'),
          space: texture.colorSpace || 'NoColorSpace',
        }),
      )
    }
    Object.assign(owned.current, {
      flash: narrative.frame.flash,
      clouds: narrative.frame.clouds,
      cloudCover: narrative.frame.cloudCover,
      exposure: gl.toneMappingExposure,
      outputColorSpace: gl.outputColorSpace,
      drawingBufferColorSpace:
        gl.getContext().drawingBufferColorSpace ?? 'unsupported',
      outputPath:
        narrative.frame.clouds > 0.0001 || narrative.frame.flash > 0.0001
          ? 'linear composite'
          : 'direct',
      altitude: narrative.frame.altitude,
      state: narrative.state,
      shot: narrative.frame.shot,
      surfaceHeight: narrative.frame.surfaceY,
      submerged: narrative.frame.submerged,
      elapsed: narrative.elapsed,
      camera: camera.position.toArray(),
      dpr: gl.getPixelRatio(),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    })
  })
  return null
}
