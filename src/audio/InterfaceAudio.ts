import { NoRepeatBag } from './NoRepeatBag'
import { audioBank } from './audioBank'
import { INTRO_HOLD_SECONDS } from '../core/introMotion'
export type SoundCue =
  | 'activate'
  | 'toggle'
  | 'auto'
  | 'speed'
  | 'enter'
  | 'cover'
  | 'resolve'
  | 'settle'
  | 'cancel'
  | 'hover'
  | 'ripple'
  | 'snap'
  | 'buddy'
export type ResourcePhase = 'cover' | 'resolve' | 'settle'
export type AudioScene = 'intro' | 'selection' | 'loading' | 'world'
type Voice = { source: AudioBufferSourceNode; gain: GainNode; role?: Role }
type Bed = Voice & { id: string; offset: number; started: number }
type Role = 'press' | 'hover' | 'back' | 'ripple' | 'buddy'
const legacy = ['transition-soft', 'intro-bed', 'selection-bed']
const chargeName = 'intro-charge-stretch'
const snapName = 'intro-release-snap'
const names: readonly string[] = [
  ...audioBank.map((item) => item.id),
  ...legacy,
  chargeName,
  snapName,
]
const urlFor = (name: string) =>
  name === chargeName
    ? '/assets/audio/intro-charge/stretch-6843e99c0f99.wav'
    : name === snapName
      ? '/assets/audio/intro-charge/snap-1959ad4e2caf.wav'
    : name.startsWith('v22-')
    ? `/assets/audio/v22/${name.slice(4)}.wav`
    : name.startsWith('v18-')
      ? `/assets/audio/v18/${name.slice(4)}.wav`
      : `/assets/audio/${legacy.includes(name) ? 'v13' : 'v16'}/${name}.wav`
// Conservative role gains reserve measured peak headroom for four SFX voices
// plus both existing crossfaded beds and one quiet charge. Natural sample rates.
const roleGain = {
  press: 0.2,
  back: 0.18,
  hover: 0.07,
  ripple: 0.13,
  buddy: 0.15,
}
// Objective RMS trims only. Listening approval is recorded separately.
function hold(param: AudioParam, time: number) {
  if (typeof param.cancelAndHoldAtTime === 'function')
    param.cancelAndHoldAtTime(time)
  else {
    const value = param.value
    param.cancelScheduledValues(time)
    param.setValueAtTime(value, time)
  }
}
// One application-owned graph. Scene beds and SFX have separate lifetimes.
export class InterfaceAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private ambience: GainNode | null = null
  private bytes = new Map<string, Promise<ArrayBuffer>>()
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private voices = new Set<Voice>()
  private charge: Voice | null = null
  private chargeEpoch = 0
  private beds = new Map<string, Bed>()
  private retiringBeds = new Set<Bed>()
  private offsets = new Map<string, number>()
  private decoded = new Map<string, AudioBuffer>()
  private bags = new Map<Role, NoRepeatBag<string>>()
  private decodeStarted = false
  private enabled = true
  private volume = 0.35
  private ambienceLevel = 0.65
  private scene: AudioScene = 'intro'
  private admitAfter = 0
  private bedsAdmitAfter = 0
  private epoch = 0
  private bedEpoch = 0
  private lastUI = -Infinity
  private lastHover = -Infinity
  private lastRippleId = 0
  private lastSnapId = 0
  private token: number | null = null
  private phases = new Set<ResourcePhase>()
  private abort = new AbortController()
  private disposed = false
  constructor(private readonly onUnlocked = (_unlocked: boolean) => {}) {}
  get unlocked() {
    return this.context?.state === 'running'
  }
  prepare() {
    for (const name of names) {
      if (this.bytes.has(name)) continue
      const pending = fetch(urlFor(name), {
        signal: this.abort.signal,
      }).then((r) => {
        if (!r.ok) throw new Error(`Audio ${name}: ${r.status}`)
        this.journal({ type: 'fetch', name, result: 'ready' })
        return r.arrayBuffer()
      })
      void pending.catch((error) =>
        this.journal({
          type: 'fetch',
          name,
          result: 'failed',
          error: String(error),
        }),
      ) // Availability never blocks navigation.
      this.bytes.set(name, pending)
    }
  }
  configure(enabled: boolean, volume: number, ambience = 0.65) {
    this.enabled = enabled
    this.volume = Math.max(0, Math.min(1, volume))
    this.ambienceLevel = Math.max(0, Math.min(1, ambience))
    const ctx = this.context
    if (ctx && this.master && this.ambience) {
      hold(this.master.gain, ctx.currentTime)
      this.master.gain.setTargetAtTime(
        enabled ? this.volume : 0,
        ctx.currentTime,
        0.012,
      )
      this.ambience.gain.setTargetAtTime(
        this.ambienceLevel,
        ctx.currentTime,
        0.03,
      )
    }
    if (!enabled || !volume) this.retireAll()
    else this.syncBeds()
  }
  // Called by a trusted control or artwork hold, never passive wheel/mousemove.
  unlock() {
    if (this.disposed || !this.enabled || !this.volume || document.hidden)
      return
    try {
      if (!this.context) {
        const ctx = (this.context = new AudioContext({
          latencyHint: 'interactive',
        }))
        this.master = ctx.createGain()
        this.master.gain.value = this.volume
        this.master.connect(ctx.destination)
        this.sfx = ctx.createGain()
        this.sfx.connect(this.master)
        this.ambience = ctx.createGain()
        this.ambience.gain.value = this.ambienceLevel
        this.ambience.connect(this.master)
        ctx.onstatechange = () => {
          this.onUnlocked(ctx.state === 'running')
          if (ctx.state === 'running') this.syncBeds()
          else this.retireAll()
        }
      }
      this.prepare()
      if (!this.decodeStarted) {
        this.decodeStarted = true
        const ctx = this.context
        for (const [name, bytes] of this.bytes) {
          const decoded = bytes
            .then((b) => ctx.decodeAudioData(b.slice(0)))
            .then((buffer) => {
              this.decoded.set(name, buffer)
              this.journal({
                type: 'decode',
                name,
                result: 'ready',
                duration: buffer.duration,
              })
              return buffer
            })
          void decoded.catch((error) =>
            this.journal({
              type: 'decode',
              name,
              result: 'failed',
              error: String(error),
            }),
          )
          this.buffers.set(name, decoded)
        }
        for (const role of [
          'press',
          'hover',
          'back',
          'ripple',
          'buddy',
        ] as const) {
          const ids = audioBank
            .filter((item) => item.role === role)
            .map((item) => item.id)
          void Promise.allSettled(ids.map((id) => this.buffers.get(id)!)).then(
            () => {
              if (this.disposed || ctx !== this.context) return
              const eligible = ids.filter((id) => this.decoded.has(id))
              if (eligible.length >= 2)
                this.bags.set(role, new NoRepeatBag(eligible))
              this.journal({
                type: 'bank',
                role,
                eligible,
                rejected: ids.filter((id) => !this.decoded.has(id)),
              })
            },
          )
        }
      }
      if (this.context.state === 'suspended')
        void this.context.resume().catch(() => this.retireAll())
      this.onUnlocked(this.unlocked)
      this.syncBeds()
    } catch {
      const context = this.context
      if (context) {
        context.onstatechange = null
        void context.close().catch(() => {})
      }
      this.context = null
      this.master = null
      this.sfx = null
      this.ambience = null
      this.voices.clear()
      this.beds.clear()
      this.retiringBeds.clear()
      this.buffers.clear()
      this.decoded.clear()
      this.bags.clear()
      this.decodeStarted = false
      this.epoch++
      this.bedEpoch++
      this.onUnlocked(false)
    }
  }
  setScene(scene: AudioScene) {
    if (this.scene === scene) return
    this.scene = scene
    if (scene !== 'intro') this.stopIntroCharge()
    this.bedEpoch++
    this.syncBeds()
  }
  begin(token: number) {
    if (this.token === token) return
    this.retireSfx()
    this.token = token
    this.phases.clear()
    this.play('activate', token)
  }
  phase(token: number, phase: ResourcePhase) {
    if (token !== this.token || this.phases.has(phase)) return
    this.phases.add(phase)
    // Explore already supplied the press; cover never adds a second cue.
    if (phase !== 'cover') this.play(phase, token)
    if (phase === 'settle')
      for (const bed of this.beds.values()) this.fadeBed(bed, 0, 0.3)
  }
  playRipple(id: number) {
    this.play('ripple', undefined, id)
  }
  playIntroSnap(id: number) {
    this.play('snap', undefined, id)
  }
  startIntroCharge() {
    this.stopIntroCharge()
    const ctx = this.context,
      pending = this.buffers.get(chargeName)
    if (
      !ctx ||
      !pending ||
      !this.sfx ||
      this.disposed ||
      !this.enabled ||
      !this.volume ||
      document.hidden ||
      this.scene !== 'intro'
    )
      return
    const epoch = this.chargeEpoch,
      requestedAt = ctx.currentTime
    void Promise.all([pending, ctx.state === 'running' ? Promise.resolve() : ctx.resume()])
      .then(([buffer]) => {
        // Decode/unlock completion may never revive a released gesture.
        if (
          epoch !== this.chargeEpoch ||
          ctx !== this.context ||
          ctx.state !== 'running' ||
          this.disposed ||
          !this.enabled ||
          !this.volume ||
          document.hidden ||
          this.scene !== 'intro' ||
          !this.sfx
        )
          return
        const source = ctx.createBufferSource(),
          gain = ctx.createGain(),
          filter = ctx.createBiquadFilter()
        const start = Math.max(ctx.currentTime, requestedAt + INTRO_HOLD_SECONDS)
        source.buffer = buffer
        source.loop = true
        filter.type = 'lowpass'
        filter.Q.value = 0.5
        filter.frequency.setValueAtTime(900, start)
        filter.frequency.exponentialRampToValueAtTime(4600, start + 1.8)
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.035, start + 0.06)
        gain.gain.exponentialRampToValueAtTime(0.25, start + 1.8)
        source.connect(filter).connect(gain).connect(this.sfx)
        const voice = { source, gain }
        this.charge = voice
        source.onended = () => {
          if (this.charge === voice) this.charge = null
          source.disconnect()
          filter.disconnect()
          gain.disconnect()
        }
        source.start(start)
        this.journal({ type: 'charge', state: 'scheduled', name: chargeName, start, epoch })
      })
      .catch(error => this.journal({ type: 'drop', cue: 'charge', reason: 'decode-or-unlock-failed', error: String(error) }))
  }
  stopIntroCharge() {
    this.chargeEpoch++
    if (!this.charge) return
    const voice = this.charge
    this.charge = null
    this.stopVoice(voice, 0.045)
    this.journal({ type: 'charge', state: 'stopped', epoch: this.chargeEpoch })
  }
  play(cue: SoundCue, token?: number, effectId?: number) {
    const at = performance.now()
    const drop = (reason: string) =>
      this.journal({ type: 'drop', cue, token, effectId, reason })
    const ctx = this.context
    if (document.hidden) return drop('hidden-document')
    if (this.disposed || !this.enabled || !this.volume)
      return drop('retired-or-muted')
    if (!ctx || ctx.state !== 'running' || !this.sfx)
      return drop('locked-context')
    if (token !== undefined && token !== this.token) return drop('stale-epoch')
    if (
      effectId !== undefined &&
      (!Number.isSafeInteger(effectId) || effectId <= (cue === 'snap' ? this.lastSnapId : this.lastRippleId))
    )
      return drop('duplicate-or-invalid-effect')
    const role: Role =
      cue === 'buddy'
        ? 'buddy'
        : cue === 'cancel'
          ? 'back'
          : cue === 'hover'
            ? 'hover'
            : cue === 'ripple' || cue === 'snap'
              ? 'ripple'
              : 'press'
    const transition = cue === 'resolve' || cue === 'settle'
    const fixedName = cue === 'snap' ? snapName : transition ? 'transition-soft' : null
    const bag = this.bags.get(role)
    if (fixedName ? !this.decoded.has(fixedName) : !bag)
      return drop('unresolved-or-rejected-decode')
    if (token === undefined && role !== 'ripple') {
      if (
        at - (role === 'hover' ? this.lastHover : this.lastUI) <
        (role === 'hover' ? 150 : 80)
      )
        return drop('rate-limit')
    }
    if (role !== 'hover') this.retireHover()
    // Only admitted events advance a persistent role bag. Decode completion never
    // queues an expired gesture, and dropping an event consumes no identity.
    let delay = Math.max(0, this.admitAfter - ctx.currentTime)
    if (delay > 0.025) return drop('stale-event')
    if (this.voices.size >= 4) {
      // UI hovering cannot clip a protected release cue. Prefer retiring an
      // incidental UI voice; four live ripple voices decline extra sounds.
      const disposable = [...this.voices].find(
        (voice) => voice.role !== 'ripple',
      )
      if (!disposable) return drop('protected-voice-budget')
      this.stopVoice(disposable, 0.008)
      delay = Math.max(delay, 0.008)
      this.journal({ type: 'retire', reason: 'voice-budget' })
    }
    const name = fixedName ?? bag!.next()
    if (effectId !== undefined) {
      if (cue === 'snap') this.lastSnapId = effectId
      else this.lastRippleId = effectId
    }
    if (role === 'hover') this.lastHover = at
    else if (role !== 'ripple') this.lastUI = at
    const source = ctx.createBufferSource(),
      gain = ctx.createGain()
    source.buffer = this.decoded.get(name)!
    gain.gain.value = cue === 'snap' ? 0.18 : transition ? 0.12 : roleGain[role]
    source.connect(gain).connect(this.sfx)
    const voice = { source, gain, role }
    this.voices.add(voice)
    source.onended = () => {
      this.voices.delete(voice)
      source.disconnect()
      gain.disconnect()
    }
    source.start(ctx.currentTime + delay)
    this.journal({
      type: 'sfx',
      name,
      cue,
      role,
      token,
      rippleId: cue === 'ripple' ? effectId : undefined,
      snapId: cue === 'snap' ? effectId : undefined,
      pcmHash: audioBank.find((item) => item.id === name)?.pcmHash,
      voices: this.voices.size,
      eventTime: at,
      scheduledDelayMs: delay * 1000,
      roleGain: gain.gain.value,
    })
  }
  retireHover() {
    for (const voice of this.voices)
      if (voice.role === 'hover') this.stopVoice(voice, 0.02)
  }
  private stopVoice(voice: Voice, tail = 0.02) {
    const ctx = this.context
    if (!ctx) return
    hold(voice.gain.gain, ctx.currentTime)
    voice.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + tail)
    voice.source.stop(ctx.currentTime + tail)
    this.voices.delete(voice)
  }
  retireSfx(token?: number) {
    if (token !== undefined && token !== this.token) return
    this.stopIntroCharge()
    this.epoch++
    if (this.context && this.voices.size)
      this.admitAfter = Math.max(
        this.admitAfter,
        this.context.currentTime + 0.02,
      )
    for (const voice of this.voices) this.stopVoice(voice)
  }
  private fadeBed(bed: Bed, level: number, duration: number) {
    const ctx = this.context!
    const param = bed.gain.gain
    hold(param, ctx.currentTime)
    const start = param.value
    // Piecewise equal-power ramps avoid Firefox's non-cancellable active
    // setValueCurve event. Every retarget can hold and replace future ramps.
    param.setValueAtTime(start, ctx.currentTime)
    for (let i = 1; i <= 64; i++) {
      const angle = ((i / 64) * Math.PI) / 2
      const value =
        level > start
          ? start + (level - start) * Math.sin(angle)
          : level + (start - level) * Math.cos(angle)
      param.linearRampToValueAtTime(
        value,
        ctx.currentTime + (duration * i) / 64,
      )
    }
  }
  private syncBeds() {
    const ctx = this.context
    if (
      !ctx ||
      ctx.state !== 'running' ||
      !this.ambience ||
      !this.enabled ||
      !this.volume ||
      document.hidden ||
      this.disposed
    )
      return
    const id =
      this.scene === 'intro'
        ? 'intro-bed'
        : this.scene === 'world'
          ? null
          : 'selection-bed'
    const level = this.scene === 'loading' ? 0.07 : 0.22,
      epoch = this.bedEpoch
    for (const [key, bed] of this.beds) {
      if (key === id) this.fadeBed(bed, level, 0.35)
      else {
        this.fadeBed(bed, 0, 1.4)
        this.offsets.set(key, this.bedOffset(bed, 1.4))
        bed.source.stop(ctx.currentTime + 1.4)
        this.retiringBeds.add(bed)
        this.beds.delete(key)
      }
    }
    if (!id || this.beds.has(id)) return
    const pending = this.buffers.get(id)
    if (!pending) return
    void pending
      .then((buffer) => {
        if (
          epoch !== this.bedEpoch ||
          this.beds.has(id) ||
          !this.enabled ||
          !this.volume ||
          document.hidden ||
          this.disposed ||
          ctx.state !== 'running'
        )
          return
        let delay = Math.max(0, this.bedsAdmitAfter - ctx.currentTime)
        for (const retired of this.retiringBeds) {
          if (retired.id === id) {
            this.offsets.set(id, this.bedOffset(retired))
            this.stopVoice(retired, 0.008)
            this.retiringBeds.delete(retired)
            delay = Math.max(delay, 0.008)
          }
        }
        for (const retired of this.retiringBeds) {
          if (this.beds.size + this.retiringBeds.size < 2) break
          this.stopVoice(retired, 0.008)
          this.retiringBeds.delete(retired)
          delay = Math.max(delay, 0.008)
        }
        const source = ctx.createBufferSource(),
          gain = ctx.createGain()
        source.buffer = buffer
        source.loop = true
        gain.gain.value = 0
        source.connect(gain).connect(this.ambience!)
        const bed = {
          source,
          gain,
          id,
          offset: (this.offsets.get(id) ?? 0) % buffer.duration,
          started: ctx.currentTime + delay,
        }
        this.beds.set(id, bed)
        source.onended = () => {
          this.retiringBeds.delete(bed)
          source.disconnect()
          gain.disconnect()
        }
        source.start(ctx.currentTime + delay, bed.offset)
        this.fadeBed(bed, level, 1.4)
        this.journal({
          type: 'bed',
          id,
          offset: bed.offset,
          duration: buffer.duration,
          scene: this.scene,
        })
      })
      .catch(() => {})
  }
  private bedOffset(bed: Bed, tail = 0) {
    // A just-scheduled source may not have started yet. Such a retirement
    // preserves its original offset rather than storing a negative seek.
    return (
      (bed.offset +
        Math.max(0, this.context!.currentTime - bed.started) +
        tail) %
      bed.source.buffer!.duration
    )
  }
  retireAll() {
    this.retireSfx()
    this.bedEpoch++
    const ctx = this.context
    if (ctx && (this.beds.size || this.retiringBeds.size))
      this.bedsAdmitAfter = Math.max(
        this.bedsAdmitAfter,
        ctx.currentTime + 0.02,
      )
    for (const [id, bed] of this.beds) {
      if (ctx) this.offsets.set(id, this.bedOffset(bed))
      this.stopVoice(bed)
    }
    for (const bed of this.retiringBeds) {
      if (ctx) this.offsets.set(bed.id, this.bedOffset(bed))
      this.stopVoice(bed)
    }
    this.beds.clear()
    this.retiringBeds.clear()
  }
  visibility() {
    if (document.hidden) this.retireAll()
    else this.syncBeds()
  }
  private journal(detail: Record<string, unknown>) {
    window.dispatchEvent(
      new CustomEvent('portfolio-audio', {
        detail: { ...detail, at: this.context?.currentTime },
      }),
    )
  }
  dispose() {
    this.disposed = true
    this.retireAll()
    this.abort.abort()
    if (this.context) {
      this.context.onstatechange = null
      void this.context.close().catch(() => {})
    }
  }
}
