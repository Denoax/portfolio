// Bounded, fixed-step head history. Geometry samples the supported arc, rather
// than retaining a long follower chain and hiding its end with transparency.
export const TUBE_STRANDS = 9
export const TUBE_SECTIONS = 32
export const TUBE_STEP = 1 / 60
const HISTORY = 80

export class TubeTrail {
  readonly centers = new Float32Array(TUBE_SECTIONS * 3)
  readonly colors = new Float32Array(this.centers.length)
  readonly arcLengths = new Float64Array(TUBE_STRANDS)
  private readonly points = new Float32Array(HISTORY * TUBE_STRANDS * 3)
  private readonly pigments = new Float32Array(this.points.length)
  private readonly path = new Float32Array((HISTORY + 1) * 3)
  private readonly pathColors = new Float32Array(this.path.length)
  private readonly distances = new Float64Array(HISTORY + 1)
  private head = 0
  private count = 1
  private time = 0
  private tailTime = 0

  seed(time: number, heads: Float32Array, rgb: readonly number[]) {
    this.head = 0; this.count = 1; this.time = this.tailTime = time
    this.store(heads, rgb)
  }

  append(time: number, heads: Float32Array, rgb: readonly number[], maximumAge: number) {
    this.head = (this.head + 1) % HISTORY
    this.count = Math.min(HISTORY, this.count + 1)
    this.time = time
    // Growing idle memory must never resurrect a discarded moving tail.
    this.tailTime = Math.max(this.tailTime, time - maximumAge)
    this.store(heads, rgb)
  }

  private store(heads: Float32Array, rgb: readonly number[]) {
    const start = this.head * TUBE_STRANDS * 3
    this.points.set(heads, start)
    for (let s = 0; s < TUBE_STRANDS; s++) this.pigments.set(rgb, start + s * 3)
  }

  private read(strand: number, age: number, destination: number) {
    const offset = Math.min(this.count - 1, age)
    const newer = Math.floor(offset), older = Math.min(this.count - 1, newer + 1)
    const a = (((this.head - newer + HISTORY) % HISTORY) * TUBE_STRANDS + strand) * 3
    const b = (((this.head - older + HISTORY) % HISTORY) * TUBE_STRANDS + strand) * 3
    const mix = offset - newer
    for (let axis = 0; axis < 3; axis++) {
      this.path[destination + axis] = this.points[a + axis] + (this.points[b + axis] - this.points[a + axis]) * mix
      this.pathColors[destination + axis] = this.pigments[a + axis] + (this.pigments[b + axis] - this.pigments[a + axis]) * mix
    }
  }

  sample(strand: number, mix: number, maximumArc: number) {
    // One fixed-step interpolation delay, matching the existing geometry owner.
    const offset = Math.min(this.count - 1, 1 - mix)
    const renderedTime = this.time - offset * TUBE_STEP
    const age = Math.max(0, Math.min(renderedTime - this.tailTime, (this.count - 1 - offset) * TUBE_STEP))
    this.read(strand, offset, 0)
    this.distances[0] = 0
    let count = 1, length = 0
    for (let i = 1; i <= Math.ceil(age / TUBE_STEP); i++) {
      const p = count * 3, previous = p - 3
      this.read(strand, offset + Math.min(i * TUBE_STEP, age) / TUBE_STEP, p)
      const segment = Math.hypot(this.path[p] - this.path[previous], this.path[p + 1] - this.path[previous + 1], this.path[p + 2] - this.path[previous + 2])
      const fraction = segment > 0 ? Math.min(1, (maximumArc - length) / segment) : 1
      if (fraction < 1) for (let axis = 0; axis < 3; axis++) {
        this.path[p + axis] = this.path[previous + axis] + (this.path[p + axis] - this.path[previous + axis]) * fraction
        this.pathColors[p + axis] = this.pathColors[previous + axis] + (this.pathColors[p + axis] - this.pathColors[previous + axis]) * fraction
      }
      length += segment * fraction
      this.distances[count++] = length
      if (fraction < 1) break
    }
    this.arcLengths[strand] = length
    let segment = 0
    for (let i = 0; i < TUBE_SECTIONS; i++) {
      const distance = length * i / (TUBE_SECTIONS - 1)
      while (segment + 1 < count - 1 && this.distances[segment + 1] < distance) segment++
      const next = Math.min(count - 1, segment + 1)
      const span = this.distances[next] - this.distances[segment]
      const weight = span > 0 ? (distance - this.distances[segment]) / span : 0
      for (let axis = 0; axis < 3; axis++) {
        const a = segment * 3 + axis, b = next * 3 + axis, p = i * 3 + axis
        this.centers[p] = this.path[a] + (this.path[b] - this.path[a]) * weight
        this.colors[p] = this.pathColors[a] + (this.pathColors[b] - this.pathColors[a]) * weight
      }
    }
  }
}
