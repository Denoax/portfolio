import { CloseIcon } from './UiIcons'
import { useNonmodalDialog } from '../hooks/useNonmodalDialog'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ExperienceSettings as Settings } from '../core/experienceSettings'
import { DEFAULT_SETTINGS, SETTING_BOUNDS } from '../core/experienceSettings'

type RangeKey = keyof typeof SETTING_BOUNDS
function RangeControl({
  name,
  label,
  value,
  onChange,
  onCommit,
  ends,
  reduced,
  disabled = false,
  hint,
}: {
  name: RangeKey
  label: string
  value: number
  onChange: (value: number) => void
  onCommit: () => void
  ends: [string, string]
  reduced: boolean
  disabled?: boolean
  hint?: string
}) {
  const chosen = useRef(value),
    previous = useRef(value),
    editing = useRef(false)
  chosen.current = value
  const begin = () => {
    if (!editing.current) {
      previous.current = chosen.current
      editing.current = true
    }
  }
  const commit = () => {
    if (editing.current && previous.current !== chosen.current) onCommit()
    editing.current = false
  }
  const holder = useRef<HTMLDivElement>(null),
    rail = useRef<SVGPathElement>(null),
    fill = useRef<SVGPathElement>(null)
  const thumb = useRef<SVGCircleElement>(null),
    input = useRef<HTMLInputElement>(null)
  const drag = useRef<{ y: number; bend: number } | null>(null)
  const animations = useRef<Animation[]>([])
  const draw = (bend = 0) => {
    const width = holder.current?.clientWidth ?? 300,
      [min, max] = SETTING_BOUNDS[name]
    const current = Number(input.current?.value ?? value),
      x = 6 + ((width - 12) * (current - min)) / (max - min)
    const left = `M6 24 C${Math.max(6, x - 55)} 24 ${Math.max(6, x - 24)} ${24 + bend} ${x} ${24 + bend}`
    rail.current?.setAttribute(
      'd',
      `${left} S${Math.min(width - 6, x + 55)} 24 ${width - 6} 24`,
    )
    fill.current?.setAttribute('d', left)
    thumb.current?.setAttribute('cx', String(x))
    thumb.current?.setAttribute('cy', String(24 + bend))
  }
  const settle = () => {
    const bend = drag.current?.bend ?? 0
    drag.current = null
    animations.current.forEach((a) => a.cancel())
    animations.current = []
    const initialRail = rail.current?.getAttribute('d'),
      initialFill = fill.current?.getAttribute('d')
    draw()
    if (reduced || !bend) return
    // Native values never spring. Only decoration settles, using the browser's
    // animation engine rather than adding another RAF loop to the experience.
    for (const [el, initial] of [
      [rail.current, initialRail],
      [fill.current, initialFill],
    ] as const) {
      if (el && initial)
        animations.current.push(
          el.animate(
            [
              { d: `path('${initial}')` },
              { d: `path('${el.getAttribute('d')}')` },
            ],
            { duration: 220, easing: 'cubic-bezier(.2,.9,.25,1.1)' },
          ),
        )
    }
    if (thumb.current)
      animations.current.push(
        thumb.current.animate(
          [
            { transform: `translateY(${bend}px) scale(1.08,.92)` },
            { transform: 'translateY(0) scale(1)' },
          ],
          { duration: 220, easing: 'cubic-bezier(.2,.9,.25,1.1)' },
        ),
      )
  }
  useLayoutEffect(() => {
    draw(drag.current?.bend ?? 0)
    const observer = new ResizeObserver(() => draw(drag.current?.bend ?? 0))
    if (holder.current) observer.observe(holder.current)
    return () => observer.disconnect()
  }, [value])
  useEffect(() => {
    if (reduced) settle()
    return () => animations.current.forEach((a) => a.cancel())
  }, [reduced])
  const [min, max] = SETTING_BOUNDS[name]
  return (
    <div
      className={`settings-range ${disabled ? 'settings-range--disabled' : ''}`}
    >
      <div className="settings-range-label">
        <label htmlFor={`setting-${name}`}>{label}</label>
        <output htmlFor={`setting-${name}`}>
          {name === 'autoScrollSpeed' ? `${value.toFixed(1)}×` : `${value}%`}
        </output>
      </div>
      <div className="settings-rail" ref={holder}>
        <svg aria-hidden="true">
          <path ref={rail} className="range-track" />
          <path ref={fill} className="range-fill" />
          <circle ref={thumb} r="5" />
        </svg>
        <input
          ref={input}
          id={`setting-${name}`}
          type="range"
          min={min}
          max={max}
          step={name === 'autoScrollSpeed' ? 0.1 : 1}
          value={value}
          disabled={disabled}
          aria-valuetext={
            name === 'autoScrollSpeed'
              ? `${value.toFixed(1)} times`
              : `${value} percent`
          }
          aria-describedby={hint ? `hint-${name}` : undefined}
          onChange={(e) => {
            begin()
            onChange(Number(e.target.value))
          }}
          onPointerDown={(e) => {
            begin()
            animations.current.forEach((a) => a.cancel())
            drag.current = { y: e.clientY, bend: 0 }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            drag.current.bend = reduced
              ? 0
              : Math.max(-6, Math.min(6, (e.clientY - drag.current.y) * 0.22))
            draw(drag.current.bend)
          }}
          onPointerUp={() => {
            settle()
            commit()
          }}
          onPointerCancel={() => {
            settle()
            editing.current = false
          }}
          onKeyDown={begin}
          onKeyUp={commit}
          onBlur={commit}
          onLostPointerCapture={() => {
            if (drag.current) settle()
          }}
        />
      </div>
      <div className="settings-ends">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
      {hint && (
        <p id={`hint-${name}`} className="settings-hint">
          {hint}
        </p>
      )}
    </div>
  )
}

const tabs = ['Display', 'Motion', 'Detail'] as const
export function ExperienceSettings({
  open,
  onClose,
  trigger,
  settings,
  onChange,
  reduced,
  staticView,
  adjusted,
  storageUnavailable,
  onCue,
}: {
  open: boolean
  onClose: () => void
  trigger: React.RefObject<HTMLButtonElement | null>
  settings: Settings
  onChange: (next: Settings) => void
  reduced: boolean
  staticView: boolean
  adjusted: boolean
  storageUnavailable: boolean
  onCue: (cue: import('../audio/InterfaceAudio').SoundCue) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    tablist = useRef<HTMLDivElement>(null),
    indicator = useRef<HTMLSpanElement>(null)
  const [selected, setSelected] = useState(0),
    [fine, setFine] = useState(
      () => matchMedia('(pointer:fine) and (hover:hover)').matches,
    )
  useEffect(() => {
    const media = matchMedia('(pointer:fine) and (hover:hover)'),
      change = () => setFine(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const close = useGlassDialogMotion(dialog, open, onClose)
  useNonmodalDialog(dialog, open, close, trigger, '.settings-close')
  useLayoutEffect(() => {
    const update = () => {
      const node = tablist.current?.querySelector<HTMLElement>(
        '[aria-selected=true]',
      )
      if (node && indicator.current) {
        indicator.current.style.width = `${node.offsetWidth}px`
        indicator.current.style.transform = `translateX(${node.offsetLeft}px)`
      }
    }
    update()
    const observer = new ResizeObserver(update)
    if (tablist.current) observer.observe(tablist.current)
    return () => observer.disconnect()
  }, [selected, open])
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onChange({ ...settings, [key]: value })
    if (key === 'graphics' || key === 'motion') onCue('toggle')
  }
  const range = (
    name: RangeKey,
    label: string,
    ends: [string, string],
    disabled = false,
    hint?: string,
  ) => (
    <RangeControl
      name={name}
      label={label}
      value={settings[name]}
      onChange={(v) => change(name, v)}
      onCommit={() => {
        if (name === 'autoScrollSpeed') onCue('speed')
      }}
      ends={ends}
      reduced={reduced}
      disabled={disabled}
      hint={hint}
    />
  )
  return (
    <dialog
      ref={dialog}
      id="experience-settings"
      className="experience-settings glass-window"
      data-glass-lens="window"
      aria-labelledby="settings-title"
      data-reduced={reduced}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close()
        }
      }}
    >
      <div className="settings-panel">
        <div className="settings-heading">
          <div>
            <p className="settings-eyebrow">Make it yours</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            className="settings-close"
            type="button"
            aria-label="Close settings"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </div>
        <div
          ref={tablist}
          className="settings-tabs"
          role="tablist"
          aria-label="Settings categories"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab}
              id={`settings-tab-${i}`}
              type="button"
              role="tab"
              aria-controls={`settings-panel-${i}`}
              aria-selected={i === selected}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => {
                onCue('toggle')
                setSelected(i)
              }}
              onKeyDown={(e) => {
                let next = i
                if (e.key === 'ArrowRight') next = (i + 1) % 3
                else if (e.key === 'ArrowLeft') next = (i + 2) % 3
                else if (e.key === 'Home') next = 0
                else if (e.key === 'End') next = 2
                else return
                e.preventDefault()
                setSelected(next)
                tablist.current
                  ?.querySelectorAll<HTMLButtonElement>('button')
                  [next].focus()
              }}
            >
              {tab}
            </button>
          ))}
          <span
            ref={indicator}
            className="settings-indicator"
            aria-hidden="true"
          />
        </div>
        <section
          id="settings-panel-0"
          role="tabpanel"
          aria-labelledby="settings-tab-0"
          hidden={selected !== 0}
        >
          <label className="settings-select-label">
            Theme
            <select
              aria-label="Theme"
              value={settings.theme}
              onChange={(e) =>
                change('theme', e.target.value as Settings['theme'])
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {range(
            'displayBrightness',
            'Display brightness',
            ['Darker', 'Brighter'],
            staticView,
            staticView
              ? 'Brightness is available in the live scene.'
              : undefined,
          )}
          <div className="settings-guide">
            <h3>Dark-detail guide</h3>
            <div aria-hidden="true">
              {[2, 5, 9, 14, 20, 28, 40, 242].map((n) => (
                <span key={n} style={{ background: `rgb(${n},${n},${n})` }} />
              ))}
            </div>
            <p>
              Use this if dark details disappear on your screen. Your choice
              stays in this browser.
            </p>
          </div>
        </section>
        <section
          id="settings-panel-1"
          role="tabpanel"
          aria-labelledby="settings-tab-1"
          hidden={selected !== 1}
        >
          {range(
            'cursorSize',
            'Cursor size',
            ['Finer', 'Fuller head'],
            !fine || reduced || staticView,
            !fine
              ? 'Cursor trail is available with a mouse.'
              : reduced
                ? 'Cursor trail is off with less motion.'
                : undefined,
          )}
          {range('scrollPace', 'Manual scroll pace', ['Slower', 'Faster'])}
          {range('autoScrollSpeed', 'Auto-scroll speed', ['0.5×', '4.0×'])}
          <label className="settings-select-label" htmlFor="setting-motion">
            Motion preference
          </label>
          <select
            id="setting-motion"
            value={settings.motion}
            onChange={(e) =>
              change('motion', e.target.value as Settings['motion'])
            }
          >
            <option value="system">Follow system</option>
            <option value="less">Less motion</option>
          </select>
          <p className="settings-hint">
            System reduced motion is always respected.
          </p>
          {range('soundVolume', 'Master volume', ['Silent', 'Full volume'])}
          {range('ambienceVolume', 'Ambience', ['Silent', 'Full ambience'])}
        </section>
        <section
          id="settings-panel-2"
          role="tabpanel"
          aria-labelledby="settings-tab-2"
          hidden={selected !== 2}
        >
          {range(
            'cloudDepth',
            'Cloud depth',
            ['Full cover', 'More depth'],
            staticView,
            staticView
              ? 'Cloud depth is available in the live scene.'
              : 'The transition stays fully covered at every setting.',
          )}
          <label className="settings-select-label" htmlFor="setting-graphics">
            Graphics
          </label>
          <select
            id="setting-graphics"
            value={settings.graphics}
            onChange={(e) =>
              change('graphics', e.target.value as Settings['graphics'])
            }
          >
            <option value="auto">Auto</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>
          <p className="settings-hint" role="status">
            {adjusted
              ? 'Adjusted for smooth playback.'
              : staticView
                ? 'Your choice applies when the live scene resumes.'
                : 'Detail adapts to keep the journey smooth.'}
          </p>
        </section>
        <div className="settings-footer">
          <button
            type="button"
            className="titanium-button settings-reset"
            onClick={() => {
              onChange({ ...DEFAULT_SETTINGS })
              onCue('toggle')
            }}
          >
            Reset settings<span aria-hidden="true">↺</span>
          </button>
          <p>Reset keeps your place in the journey.</p>
          {storageUnavailable && (
            <p role="status">Preferences apply here but could not be saved.</p>
          )}
        </div>
      </div>
    </dialog>
  )
}
