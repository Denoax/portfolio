import { useLayoutEffect, useRef } from 'react'
import { gaitPoses } from './runnerPoses'
// A single endpoint integrates its gait phase. Retargeting rate never multiplies
// total elapsed time, and suspended/hidden time never accumulates strides.
export function Runner({
  running,
  speed,
  kind = 'run',
}: {
  running: boolean
  speed: number
  kind?: 'walk' | 'run'
}) {
  const root = useRef<HTMLSpanElement>(null),
    body = useRef<SVGPathElement>(null),
    head = useRef<SVGCircleElement>(null)
  const phaseRef = useRef(0),
    rateRef = useRef(speed),
    state = useRef({ running, speed })
  state.current = { running, speed }
  useLayoutEffect(() => {
    let alive = true,
      last = 0,
      raf = 0,
      phase = phaseRef.current,
      rate = rateRef.current
    const poses = gaitPoses[kind]
    let previousPose = -1
    const bodyNode = body.current!,
      headNode = head.current!,
      rootNode = root.current!
    const draw = (now: number) => {
      if (!alive) return
      const dt =
        last && !document.hidden
          ? Math.max(0, Math.min(0.05, (now - last) / 1000))
          : 0
      last = now
      const active = state.current.running && !document.hidden
      if (active) {
        rate += (state.current.speed - rate) * (1 - Math.exp(-dt / 0.15))
        phase =
          (phase +
            (dt / (kind === 'walk' ? 0.6667 : 0.7833)) *
              Math.max(0.72, Math.min(1.65, Math.sqrt(rate)))) %
          1
        phaseRef.current = phase
        rateRef.current = rate
      }
      const index = Math.floor(phase * poses.length) % poses.length
      // The native study supplies 40/47 consecutive outlines. Preserve inner
      // limbs and contact/flight topology at its measured pose cadence instead
      // of morphing unrelated contours into a featureless silhouette.
      if (index !== previousPose) {
        const pose = poses[index]
        bodyNode.setAttribute('d', pose.body)
        headNode.setAttribute('cx', String(pose.head[0]))
        headNode.setAttribute('cy', String(pose.head[1]))
        headNode.setAttribute('r', String(pose.head[2]))
        previousPose = index
      }
      rootNode.dataset.phase = String(phase)
      rootNode.dataset.running = String(active)
      if (active) raf = requestAnimationFrame(draw)
    }
    draw(performance.now())
    const visibility = () => {
      last = 0
      cancelAnimationFrame(raf)
      draw(performance.now())
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [running, kind])
  const pose = gaitPoses[kind][0]
  return (
    <span className="auto-runner" ref={root} aria-hidden="true">
      <svg
        viewBox="0 0 300 300"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          ref={head}
          cx={pose.head[0]}
          cy={pose.head[1]}
          r={pose.head[2]}
        />
        <path ref={body} fill="currentColor" fillRule="evenodd" stroke="none" />
      </svg>
    </span>
  )
}
