export function createReelSnapTracker() {
  return {
    candidate: -1,
    since: 0,
    top: NaN,
    rendered: NaN,
    at: NaN,
    nativeError: Infinity,
    renderedError: Infinity,
  }
}

// Native alignment and displayed motion both have to settle. scrollend alone
// cannot establish that the independently eased WebGL panel has arrived.
export function updateReelSnap(
  tracker: ReturnType<typeof createReelSnapTracker>,
  top: number,
  span: number,
  rendered: number,
  count: number,
  now: number,
): number | null {
  const index = Math.round(Math.max(0, Math.min(1, rendered)) * (count - 1))
  const normalized = index / (count - 1)
  const seconds = (now - tracker.at) / 1000
  const nativeSpeed = seconds > 0 ? Math.abs(top - tracker.top) / seconds : 0
  const displayedSpeed =
    seconds > 0 ? (Math.abs(rendered - tracker.rendered) * span) / seconds : 0
  tracker.nativeError = Math.abs(top - normalized * span)
  tracker.renderedError = Math.abs(rendered - normalized)
  tracker.top = top
  tracker.rendered = rendered
  tracker.at = now
  const stable =
    count > 1 &&
    span > 0 &&
    [top, span, rendered, now].every(Number.isFinite) &&
    tracker.nativeError <= 2 &&
    tracker.renderedError <= 0.003 &&
    nativeSpeed <= 2 &&
    displayedSpeed <= 12
  if (!stable) {
    tracker.candidate = -1
    tracker.since = now
    return null
  }
  if (tracker.candidate !== index) {
    tracker.candidate = index
    tracker.since = now
  }
  return now - tracker.since >= 100 ? index : null
}
