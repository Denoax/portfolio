import type { MutableRefObject } from 'react'
import { loadingWave } from '../core/loadingWave'
export interface WaveElements {
  fill: HTMLDivElement | null
  path: SVGPathElement | null
  percent: HTMLSpanElement | null
  accessible: HTMLDivElement | null
  integer: number
}
export const emptyWaveElements = (): WaveElements => ({
  fill: null,
  path: null,
  percent: null,
  accessible: null,
  integer: -1,
})
// Presentation only: callers own the clock, polarity, focus and readiness.
export function paintProgressWave(
  nodes: WaveElements,
  width: number,
  height: number,
  p: number,
  amplitude: number,
  phase: number,
  bounce: number,
  reduced: boolean,
  polarity: number,
) {
  if (!nodes.fill || !nodes.path || !nodes.percent || !nodes.accessible) return
  nodes.fill.style.backgroundColor = `rgb(${Math.round(17 * (1 - polarity) + 238 * polarity)},${Math.round(17 * (1 - polarity) + 238 * polarity)},${Math.round(17 * (1 - polarity) + 238 * polarity)})`
  nodes.fill.style.width = `${p * 100}%`
  nodes.path.ownerSVGElement!.setAttribute('viewBox', `0 0 ${width} ${height}`)
  nodes.path.setAttribute(
    'd',
    loadingWave(width, height, p, amplitude, phase, bounce, reduced),
  )
  nodes.path.style.strokeWidth = `${Math.max(4, height * 0.013)}px`
  const integer = Math.floor(p * 100)
  if (integer !== nodes.integer) {
    nodes.percent.textContent = String(integer)
    nodes.accessible.setAttribute('aria-valuenow', String(integer))
    nodes.integer = integer
  }
}
export function ProgressWave({
  nodes,
  label,
}: {
  nodes: MutableRefObject<WaveElements>
  label: string
}) {
  return (
    <>
      <div
        className="intro-progress-fill"
        ref={(n) => {
          nodes.current.fill = n
        }}
        aria-hidden="true"
      />
      <div className="intro-progress-number" aria-hidden="true">
        <span
          ref={(n) => {
            nodes.current.percent = n
          }}
        >
          0
        </span>
        <span>%</span>
      </div>
      <div
        ref={(n) => {
          nodes.current.accessible = n
        }}
        className="sr-only"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      />
      <svg aria-hidden="true">
        <path
          ref={(n) => {
            nodes.current.path = n
          }}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    </>
  )
}
export function ProgressActionIcon({ paused }: { paused: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paused ? (
        <path d="M32 15A13 13 0 0 0 8 12L5 17M5 8V17H14M8 25A13 13 0 0 0 32 28L35 23M35 32V23H26" />
      ) : (
        <>
          <circle cx="20" cy="20" r="16" />
          <path d="M16 15V25M24 15V25" />
        </>
      )}
    </svg>
  )
}
