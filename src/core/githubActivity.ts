import savedCalendar from '../content/activityCalendar.json'
import savedProfile from '../content/githubProfile.json'
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
export interface GithubProfile {
  login: 'Denoax'
  id: 56500734
  name: string | null
  bio: string | null
  html_url: 'https://github.com/Denoax'
  avatar_url: string
  avatar_local: string
  public_repos: number
  followers: number
  following: number
  fetched_at_utc: string
  source_url: string
}
export type DataState =
  | 'loading'
  | 'verified-current'
  | 'verified-stale'
  | 'empty-success'
  | 'unavailable'
export interface ActivityData {
  calendar: ActivityCalendar | null
  profile: GithubProfile | null
  calendarState: DataState
  profileState: DataState
  issues: { calendar: string; profile: string }
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
    Date.parse(r.fetched_at_utc) > Date.now() ||
    typeof r.source_url !== 'string' ||
    new URL(r.source_url).origin !== 'https://github.com' ||
    new URL(r.source_url).pathname !== '/users/Denoax/contributions'
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
export function validateProfile(value: unknown): GithubProfile {
  const r = record(value)
  if (
    r.login !== 'Denoax' ||
    r.id !== 56500734 ||
    r.html_url !== 'https://github.com/Denoax' ||
    r.source_url !== 'https://api.github.com/users/Denoax'
  )
    throw Error('Public profile identity/source is invalid')
  if (
    typeof r.avatar_url !== 'string' ||
    new URL(r.avatar_url).origin !== 'https://avatars.githubusercontent.com' ||
    r.avatar_local !== 'github-avatar.jpg'
  )
    throw Error('Public profile avatar origin/path is invalid')
  if (
    typeof r.fetched_at_utc !== 'string' ||
    !Number.isFinite(Date.parse(r.fetched_at_utc)) ||
    Date.parse(r.fetched_at_utc) > Date.now()
  )
    throw Error('Public profile retrieval date is invalid')
  for (const name of ['name', 'bio'])
    if (
      r[name] !== null &&
      (typeof r[name] !== 'string' || (r[name] as string).length > 512)
    )
      throw Error('Public profile text is invalid')
  for (const name of ['public_repos', 'followers', 'following'])
    if (
      typeof r[name] !== 'number' ||
      !Number.isInteger(r[name]) ||
      (r[name] as number) < 0
    )
      throw Error('Public profile counts are invalid')
  return {
    login: 'Denoax',
    id: 56500734,
    html_url: 'https://github.com/Denoax',
    name: r.name as string | null,
    bio: r.bio as string | null,
    avatar_url: r.avatar_url,
    avatar_local: r.avatar_local,
    public_repos: r.public_repos as number,
    followers: r.followers as number,
    following: r.following as number,
    fetched_at_utc: r.fetched_at_utc,
    source_url: r.source_url,
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
// Bundled official snapshots paint synchronously, including an inactive card.
// One mounted profile owns one independent refresh; selection never remounts it.
export function initialActivity(): ActivityData {
  let calendar: ActivityCalendar | null = null,
    profile: GithubProfile | null = null
  const issues = { calendar: '', profile: '' }
  try {
    calendar = validateCalendar(savedCalendar)
  } catch (e) {
    issues.calendar = String(e)
  }
  try {
    profile = validateProfile(savedProfile)
  } catch (e) {
    issues.profile = String(e)
  }
  return {
    calendar,
    profile,
    issues,
    calendarState: calendar
      ? freshness(calendar.fetched_at_utc, calendar.total === 0)
      : 'unavailable',
    profileState: profile
      ? freshness(profile.fetched_at_utc, false)
      : 'unavailable',
  }
}
export async function loadActivity(signal: AbortSignal): Promise<ActivityData> {
  const initial = initialActivity()
  const fetchData = async (url: string) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw Error(`${url}: HTTP ${response.status}`)
    return response.json() as Promise<unknown>
  }
  const results = await Promise.allSettled([
    fetchData('/assets/activity/calendar.json').then((v) =>
      validateCalendar(v),
    ),
    fetchData('/assets/activity/profile.json').then(validateProfile),
  ])
  if (signal.aborted)
    throw new DOMException('Profile request cancelled', 'AbortError')
  const calendar =
    results[0].status === 'fulfilled' ? results[0].value : initial.calendar
  const profile =
    results[1].status === 'fulfilled' ? results[1].value : initial.profile
  return {
    calendar,
    profile,
    calendarState: calendar
      ? freshness(
          calendar.fetched_at_utc,
          calendar.total === 0,
          results[0].status === 'rejected',
        )
      : 'unavailable',
    profileState: profile
      ? freshness(
          profile.fetched_at_utc,
          false,
          results[1].status === 'rejected',
        )
      : 'unavailable',
    issues: {
      calendar:
        results[0].status === 'rejected' ? String(results[0].reason) : '',
      profile:
        results[1].status === 'rejected' ? String(results[1].reason) : '',
    },
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
