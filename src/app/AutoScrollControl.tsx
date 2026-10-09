import { useEffect, useId, useRef } from 'react'
import { Runner } from './Runner'
import { AnimatedCounter } from './rare/SpeedCounter'
import { quantizeAutoSpeed } from '../core/experienceSettings'
// Ruler proportions/overlay adapted from the pinned Rare UI counter demo.
export function AutoScrollControl({
  running,
  suspended = false,
  onToggle,
  speed,
  onSpeed,
  onCommit,
  label = 'Auto-scroll',
  reduced = false,
}: {
  running: boolean
  suspended?: boolean
  onToggle: () => void
  speed: number
  onSpeed: (value: number) => void
  onCommit: () => void
  label?: string
  reduced?: boolean
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    live = useRef(speed)
  live.current = speed
  // A gesture captures its starting chosen value; external Settings edits do not
  // manufacture a second dock commit. Pointer/key completion commits once.
  const editing = useRef(false),
    start = useRef(speed)
  const begin = () => {
    if (!editing.current) {
      editing.current = true
      start.current = live.current
    }
  }
  const commit = () => {
    if (editing.current && start.current !== live.current) onCommit()
    editing.current = false
  }
  useEffect(() => {
    const node = input.current
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) e.preventDefault()
    }
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [])
  const marker = Math.round(speed * 10) - 5
  const selectedKind = speed < 1.25 ? 'walk' : 'run'
  const endpoint = (kind: 'walk' | 'run') => {
    const selected = kind === selectedKind
    const preset = kind === 'walk' ? 0.5 : 2
    const action = selected
      ? running
        ? 'Stop'
        : suspended
          ? 'Resume'
          : 'Start'
      : 'Start'
    return (
      <button
        type="button"
        className="speed-endpoint"
        data-selected={selected}
        aria-label={`${action} ${kind} ${label.toLowerCase()} at ${(selected ? speed : preset).toFixed(1)} times`}
        aria-pressed={selected && running}
        onClick={() => {
          if (selected) onToggle()
          else {
            onSpeed(preset)
            // Starting already has its auto cue; a running gait switch commits
            // only the new rate so one action does not admit two click sounds.
            if (running) onCommit()
            else onToggle()
          }
        }}
      >
        <span className="speed-body" data-glass-lens="runner">
          <Runner
            kind={kind}
            running={selected && running && !reduced}
            speed={speed}
          />
        </span>
      </button>
    )
  }
  return (
    <div className="auto-scroll-group speed-ruler">
      {endpoint('walk')}
      <div className="speed-readout">
        <AnimatedCounter
          value={speed}
          decimals={1}
          separator=""
          suffix="×"
          duration={0.4}
          reduced={reduced}
          aria-hidden="true"
        />
        <div className="speed-ticks">
          <div className="speed-tick-row" aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <span
                key={i}
                data-level={i + 5}
                data-selected={i === marker}
                data-passed={i < marker}
              />
            ))}
          </div>
          <label htmlFor={id} className="sr-only">
            {label} speed
          </label>
          <input
            ref={input}
            id={id}
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={speed}
            aria-label={`${label} speed`}
            aria-valuetext={`${speed.toFixed(1)} times`}
            onChange={(e) => {
              begin()
              onSpeed(quantizeAutoSpeed(e.target.valueAsNumber))
            }}
            onPointerDown={begin}
            onPointerUp={commit}
            onPointerCancel={() => {
              editing.current = false
            }}
            onKeyDown={begin}
            onKeyUp={commit}
            onBlur={commit}
          />
        </div>
      </div>
      {endpoint('run')}
    </div>
  )
}
