import type { RefObject } from 'react'
import type { QualityProfile } from '../core/quality'
import type { ExperiencePreferences } from '../core/experienceSettings'
import { LiveGalaxy, FarStars } from './galaxy/LiveGalaxy'
import { CameraRig } from './CameraRig'
import { PelagicLife } from './pelagic/PelagicLife'
import { AtmosphereSky } from './AtmosphereSky'
import { DescentComposite } from './DescentComposite'
import { CoreRadiance } from './CoreRadiance'
import { SolarBackdrop } from './SolarBackdrop'
import { SolarSystem } from './SolarSystem'
import { OceanLighting } from './OceanLighting'
import { MarineMedium } from './MarineMedium'
import { PlanetScene } from './PlanetScene'
import { SurfacePassage } from './SurfacePassage'
export default function WorldScene({
  quality,
  preferences,
  onReady,
  onFailure,
  onAssetState,
}: {
  quality: QualityProfile
  preferences: RefObject<ExperiencePreferences>
  onReady: () => void
  onFailure: () => void
  onAssetState: (state: 'loading' | 'ready' | 'failed') => void
}) {
  return (
    <>
      <CameraRig />

      <FarStars quality={quality} />
      <LiveGalaxy quality={quality} />
      <PlanetScene quality={quality} onAssetState={onAssetState} />
      <AtmosphereSky />
      <SolarBackdrop quality={quality} />
      <SolarSystem />
      <CoreRadiance />
      <SurfacePassage quality={quality} />
      <MarineMedium />
      <OceanLighting />
      <hemisphereLight args={['#abddec', '#071526', 0.8]} />
      <directionalLight position={[2, 8, 4]} color="#b8edff" intensity={1.8} />
      <pointLight
        position={[4, 6, 4]}
        color="#68cadd"
        intensity={65}
        distance={40}
        decay={2}
      />
      <PelagicLife quality={quality} />
      {/* Attach imperative anatomy/environment before the compiler traverses
          the scene. Readiness must include their actual material variants. */}
      <DescentComposite
        preferences={preferences}
        quality={quality}
        onReady={onReady}
        onFailure={onFailure}
      />
    </>
  )
}
