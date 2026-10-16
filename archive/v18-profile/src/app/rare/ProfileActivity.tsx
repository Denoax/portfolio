// Copyright (c) 2026 Swami Malode. Adapted RareUI GitHub Activity, pin b4de46e.
// MIT + Commons Clause + Attribution: /assets/notices/rareui-license.txt.
// Presentation retains the source's footer/layout springs. Data is a verified
// dated adapter; demo fallback, annual repo claims and cross-origin fetch removed.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { calendarWeeks, loadActivity } from '../../core/githubActivity'
import type { ActivityData, Contribution } from '../../core/githubActivity'
const SPRING = { type: 'spring', bounce: 0.2, duration: 0.62 } as const
const HEADER = { ...SPRING, bounce: 0.45 } as const
const ROW = { ...SPRING, bounce: 0.26, delay: 0.08 } as const
const EASE = [0.22, 1, 0.36, 1] as const
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
}: {
  active: boolean
  reduced: boolean
}) {
  const [data, setData] = useState<ActivityData>({
    calendar: null,
    pushes: null,
    calendarState: 'loading',
    pushState: 'loading',
    issue: '',
  })
  const [open, setOpen] = useState(false),
    [width, setWidth] = useState(0),
    [focused, setFocused] = useState(''),
    [tip, setTip] = useState<Contribution | null>(null)
  const node = useRef<HTMLDivElement>(null),
    uid = useId()
  useEffect(() => {
    const abort = new AbortController()
    void loadActivity(abort.signal).then(setData, (error) => {
      if (!abort.signal.aborted)
        setData({
          calendar: null,
          pushes: null,
          calendarState: 'unavailable',
          pushState: 'unavailable',
          issue: String(error),
        })
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
  const all = data.calendar?.contributions ?? []
  const narrow = width > 0 && width < 430
  const days = useMemo(
    () =>
      narrow
        ? all.filter(
            (day) =>
              day.date >=
              `${data.calendar?.range_end.slice(0, 4)}-${String(Math.max(1, Number(data.calendar?.range_end.slice(5, 7)) - 5)).padStart(2, '0')}-01`,
          )
        : all,
    [all, narrow, data.calendar?.range_end],
  )
  const weeks = useMemo(() => calendarWeeks(days), [days])
  const flat = days
  const total = days.reduce((sum, d) => sum + d.count, 0),
    start = days[0]?.date,
    end = days.at(-1)?.date
  const heading =
    start && end
      ? `${total} contributions · ${month.format(new Date(start + 'T00:00:00Z'))}–${month.format(new Date(end + 'T00:00:00Z'))} ${end.slice(0, 4)}`
      : 'Public activity'
  const repos = data.pushes?.repos.slice(0, 3) ?? [],
    transition = reduced || !active ? { duration: 0 } : SPRING
  const avatar = (name: string, index: number) => (
    <motion.span
      className="activity-avatar"
      layoutId={`${uid}-avatar-${index}`}
      transition={transition}
    >
      {name.split('/')[1].charAt(0)}
    </motion.span>
  )
  const cellKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    day: Contribution,
  ) => {
    const i = flat.findIndex((d) => d.date === day.date)
    const delta: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowLeft: -7,
      ArrowRight: 7,
      Home: -i,
      End: flat.length - 1 - i,
    }
    if (event.key in delta) {
      event.preventDefault()
      const next =
        flat[Math.max(0, Math.min(flat.length - 1, i + delta[event.key]))]
      setFocused(next.date)
      node.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${next.date}"]`)
        ?.focus({ preventScroll: true })
    } else if (event.key === 'Escape') setTip(null)
  }
  return (
    <div
      ref={node}
      className="profile-activity"
      data-slot="github-activity"
      data-calendar-state={data.calendarState}
      data-push-state={data.pushState}
    >
      <motion.div
        className="activity-calendar"
        animate={{
          opacity: open ? 0.18 : 1,
          filter: open && !reduced ? 'blur(2px)' : 'blur(0px)',
        }}
        transition={transition}
      >
        <h2>{heading}</h2>
        <p className="activity-date">
          {data.calendar
            ? `${data.calendarState === 'verified-stale' ? 'Last verified' : 'Verified'} ${data.calendar.fetched_at_utc.slice(0, 10)} · publicly visible calendar`
            : data.calendarState === 'loading'
              ? 'Loading verified calendar…'
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
                    <motion.button
                      type="button"
                      role="gridcell"
                      key={day.date}
                      data-date={day.date}
                      data-level={day.level}
                      aria-label={describe(day)}
                      tabIndex={
                        (!focused && day === days[0]) || focused === day.date
                          ? 0
                          : -1
                      }
                      onFocus={() => {
                        setFocused(day.date)
                        setTip(day)
                      }}
                      onBlur={() => setTip(null)}
                      onPointerEnter={() => setTip(day)}
                      onPointerLeave={() => setTip(null)}
                      onClick={() => setTip(day)}
                      onKeyDown={(e) => cellKey(e, day)}
                      initial={reduced ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.2,
                        ease: EASE,
                        delay: reduced ? 0 : index * 0.012,
                      }}
                    />
                  ) : (
                    <span
                      className="activity-padding"
                      key={`pad-${j}`}
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
      <AnimatePresence>
        {tip && !open && (
          <motion.p
            className="activity-tooltip"
            role="tooltip"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.14 }}
          >
            {describe(tip)}
          </motion.p>
        )}
      </AnimatePresence>
      {data.pushes ? (
        <motion.div
          layout
          className="activity-footer"
          data-state={open ? 'open' : 'closed'}
          style={{ borderRadius: 18 }}
          transition={transition}
        >
          <motion.div
            layout="position"
            className="activity-footer-heading"
            transition={reduced ? { duration: 0 } : HEADER}
          >
            <span>Recent public pushes</span>
            <div>
              {!open && (
                <span className="activity-stack">
                  {repos.map((r, i) => avatar(r.full_name, i))}
                </span>
              )}
              <button
                type="button"
                aria-label={
                  open ? 'Hide recent repositories' : 'Show recent repositories'
                }
                aria-expanded={open}
                aria-controls={`${uid}-repos`}
                onClick={() => {
                  setOpen(!open)
                  setTip(null)
                }}
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={transition}
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m16 10-4 4-4-4" />
                </motion.svg>
              </button>
            </div>
          </motion.div>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={`${uid}-repos`}
                initial={reduced ? false : { opacity: 0, x: 16, y: 16 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 16, y: 16 }}
                transition={reduced ? { duration: 0 } : ROW}
              >
                <p className="activity-sample">
                  {data.pushState === 'verified-stale'
                    ? 'Last verified sample · '
                    : ''}
                  {data.pushes.range_start?.slice(0, 10)} –{' '}
                  {data.pushes.range_end?.slice(0, 10)} · push events
                </p>
                {repos.length ? (
                  repos.map((r, i) => (
                    <a
                      className="activity-repo"
                      key={r.full_name}
                      href={r.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {avatar(r.full_name, i)}
                      <span>{r.full_name.split('/')[1]}</span>
                      <span>{r.push_event_count}</span>
                    </a>
                  ))
                ) : (
                  <p className="activity-sample">
                    No public pushes in this verified sample.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <p className="activity-unavailable">
          Recent push sample{' '}
          {data.pushState === 'loading' ? 'loading…' : 'unavailable'}
        </p>
      )}
      {data.issue && (
        <p className="activity-issue" role="status">
          {data.issue}
        </p>
      )}
    </div>
  )
}
