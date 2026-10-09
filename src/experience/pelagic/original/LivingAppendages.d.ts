import type { Group, Object3D, Ray, Vector2 } from 'three'
export class LivingAppendages {
  constructor(medusa: { transformationObject: Object3D }, index: number, options?: { reducedMotion?: boolean; fidelity?: 'hero' | 'companion'; improved?: boolean })
  group: Group
  setPresence(presence: number, feature?: number): void
  update(delta: number, elapsed: number, current: Vector2, ray?: Ray | null, pointerStrength?: number, interactionMode?: boolean): void
  dispose(): void
}
