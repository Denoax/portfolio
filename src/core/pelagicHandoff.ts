import type { JourneyFrame } from './journey'
export const PELAGIC_LIVE_URL =
  'https://denoax.github.io/pelagic-jellyfish-webgl/'
// The existing descent computes depth from height - waveHeight and finishes
// immersion when the camera is .22 units below that actual animated surface.
// Observe output after the compositor, then require another stable output frame.
export class PelagicHandoffGate {
  private token: number | null = null
  private previous = 0
  private underwaterFrames = 0
  private previouslyUnderwater = false
  arm(token: number) {
    this.token = token
    this.previous = 0
    this.previouslyUnderwater = false
    this.underwaterFrames = 0
  }
  suspend() {
    this.underwaterFrames = 0
    // Resume requires fresh forward movement and two visible output frames.
    this.previouslyUnderwater = false
  }
  disarm() {
    this.token = null
    this.underwaterFrames = 0
  }
  observe(
    progress: number,
    frame: JourneyFrame,
    eligible: boolean,
  ): number | null {
    if (this.token === null) return null
    const forward = progress >= this.previous && progress > 0
    const crossing =
      frame.depth >= 0.22 && frame.submerged >= 0.999 && frame.surface > 0.5
    if (!eligible || !forward || !crossing) this.underwaterFrames = 0
    else if (this.underwaterFrames > 0) this.underwaterFrames++
    else if (!this.previouslyUnderwater && progress > this.previous)
      this.underwaterFrames = 1
    if (progress > this.previous || !crossing)
      this.previouslyUnderwater = crossing
    this.previous = progress
    if (this.underwaterFrames < 2) return null
    const token = this.token
    this.disarm()
    return token
  }
}
