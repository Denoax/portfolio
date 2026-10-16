import { descentProgress } from './descent'
import { clamp } from './math'

// Legacy exports serve the retained, unmounted journey source only.
export const EARTH_HOLD = descentProgress(0.4)
export type Surface =
  | 'intro'
  | 'hub'
  | 'loading'
  | 'launch'
  | 'world'
  | 'returning'
export type DestinationIntent = 'launch' | 'earth' | 'pelagic'
export interface HubState {
  surface: 'intro' | 'hub'
  request: number
  notice: string
}
export type HubAction =
  | { type: 'introDone' }
  | { type: 'hub'; notice?: string }
  | { type: 'replay' }

export function hubReducer(state: HubState, action: HubAction): HubState {
  switch (action.type) {
    case 'introDone':
      return state.surface === 'intro' ? { ...state, surface: 'hub' } : state
    case 'hub':
      return {
        ...state,
        surface: 'hub',
        request: state.request + 1,
        notice: action.notice ?? '',
      }
    case 'replay':
      return state.surface === 'hub' ? { ...state, surface: 'intro' } : state
  }
}

export function parseHubRoute(
  path: string,
  hash: string,
): 'hub' | 'removed' {
  if (path !== '/' && path !== '') return 'removed'
  return !hash || ['#worlds', '#opening', '#earth', '#pelagic', '#work'].includes(hash)
    ? 'hub'
    : 'removed'
}

// Monotone cubic interpolation shares velocity at knots. Progress remains the
// protected descent parameter; this only authors the clock that visits it.
const knots = [
  [0, 0],
  [2, 0.08],
  [10, 0.38],
  [12, 0.45],
  [14, 0.52],
  [18, EARTH_HOLD],
]
const slopes = knots
  .slice(1)
  .map((k, i) => (k[1] - knots[i][1]) / (k[0] - knots[i][0]))
const tangents = knots.map((_, i) =>
  i === 0 || i === knots.length - 1
    ? 0
    : 2 / (1 / slopes[i - 1] + 1 / slopes[i]),
)
export function launchProgress(seconds: number) {
  if (seconds >= 18) return EARTH_HOLD
  const time = clamp(seconds, 0, 18)
  let i = 0
  while (i < knots.length - 2 && time > knots[i + 1][0]) i++
  const [t0, p0] = knots[i],
    [t1, p1] = knots[i + 1]
  const span = t1 - t0,
    u = (time - t0) / span
  return clamp(
    (2 * u ** 3 - 3 * u ** 2 + 1) * p0 +
      (u ** 3 - 2 * u ** 2 + u) * span * tangents[i] +
      (-2 * u ** 3 + 3 * u ** 2) * p1 +
      (u ** 3 - u ** 2) * span * tangents[i + 1],
    p0,
    p1,
  )
}
