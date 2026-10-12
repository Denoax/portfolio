// Adapted within this portfolio from Rare UI, copyright (c) 2026 Swami Malode.
// Pin b4de46e; full MIT + Commons Clause: /assets/notices/rareui-license.txt.
// Original proximity inspiration: devouringdetails.com. Routing belongs to App.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import type { MenuPresentation } from '../core/menuReel'
import { menuViews } from '../core/menuReel'
import { railPosition } from '../core/railPosition'
export interface RailLocation {
  id: string
  label: string
  kind: 'title' | 'section'
  hue: string
  progress?: number
}
const presets = {
  title: { base: 40, bump: 100 },
  section: { base: 26, bump: 90 },
}
function Dash({
  location,
  active,
  locked,
  mouseY,
  reduced,
  onSelect,
}: {
  location: RailLocation
  active: boolean
  locked: MotionValue<string | null>
  mouseY: MotionValue<number>
  reduced: boolean
  onSelect: (id: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null),
    preset = presets[location.kind]
  const center = useMotionValue(Infinity)
  const extent = useMotionValue(140)
  useLayoutEffect(() => {
    const paintLock = (id: string | null) => {
      if (ref.current) ref.current.dataset.locked = String(id === location.id)
    }
    paintLock(locked.get())
    return locked.on('change', paintLock)
  }, [locked, location.id])
  useEffect(() => {
    const node = ref.current
    const parent = node?.parentElement
    if (!node || !parent) return
    const measure = () => {
      const bounds = node.getBoundingClientRect()
      center.set(bounds.top + bounds.height / 2)
      extent.set(Math.min(140, parent.clientWidth))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    measure()
    parent.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      parent.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [center, extent])
  const target = useTransform(() => {
    const y = mouseY.get(),
      middle = center.get()
    const near =
      Number.isFinite(y) && Number.isFinite(middle)
        ? Math.max(0, 1 - Math.abs(y - middle) / 75)
        : 0
    const peak = Math.min(extent.get(), preset.base + preset.bump)
    return (preset.base + (peak - preset.base) * near) / 140
  })
  const scale = useSpring(target, { stiffness: 420, damping: 36, mass: 0.65 })
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Go to ${location.label}`}
      title={location.label}
      aria-current={active ? 'location' : undefined}
      data-location-id={location.id}
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
          width: 140,
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
  const target = useTransform(distance, [-75, 0, 75], [10 / 32, 1, 10 / 32], {
    clamp: true,
  })
  const scale = useSpring(target, { stiffness: 420, damping: 36, mass: 0.65 })
  const opacity = useTransform(
    pose,
    (p) => 0.25 + 0.55 * Math.max(0, 1 - Math.abs(p - coordinate) * 2),
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
  locked,
}: {
  root: RefObject<HTMLElement | null>
  locations: RailLocation[]
  mouseY: MotionValue<number>
  pose: MotionValue<number>
  reduced: boolean
  locked: MotionValue<string | null>
}) {
  const [centers, setCenters] = useState<number[]>([])
  const position = useRef<HTMLSpanElement>(null)
  const rootY = useMotionValue(0),
    scrollY = useMotionValue(0)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => {
      rootY.set(node.getBoundingClientRect().top)
      scrollY.set(node.scrollTop)
      const next = [
        ...node.querySelectorAll<HTMLButtonElement>(':scope > button'),
      ].map((b) => b.offsetTop + b.offsetHeight / 2)
      setCenters((old) =>
        next.length === old.length && next.every((y, i) => y === old[i])
          ? old
          : next,
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    return () => {
      observer.disconnect()
      node.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
    }
  }, [root, locations, rootY, scrollY])
  useLayoutEffect(() => {
    const paintPosition = (p: number) => {
      if (position.current)
        position.current.style.top = `${railPosition(p, centers)}px`
    }
    paintPosition(pose.get())
    // Paint with the displayed-pose update, not a later Motion render frame.
    return pose.on('change', paintPosition)
  }, [pose, centers])
  const positionHue = useTransform(pose, (p) => {
    const index = Math.max(0, Math.min(locations.length - 1, p)),
      i = Math.floor(index),
      fraction = index - i
    return `color-mix(in srgb, ${locations[i].hue} ${(1 - fraction) * 100}%, ${locations[Math.min(i + 1, locations.length - 1)].hue})`
  })
  const opacityTarget = useTransform(locked, (id): number =>
    id === null ? 0.85 : 0,
  )
  const opacity = useSpring(opacityTarget, {
    stiffness: 420,
    damping: 36,
    mass: 0.65,
  })
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
              hue={`color-mix(in srgb, ${locations[i].hue} ${(1 - f) * 100}%, ${locations[i + 1].hue})`}
              mouseY={mouseY}
              rootY={rootY}
              scrollY={scrollY}
              pose={pose}
              reduced={reduced}
            />
          )),
        )}
      <motion.span
        ref={position}
        className="rail-position"
        aria-hidden="true"
        style={{
          backgroundColor: positionHue,
          opacity: reduced ? opacityTarget : opacity,
        }}
      />
    </>
  )
}
export const projectLocations: RailLocation[] = menuViews.map((p) => ({
  id: p.id,
  label: p.title,
  kind: 'section' as const,
  hue: p.accent,
}))
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
    pose = useMotionValue(0),
    root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(
    surface === 'intro' ? 'intro' : presentation.current.selectedId,
  )
  const current = useRef(active)
  const locked = useMotionValue<string | null>(null)
  useLayoutEffect(() => {
    const paint = (id: string | null) => {
      if (root.current) root.current.dataset.lockedId = id ?? ''
    }
    paint(locked.get())
    return locked.on('change', paint)
  }, [locked])
  const worldProgressReader = useRef(readWorldProgress)
  worldProgressReader.current = readWorldProgress
  useEffect(() => {
    let raf = 0
    const tick = () => {
      let next = 'intro'
      if (surface === 'hub') {
        const reelPose =
            Math.max(0, Math.min(1, presentation.current.rendered)) *
            (menuViews.length - 1),
          old = menuViews.findIndex((p) => p.id === current.current),
          index =
            old < 0
              ? Math.round(reelPose)
              : reelPose > old + 0.54
                ? Math.round(reelPose - 0.04)
                : reelPose < old - 0.54
                  ? Math.round(reelPose + 0.04)
                  : old
        pose.set(reelPose)
        if (root.current)
          root.current.dataset.renderedProgress = String(
            presentation.current.rendered,
          )
        next = menuViews[Math.max(0, Math.min(menuViews.length - 1, index))].id
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
      }
      const nextLock =
        surface === 'hub'
          ? presentation.current.settledId
          : surface === 'world'
            ? next
            : null
      locked.set(nextLock)
      if (!document.hidden && ['hub', 'world', 'launch'].includes(surface))
        raf = requestAnimationFrame(tick)
    }
    const wake = () => {
      cancelAnimationFrame(raf)
      mouseY.set(Infinity)
      if (!document.hidden) tick()
    }
    // Clear cached glow in the actual native scroll event, before a React
    // commit/RAF can leave a stale major lit. This never writes scroll/selection.
    const native =
      surface === 'hub'
        ? presentation.current.stage?.closest('.menu-scroll')
        : null
    const departed = () => locked.set(null)
    native?.addEventListener('scroll', departed, { passive: true })
    tick()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('resize', wake)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('resize', wake)
      native?.removeEventListener('scroll', departed)
    }
  }, [surface, presentation, locations, mouseY, pose, locked])
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
      data-reduced={reduced}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        mouseY.set(e.clientY)
      }}
      onPointerLeave={() => {
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
          locked={locked}
        />
      )}
      {locations.map((location) => (
        <Dash
          key={location.id}
          location={location}
          active={location.id === active}
          locked={locked}
          mouseY={mouseY}
          reduced={reduced}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}
