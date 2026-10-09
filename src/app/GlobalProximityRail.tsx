// Adapted within this portfolio from Rare UI, copyright (c) 2026 Swami Malode.
// Pin b4de46e; full MIT + Commons Clause: /assets/notices/rareui-license.txt.
// Original proximity inspiration: devouringdetails.com. Routing belongs to App.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import type { MenuPresentation } from '../core/menuReel'
import { menuViews } from '../core/menuReel'
export interface RailLocation {
  id: string
  label: string
  kind: 'title' | 'section'
  hue: string
  progress?: number
}
const presets = {
  title: { base: 40, bump: 70 },
  section: { base: 30, bump: 56 },
}
function Dash({
  location,
  active,
  mouseY,
  reduced,
  onSelect,
}: {
  location: RailLocation
  active: boolean
  mouseY: MotionValue<number>
  reduced: boolean
  onSelect: (id: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null),
    preset = presets[location.kind]
  const distance = useTransform(mouseY, (y) => {
    const r = ref.current?.getBoundingClientRect()
    return r ? y - r.top - r.height / 2 : 40
  })
  const target = useTransform(
    distance,
    [-40, 0, 40],
    [preset.base / 110, (preset.base + preset.bump) / 110, preset.base / 110],
    { clamp: true },
  )
  const scale = useSpring(target, { stiffness: 320, damping: 34, mass: 0.7 })
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Go to ${location.label}`}
      title={location.label}
      aria-current={active ? 'location' : undefined}
      style={{ '--location-hue': location.hue } as CSSProperties}
      onFocus={() => {
        const r = ref.current!.getBoundingClientRect()
        mouseY.set(r.top + r.height / 2)
      }}
      onBlur={() => mouseY.set(Infinity)}
      onClick={() => onSelect(location.id)}
    >
      <motion.span
        style={{
          scaleX: reduced ? target : scale,
          transformOrigin: 'right center',
          width: 110,
          height: 1,
        }}
        aria-hidden="true"
      />
    </button>
  )
}
// Fine marks are continuous positions between real destinations, not actions.
function MinorDash({
  y,
  coordinate,
  hue,
  mouseY,
  rootY,
  scrollY,
  pose,
  reduced,
}: {
  y: number
  coordinate: number
  hue: string
  mouseY: MotionValue<number>
  rootY: MotionValue<number>
  scrollY: MotionValue<number>
  pose: MotionValue<number>
  reduced: boolean
}) {
  const distance = useTransform(
    () => mouseY.get() - (rootY.get() + y - scrollY.get()),
  )
  const target = useTransform(distance, [-40, 0, 40], [10 / 22, 1, 10 / 22], {
    clamp: true,
  })
  const scale = useSpring(target, { stiffness: 320, damping: 34, mass: 0.7 })
  const opacity = useTransform(pose, (p) =>
    coordinate < 1
      ? 0.4
      : 0.4 + 0.6 * Math.max(0, 1 - Math.abs(p - coordinate) * 2),
  )
  return (
    <motion.span
      className="rail-minor"
      aria-hidden="true"
      data-coordinate={coordinate}
      style={{
        ...({ '--minor-hue': hue } as CSSProperties),
        top: y,
        scaleX: reduced ? target : scale,
        opacity,
      }}
    />
  )
}
function MinorMarks({
  root,
  locations,
  mouseY,
  pose,
  reduced,
}: {
  root: RefObject<HTMLElement | null>
  locations: RailLocation[]
  mouseY: MotionValue<number>
  pose: MotionValue<number>
  reduced: boolean
}) {
  const [centers, setCenters] = useState<number[]>([])
  const rootY = useMotionValue(0),
    scrollY = useMotionValue(0)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => {
      rootY.set(node.getBoundingClientRect().top)
      scrollY.set(node.scrollTop)
      setCenters(
        [...node.querySelectorAll<HTMLButtonElement>(':scope > button')].map(
          (b) => b.offsetTop + b.offsetHeight / 2,
        ),
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      node.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [root, locations, rootY, scrollY])
  return (
    <>
      {centers
        .slice(0, -1)
        .flatMap((center, i) =>
          [0.25, 0.5, 0.75].map((f) => (
            <MinorDash
              key={`${locations[i].id}:${f}`}
              y={center + (centers[i + 1] - center) * f}
              coordinate={i + f}
              hue={
                i === 0
                  ? 'var(--site-muted)'
                  : `color-mix(in srgb, ${locations[i].hue} ${(1 - f) * 100}%, ${locations[i + 1].hue})`
              }
              mouseY={mouseY}
              rootY={rootY}
              scrollY={scrollY}
              pose={pose}
              reduced={reduced}
            />
          )),
        )}
    </>
  )
}
export const projectLocations: RailLocation[] = [
  { id: 'intro', label: 'Opening', kind: 'title', hue: '#a8d8f2' },
  ...menuViews.map((p) => ({
    id: p.id,
    label: p.title,
    kind: 'section' as const,
    hue: p.accent,
  })),
]
export function GlobalProximityRail({
  surface,
  blocked,
  presentation,
  locations = projectLocations,
  readWorldProgress = () => 0,
  reduced,
  onSelect,
}: {
  surface: string
  blocked: boolean
  presentation: RefObject<MenuPresentation>
  locations?: RailLocation[]
  readWorldProgress?: () => number
  reduced: boolean
  onSelect: (id: string) => void
}) {
  const mouseY = useMotionValue(Infinity),
    pose = useMotionValue(1),
    root = useRef<HTMLElement>(null),
    inside = useRef(false),
    reset = useRef(0)
  const [active, setActive] = useState(
    surface === 'intro' ? 'intro' : presentation.current.selectedId,
  )
  const current = useRef(active)
  const worldProgressReader = useRef(readWorldProgress)
  worldProgressReader.current = readWorldProgress
  useEffect(() => {
    let raf = 0
    const tick = () => {
      let next = 'intro'
      if (surface === 'hub') {
        const reelPose = presentation.current.rendered * 7,
          old = menuViews.findIndex((p) => p.id === current.current),
          index =
            old < 0
              ? Math.round(reelPose)
              : reelPose > old + 0.54
                ? Math.round(reelPose - 0.04)
                : reelPose < old - 0.54
                  ? Math.round(reelPose + 0.04)
                  : old
        pose.set(1 + reelPose)
        if (root.current)
          root.current.dataset.renderedProgress = String(
            presentation.current.rendered,
          )
        next = menuViews[Math.max(0, Math.min(7, index))].id
      } else if (surface === 'world' || surface === 'launch')
        next = locations.reduce((a, b) =>
          Math.abs((a.progress ?? 0) - worldProgressReader.current()) <=
          Math.abs((b.progress ?? 0) - worldProgressReader.current())
            ? a
            : b,
        ).id
      if (next !== current.current) {
        current.current = next
        setActive(next)
        if (!inside.current) {
          const node = root.current?.querySelector<HTMLButtonElement>(
              `button[aria-label="Go to ${locations.find((l) => l.id === next)?.label}"]`,
            ),
            r = node?.getBoundingClientRect()
          if (r) mouseY.set(r.top + r.height / 2)
          clearTimeout(reset.current)
          reset.current = window.setTimeout(() => mouseY.set(Infinity), 80)
        }
      }
      if (!document.hidden && ['hub', 'world', 'launch'].includes(surface))
        raf = requestAnimationFrame(tick)
    }
    const wake = () => {
      cancelAnimationFrame(raf)
      clearTimeout(reset.current)
      mouseY.set(Infinity)
      if (!document.hidden) tick()
    }
    tick()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('resize', wake)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(reset.current)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('resize', wake)
    }
  }, [surface, presentation, locations, mouseY, pose])
  useEffect(() => {
    const node = root.current
    // The global nav is a sibling of the native reel scroller. Forward only
    // wheel input over its dashes to that owner; retain browser zoom and the
    // short rail's own accessible overflow scrolling.
    const wheel = (event: WheelEvent) => {
      if (
        surface !== 'hub' ||
        blocked ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !node ||
        node.scrollHeight > node.clientHeight + 1
      )
        return
      const scroll = presentation.current.scrollReelBy
      if (!scroll) return
      event.preventDefault()
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
      scroll(event.deltaY * unit)
    }
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [surface, blocked, presentation])
  return (
    <nav
      ref={root}
      className="global-proximity-rail"
      aria-label="Portfolio locations"
      inert={blocked}
      data-blocked={blocked}
      data-active-id={active}
      onPointerMove={(e) => {
        inside.current = true
        clearTimeout(reset.current)
        mouseY.set(e.clientY)
      }}
      onPointerLeave={() => {
        inside.current = false
        mouseY.set(Infinity)
      }}
    >
      {surface === 'hub' && (
        <MinorMarks
          root={root}
          locations={locations}
          mouseY={mouseY}
          pose={pose}
          reduced={reduced}
        />
      )}
      {locations.map((location) => (
        <Dash
          key={location.id}
          location={location}
          active={location.id === active}
          mouseY={mouseY}
          reduced={reduced}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}
