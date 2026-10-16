import savedCalendar from '../content/activityCalendar.json'
import savedPushes from '../content/activityPushes.json'
export interface Contribution {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}
export interface ActivityCalendar {
  username: 'Denoax'
  fetched_at_utc: string
  source_url: string
  range_start: string
  range_end: string
  total: number
  contributions: Contribution[]
}
export interface RecentPushes {
  fetched_at_utc: string
  range_start: string | null
  range_end: string | null
  label: string
  repos: { full_name: string; push_event_count: number; href: string }[]
}
export type DataState =
  | 'loading'
  | 'verified-current'
  | 'verified-stale'
  | 'empty-success'
  | 'unavailable'
export interface ActivityData {
  calendar: ActivityCalendar | null
  pushes: RecentPushes | null
  calendarState: DataState
  pushState: DataState
  issue: string
}
const DAY = 86400000
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Activity response must be an object')
  return value as Record<string, unknown>
}
function dateKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value
  )
    throw Error('Invalid activity date')
  return value
}
export function validateCalendar(
  value: unknown,
  today = new Date().toISOString().slice(0, 10),
): ActivityCalendar {
  const r = record(value),
    start = dateKey(r.range_start),
    end = dateKey(r.range_end)
  if (
    r.username !== 'Denoax' ||
    end > today ||
    start > end ||
    !Array.isArray(r.contributions) ||
    typeof r.fetched_at_utc !== 'string' ||
    !Number.isFinite(Date.parse(r.fetched_at_utc)) ||
    typeof r.source_url !== 'string' ||
    !r.source_url.startsWith('https://github.com/users/Denoax/contributions')
  )
    throw Error('Calendar identity/range/source is invalid')
  let sum = 0
  const contributions = r.contributions.map((item, index) => {
    const day = record(item),
      date = dateKey(day.date),
      count = day.count,
      level = day.level
    if (
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 0 ||
      typeof level !== 'number' ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > 4 ||
      (count === 0) !== (level === 0) ||
      date !==
        new Date(Date.parse(start + 'T00:00:00Z') + index * DAY)
          .toISOString()
          .slice(0, 10)
    )
      throw Error('Calendar must have contiguous, valid observed days')
    sum += count
    return { date, count, level: level as Contribution['level'] }
  })
  if (
    contributions.length !== (Date.parse(end) - Date.parse(start)) / DAY + 1 ||
    sum !== r.total
  )
    throw Error('Calendar range or total disagrees with its days')
  return {
    username: 'Denoax',
    fetched_at_utc: r.fetched_at_utc,
    source_url: r.source_url,
    range_start: start,
    range_end: end,
    total: sum,
    contributions,
  }
}
export function validatePushes(value: unknown): RecentPushes {
  const r = record(value)
  if (
    r.label !== 'Recent public pushes' ||
    typeof r.fetched_at_utc !== 'string' ||
    !Number.isFinite(Date.parse(r.fetched_at_utc)) ||
    !Array.isArray(r.repos)
  )
    throw Error('Recent pushes response is invalid')
  const range_start = r.range_start === null ? null : String(r.range_start),
    range_end = r.range_end === null ? null : String(r.range_end)
  if (
    r.repos.length &&
    (!range_start ||
      !range_end ||
      !Number.isFinite(Date.parse(range_start)) ||
      Date.parse(range_start) > Date.parse(range_end))
  )
    throw Error('Push sample range is invalid')
  const seen = new Set<string>()
  const repos = r.repos
    .map((item) => {
      const row = record(item),
        name = row.full_name,
        count = row.push_event_count
      if (
        typeof name !== 'string' ||
        !/^Denoax\/[A-Za-z0-9_.-]+$/.test(name) ||
        seen.has(name) ||
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count < 1 ||
        row.href !== `https://github.com/${name}`
      )
        throw Error('Push sample row is invalid')
      seen.add(name)
      return {
        full_name: name,
        push_event_count: count,
        href: row.href as string,
      }
    })
    .sort((a, b) => b.push_event_count - a.push_event_count)
  return {
    fetched_at_utc: r.fetched_at_utc,
    range_start,
    range_end,
    label: 'Recent public pushes',
    repos,
  }
}
function freshness(
  fetched: string,
  empty: boolean,
  forcedStale = false,
): DataState {
  return forcedStale || Date.now() - Date.parse(fetched) > 2 * DAY
    ? 'verified-stale'
    : empty
      ? 'empty-success'
      : 'verified-current'
}
export async function loadActivity(signal: AbortSignal): Promise<ActivityData> {
  const fetchData = async (url: string) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw Error(`${url}: HTTP ${response.status}`)
    return response.json() as Promise<unknown>
  }
  const results = await Promise.allSettled([
    fetchData('/assets/activity/calendar.json').then((v) =>
      validateCalendar(v),
    ),
    fetchData('/assets/activity/recent-pushes.json').then(validatePushes),
  ])
  if (signal.aborted)
    throw new DOMException('Activity request cancelled', 'AbortError')
  const calendar =
    results[0].status === 'fulfilled'
      ? results[0].value
      : validateCalendar(savedCalendar)
  const pushes =
    results[1].status === 'fulfilled'
      ? results[1].value
      : validatePushes(savedPushes)
  return {
    calendar,
    pushes,
    calendarState: freshness(
      calendar.fetched_at_utc,
      calendar.total === 0,
      results[0].status === 'rejected',
    ),
    pushState: freshness(
      pushes.fetched_at_utc,
      !pushes.repos.length,
      results[1].status === 'rejected',
    ),
    issue: results.some((r) => r.status === 'rejected')
      ? 'Live snapshot unavailable. Showing the last verified dated data.'
      : '',
  }
}
export function calendarWeeks(
  days: readonly Contribution[],
): (Contribution | null)[][] {
  if (!days.length) return []
  const padding = new Date(days[0].date + 'T00:00:00Z').getUTCDay()
  const slots: (Contribution | null)[] = [
    ...Array.from({ length: padding }, () => null),
    ...days,
  ]
  while (slots.length % 7) slots.push(null)
  const weeks: (Contribution | null)[][] = []
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7))
  return weeks
}
