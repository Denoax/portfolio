// Copyright (c) 2026 Swami Malode / Rare UI. Application adaptation.
// Pinned f65e1647136e75bdf9aa0bf9742797eb949769b8; source SHA recorded in V15_SOURCE_MAP.
// Notices: /licenses/Rare-UI.txt and /licenses/Rare-UI-usage.txt.
// Next routing/Tailwind replaced by native actions/scoped CSS; seam mechanics retained.

import {
  useEffect,
  useId,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import '../styles/gooey-nav.css'
const cn = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(' ')

// the duration picker's spring, damped so nothing overshoots
const SPRING = { type: 'spring', stiffness: 200, damping: 28, mass: 1 } as const

// the neck has thinned to nothing by the time the gap is this far open
const NECK_BREAK = 0.22

// nominal viewBox height; the svg stretches to whatever the tile actually is
const NECK_H = 100

const FADE_IN = 'gooey-color-in'
const FADE_OUT = 'gooey-color-out'

const BAR = 'gooey-bar'
const BAR_TEXT = 'gooey-bar-ink'

const SIZES = {
  xs: {
    label: 'gooey-xs',
    radius: 8,
    separation: 14,
  },
  sm: {
    label: 'gooey-sm',
    radius: 10,
    separation: 16,
  },
  md: {
    label: 'gooey-md',
    radius: 12,
    separation: 20,
  },
  lg: {
    label: 'gooey-lg',
    radius: 14,
    separation: 24,
  },
} as const

export type GooeyNavSize = keyof typeof SIZES

type NavItem = {
  label: string
  href?: string
  icon?: ReactNode
  id?: string
  expanded?: boolean
  controls?: string
  buttonRef?: React.Ref<HTMLButtonElement>
}

export type GooeyNavItem = string | NavItem

const toItem = (item: GooeyNavItem): NavItem =>
  typeof item === 'string' ? { label: item } : item

export type GooeyNavProps = Omit<ComponentProps<'nav'>, 'onChange'> & {
  items: GooeyNavItem[]
  value: number
  reduced?: boolean
  onChange?: (index: number) => void
  size?: GooeyNavSize
  activeColor?: string
  activeLabelColor?: string
  separation?: number
  radius?: number
}

// two concave curves pinching toward the middle, drawn in the gap the tiles leave
function neckPath(gap: number, span: number) {
  // a NaN or negative span would otherwise emit a path full of NaN coordinates
  if (
    !Number.isFinite(gap) ||
    !Number.isFinite(span) ||
    gap <= 0 ||
    span <= 0
  ) {
    return ''
  }
  const waist = NECK_H * (1 - gap / (span * NECK_BREAK))
  if (waist <= 0) return ''
  const start = span - gap
  const mid = start + gap / 2
  return `M${start} 0 Q${mid} ${NECK_H - waist} ${span} 0 L${span} ${NECK_H} Q${mid} ${waist} ${start} ${NECK_H} Z`
}

type SegmentProps = {
  gap: number
  span: number
  hasSeam: boolean
  leftFill: string
  rightFill: string
  reduced: boolean
  radii: Record<string, number>
  className?: string
  style?: CSSProperties
  children: ReactNode
}

function Segment({
  gap,
  span,
  hasSeam,
  leftFill,
  rightFill,
  reduced,
  radii,
  className,
  style,
  children,
}: SegmentProps) {
  const marginLeft = useSpring(gap, SPRING)
  const gradientId = `gooey-neck-${useId().replace(/:/g, '')}`

  useEffect(() => {
    if (reduced) marginLeft.jump(gap)
    else marginLeft.set(gap)
  }, [gap, marginLeft, reduced])

  const d = useTransform(marginLeft, (g) => neckPath(g, span))

  return (
    <motion.li
      data-slot="gooey-nav-segment"
      className={cn('gooey-segment', className)}
      style={{ ...style, marginLeft }}
      initial={false}
      animate={radii}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      {hasSeam && (
        <svg
          aria-hidden
          width={span}
          viewBox={`0 0 ${span} ${NECK_H}`}
          preserveAspectRatio="none"
          className={cn('gooey-neck', BAR_TEXT)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1">
              <stop offset="0" stopColor={leftFill} />
              <stop offset="1" stopColor={rightFill} />
            </linearGradient>
          </defs>
          <motion.path d={d} fill={`url(#${gradientId})`} />
        </svg>
      )}
      {children}
    </motion.li>
  )
}

type NavLabelProps = NavItem & {
  isActive: boolean
  size: GooeyNavSize
  activeLabelColor: string
  onSelect: () => void
}

function NavLabel({
  label,
  href,
  icon,
  isActive,
  size,
  activeLabelColor,
  onSelect,
  id,
  expanded,
  controls,
  buttonRef,
}: NavLabelProps) {
  const props = {
    'data-slot': 'gooey-nav-item',
    'data-active': isActive,
    id,
    'aria-haspopup': controls ? ('dialog' as const) : undefined,
    'aria-expanded': expanded,
    'aria-controls': controls,
    className: cn(
      'gooey-label',
      isActive ? FADE_IN : FADE_OUT,
      SIZES[size].label,
      !isActive && 'gooey-inactive',
    ),
    style: isActive ? { color: activeLabelColor } : undefined,
    onClick: onSelect,
  } as const

  return href ? (
    <a href={href} {...props}>
      {icon}
      {label}
    </a>
  ) : (
    <button ref={buttonRef} type="button" {...props}>
      {icon}
      {label}
    </button>
  )
}

export function GooeyNav({
  items,
  value,
  reduced: reduceOverride = false,
  onChange,
  size = 'md',
  activeColor = 'var(--nav-selected)',
  activeLabelColor = 'var(--nav-selected-ink)',
  separation,
  radius,
  className,
  ...props
}: GooeyNavProps) {
  const osReduced = useReducedMotion() ?? false
  const reduced = reduceOverride || osReduced
  const active = value
  const span = separation ?? SIZES[size].separation
  const corner = radius ?? SIZES[size].radius

  const open = (seam: number) =>
    seam === 0 ||
    seam === items.length ||
    seam - 1 === active ||
    seam === active

  const fill = (i: number) => (i === active ? activeColor : 'currentColor')

  return (
    <nav
      data-slot="gooey-nav"
      className={cn('gooey-nav', className)}
      {...props}
    >
      <ul className="gooey-list">
        {items.map((item, i) => {
          const navItem = toItem(item)
          const isActive = i === active

          return (
            <Segment
              key={`${i}-${navItem.label}`}
              // closed seams pull in a pixel so no hairline shows through
              gap={i === 0 ? 0 : open(i) ? span : -1}
              span={span}
              hasSeam={i > 0}
              leftFill={fill(i - 1)}
              rightFill={fill(i)}
              reduced={reduced}
              radii={{
                borderTopLeftRadius: open(i) ? corner : 0,
                borderBottomLeftRadius: open(i) ? corner : 0,
                borderTopRightRadius: open(i + 1) ? corner : 0,
                borderBottomRightRadius: open(i + 1) ? corner : 0,
              }}
              className={cn(BAR, isActive ? FADE_IN : FADE_OUT)}
              style={{ backgroundColor: isActive ? activeColor : undefined }}
            >
              <NavLabel
                {...navItem}
                isActive={isActive}
                size={size}
                activeLabelColor={activeLabelColor}
                onSelect={() => {
                  onChange?.(i)
                }}
              />
            </Segment>
          )
        })}
      </ul>
    </nav>
  )
}
