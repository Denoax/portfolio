// Copyright (c) 2026 Swami Malode. Adapted RareUI GitHub Activity, pin b4de46e.
// MIT + Commons Clause + Attribution: /assets/notices/rareui-license.txt.
// The calendar and tooltip retain the source's geometry. Official profile and
// calendar snapshots paint before refresh; selection does not restart them.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  calendarWeeks,
  initialActivity,
  loadActivity,
} from '../../core/githubActivity'
import type { ActivityData, Contribution } from '../../core/githubActivity'
const formatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const month = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  timeZone: 'UTC',
})
const describe = (day: Contribution) =>
  `${day.count} ${day.count === 1 ? 'contribution' : 'contributions'} on ${formatter.format(new Date(day.date + 'T00:00:00Z'))}`
export function ProfileActivity({
  active,
  reduced,
  onProfile,
}: {
  active: boolean
  reduced: boolean
  onProfile: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const [data, setData] = useState<ActivityData>(initialActivity)
  const [width, setWidth] = useState(0),
    [focused, setFocused] = useState(''),
    [tip, setTip] = useState<Contribution | null>(null)
  const node = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const abort = new AbortController()
    void loadActivity(abort.signal).then(setData, (error) => {
      if (!abort.signal.aborted)
        setData((previous) => ({
          ...previous,
          calendarState: previous.calendar ? 'verified-stale' : 'unavailable',
          profileState: previous.profile ? 'verified-stale' : 'unavailable',
          issues: { calendar: String(error), profile: String(error) },
        }))
    })
    return () => abort.abort()
  }, [])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    if (node.current) observer.observe(node.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!active) setTip(null)
  }, [active])
  const narrow = width > 0 && width < 430
  const days = useMemo(() => {
    const all = data.calendar?.contributions ?? []
    if (!narrow || !data.calendar) return all
    const start = new Date(data.calendar.range_end + 'T00:00:00Z')
    start.setUTCDate(1)
    start.setUTCMonth(start.getUTCMonth() - 5)
    return all.filter((day) => day.date >= start.toISOString().slice(0, 10))
  }, [data.calendar, narrow])
  const weeks = useMemo(() => calendarWeeks(days), [days])
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const start = days[0]?.date,
    end = days.at(-1)?.date
  const heading =
    start && end
      ? `${total} contributions · ${month.format(new Date(start + 'T00:00:00Z'))}${start.slice(0, 4) !== end.slice(0, 4) ? ' ' + start.slice(0, 4) : ''}–${month.format(new Date(end + 'T00:00:00Z'))} ${end.slice(0, 4)}`
      : 'Public activity'
  const cellKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    day: Contribution,
  ) => {
    const i = days.findIndex((d) => d.date === day.date)
    const delta: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowLeft: -7,
      ArrowRight: 7,
      Home: -i,
      End: days.length - 1 - i,
    }
    if (event.key in delta) {
      event.preventDefault()
      const next =
        days[Math.max(0, Math.min(days.length - 1, i + delta[event.key]))]
      setFocused(next.date)
      node.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${next.date}"]`)
        ?.focus({ preventScroll: true })
    } else if (event.key === 'Escape') setTip(null)
  }
  const profile = data.profile
  return (
    <div
      ref={node}
      className="profile-activity"
      data-slot="github-activity"
      data-calendar-state={data.calendarState}
      data-profile-state={data.profileState}
    >
      <div className="github-profile" data-glass-substrate>
        {profile && (
          <img
            className="github-avatar"
            src={`/assets/activity/${profile.avatar_local}`}
            width="40"
            height="40"
            alt={`${profile.name ?? profile.login}'s public GitHub avatar`}
          />
        )}
        <div className="github-identity">
          <h2>
            {profile?.name ?? '@Denoax'} <span>@Denoax</span>
          </h2>
          {profile?.bio && <p>{profile.bio}</p>}
          <a href="https://github.com/Denoax" onClick={onProfile}>
            Open GitHub profile ↗
          </a>
          {data.profileState !== 'verified-current' && (
            <small>
              {profile ? 'Last verified profile' : 'Profile unavailable'}
            </small>
          )}
        </div>
      </div>
      <div className="activity-calendar">
        <h3>{heading}</h3>
        <p className="activity-date">
          {data.calendar
            ? `${data.calendarState === 'verified-stale' ? 'Last verified' : 'Verified'} ${data.calendar.fetched_at_utc.slice(0, 10)} · public calendar`
            : 'Calendar unavailable'}
        </p>
        {data.calendar && (
          <div
            className="activity-grid"
            role="grid"
            aria-label={`${heading}. ${start} through ${end}. Use arrow keys for dates.`}
            style={
              { '--activity-columns': weeks.length } as React.CSSProperties
            }
          >
            {weeks.map((week, index) => (
              <div className="activity-week" role="row" key={index}>
                <span className="activity-month" aria-hidden="true">
                  {week.find((d) => d?.date.endsWith('-01'))
                    ? month.format(
                        new Date(
                          week.find((d) => d?.date.endsWith('-01'))!.date +
                            'T00:00:00Z',
                        ),
                      )
                    : ''}
                </span>
                {week.map((day, j) =>
                  day ? (
                    <button
                      type="button"
                      role="gridcell"
                      key={day.date}
                      data-date={day.date}
                      data-level={day.level}
                      data-count={day.count}
                      aria-label={describe(day)}
                      tabIndex={
                        active &&
                        ((!focused && day === days[0]) || focused === day.date)
                          ? 0
                          : -1
                      }
                      onFocus={() => {
                        if (active) {
                          setFocused(day.date)
                          setTip(day)
                        }
                      }}
                      onBlur={() => setTip(null)}
                      onPointerEnter={() => {
                        if (active) setTip(day)
                      }}
                      onPointerLeave={() => setTip(null)}
                      onClick={() => {
                        if (active) setTip(day)
                      }}
                      onKeyDown={(e) => {
                        if (active) cellKey(e, day)
                      }}
                    />
                  ) : (
                    <span key={`empty-${j}`} className="activity-padding" />
                  ),
                )}
              </div>
            ))}
          </div>
        )}
        {data.calendarState === 'empty-success' && (
          <p className="activity-date">
            No public contributions in this observed interval.
          </p>
        )}
      </div>
      <AnimatePresence>
        {active && tip && (
          <motion.div
            className="activity-tooltip"
            role="tooltip"
            initial={reduced ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.12 }}
          >
            {describe(tip)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
