export type BootPhase = 'SHELL' | 'PREPARING' | 'PRIMED' | 'REVEALING' | 'COMPLETE' | 'FALLBACK'
export type ResourceOutcome = 'ready' | 'fallback'
export interface BootSnapshot {
  phase: BootPhase
  generation: number
  target: string
  motionAllowed: boolean
  reason: string
  resources: Readonly<Record<string, ResourceOutcome>>
}
const GRAPHICS = ['native-fonts', 'native-layout', 'ring-atlas', 'posters', 'foreground', 'waves']
const NATIVE = ['native-fonts', 'native-layout']

// The sole boot state owner. Tokens bind actual preparation to its renderer;
// scheduling/presentation is handled by the lightweight DOM adapter.
export class BootSession {
  private snapshot: BootSnapshot = {phase:'SHELL',generation:0,target:'',motionAllowed:false,reason:'',resources:{}}
  private required = GRAPHICS
  private alive = true
  private readonly renderers = new WeakMap<object, number>()
  private readonly listeners = new Set<() => void>()
  constructor(private readonly record: (name: string, snapshot: BootSnapshot) => void = () => {}) {}
  getSnapshot = () => this.snapshot
  // Completed preparation steps, not download bytes or elapsed time.
  // The final step is the existing verified target draw.
  getProgress = () => ['PRIMED','REVEALING','COMPLETE'].includes(this.snapshot.phase) ? 100 :
    Math.floor(100 * this.required.filter(name => this.snapshot.resources[name]).length / (this.required.length + 1))
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(change: Partial<BootSnapshot>, event: string) {
    this.snapshot = {...this.snapshot, ...change}
    this.record(event, this.snapshot)
    for (const listener of this.listeners) listener()
  }
  begin(target: string, renderer?: object): number | null {
    if (this.snapshot.phase === 'COMPLETE') return null
    const generation = this.snapshot.generation + 1
    this.required = renderer ? GRAPHICS : NATIVE
    this.alive = true
    if (renderer) this.renderers.set(renderer, generation)
    this.update({generation,target,resources:{},motionAllowed:false,
      phase:this.snapshot.reason ? 'FALLBACK' : 'PREPARING'}, 'generation')
    return generation
  }
  current(token: number | null) { return token !== null && this.alive && token === this.snapshot.generation && this.snapshot.phase !== 'COMPLETE' }
  retire(token: number | null) {
    if (!this.current(token)) return
    this.alive = false
    this.update({}, 'retired')
  }
  resource(token: number | null, name: string, outcome: ResourceOutcome = 'ready') {
    if (!this.current(token) || !['PREPARING','FALLBACK'].includes(this.snapshot.phase)) return
    this.update({resources:{...this.snapshot.resources,[name]:outcome}}, `resource:${name}:${outcome}`)
  }
  targetDraw(renderer: object) { this.prime(this.renderers.get(renderer) ?? null) }
  prime(token: number | null) {
    if (!this.current(token) || !['PREPARING','FALLBACK'].includes(this.snapshot.phase) ||
      this.required.some(name => !this.snapshot.resources[name])) return
    this.update({resources:{...this.snapshot.resources,'target-draw':'ready'},phase:'PRIMED'}, 'target-draw')
  }
  reveal(token: number) {
    if (this.current(token) && this.snapshot.phase === 'PRIMED') this.update({phase:'REVEALING'}, 'reveal')
  }
  releaseMotion(token: number) {
    if (this.current(token) && this.snapshot.phase === 'REVEALING' && !this.snapshot.motionAllowed)
      this.update({motionAllowed:true}, 'motion-release')
  }
  complete(token: number) {
    if (this.current(token) && this.snapshot.phase === 'REVEALING')
      this.update({phase:'COMPLETE',motionAllowed:true}, 'complete')
  }
  fail(reason: string) {
    if (this.snapshot.phase === 'COMPLETE' || this.snapshot.reason) return
    this.alive = false
    this.update({phase:'FALLBACK',reason,motionAllowed:false}, 'fallback')
  }
}
