// Copyright (c) 2026 Swami Malode / Rare UI. Application adaptation.
// Pinned f65e1647136e75bdf9aa0bf9742797eb949769b8; source SHA recorded in V15_SOURCE_MAP.
// Notices: /licenses/Rare-UI.txt and /licenses/Rare-UI-usage.txt.
// Next routing/Tailwind replaced by native actions/scoped CSS; seam mechanics retained.

import {
  useEffect,
  useId,
  useMemo,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  animate,
  motion,
  motionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { navConnection } from '../core/navConnection'
import '../styles/gooey-nav.css'
const cn = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(' ')

// the duration picker's spring, damped so nothing overshoots
const SPRING = {
  type: 'spring',
  stiffness: 200,
  damping: 28,
  mass: 1,
} as const

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

type SegmentProps = {
  left: MotionValue<number>
  right: MotionValue<number> | null
  span: number
  height: number
  radius: number
  first: boolean
  leftFill: string
  rightFill: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

function Segment({
  left,
  right,
  span,
  height,
  radius,
  first,
  leftFill,
  rightFill,
  className,
  style,
  children,
}: SegmentProps) {
  const gradientId = `gooey-neck-${useId().replace(/:/g, '')}`
  const d = useTransform(
    left,
    (gap) => navConnection(gap, height, radius, span).path,
  )
  const leftRadius = useTransform(left, (gap) =>
    first ? radius : navConnection(gap, height, radius, span).corner,
  )
  const rightRadius = useTransform(right ?? left, (gap) =>
    right ? navConnection(gap, height, radius, span).corner : radius,
  )
  const windowLeft = -span - radius - 2
  const windowWidth = span + 2 * radius + 4
  return (
    <motion.li
      data-slot="gooey-nav-segment"
      className={cn('gooey-segment', className)}
      style={{
        ...style,
        marginLeft: left,
        borderTopLeftRadius: leftRadius,
        borderBottomLeftRadius: leftRadius,
        borderTopRightRadius: rightRadius,
        borderBottomRightRadius: rightRadius,
      }}
    >
      {!first && (
        <svg
          aria-hidden
          width={windowWidth}
          viewBox={`${windowLeft} 0 ${windowWidth} ${height}`}
          preserveAspectRatio="none"
          className={cn('gooey-neck', BAR_TEXT)}
          style={{ left: windowLeft }}
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

  const gaps = useMemo(
    () =>
      Array.from({ length: items.length }, (_, i) =>
        motionValue(i === 0 ? 0 : -1),
      ),
    [items.length],
  )
  useEffect(() => {
    const controls = gaps.map((gap, i) => {
      const target = i === 0 ? 0 : open(i) ? span : -1
      if (reduced) {
        gap.jump(target)
        return null
      }
      return animate(gap, target, SPRING)
    })
    return () => controls.forEach((control) => control?.stop())
  }, [gaps, active, span, reduced])
  const height = { xs: 28, sm: 32, md: 40, lg: 48 }[size]
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
              left={gaps[i]}
              right={gaps[i + 1] ?? null}
              span={span}
              height={height}
              radius={corner}
              first={i === 0}
              leftFill={fill(i - 1)}
              rightFill={fill(i)}
              className={cn(BAR, isActive ? FADE_IN : FADE_OUT)}
              style={{
                backgroundColor: isActive ? activeColor : undefined,
              }}
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
