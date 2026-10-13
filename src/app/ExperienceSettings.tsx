import { useRef, useState } from 'react'
import { PaneCloseButton } from './PaneCloseButton'
import { AngrySlider } from './AngrySlider'
import { useNonmodalDialog } from '../hooks/useNonmodalDialog'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import { useAnchoredProjects } from '../hooks/useAnchoredProjects'
import type { ExperienceSettings as Settings } from '../core/experienceSettings'
import { resetVisibleSettings } from '../core/experienceSettings'

export function ExperienceSettings({
  open,
  onClose,
  trigger,
  anchor,
  settings,
  onChange,
  reduced,
  storageUnavailable,
}: {
  open: boolean
  onClose: () => void
  trigger: React.RefObject<HTMLButtonElement | null>
  anchor: React.RefObject<HTMLDivElement | null>
  settings: Settings
  onChange: (next: Settings) => void
  reduced: boolean
  storageUnavailable: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [cancelEpoch, setCancelEpoch] = useState(0)
  const animateClose = useGlassDialogMotion(dialog, open, onClose, trigger)
  const close = () => {
    setCancelEpoch((n) => n + 1)
    animateClose()
  }
  useNonmodalDialog(dialog, open, close, trigger, '.settings-close')
  useAnchoredProjects(dialog, anchor, open, 380)
  const slider = (
    name: 'displayBrightness' | 'soundVolume',
    label: string,
    min: number,
    max: number,
  ) => (
    <AngrySlider
      name={name}
      label={label}
      value={settings[name]}
      min={min}
      max={max}
      reduced={reduced}
      active={open}
      cancelEpoch={cancelEpoch}
      onChange={(value) => onChange({ ...settings, [name]: value })}
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
    >
      <div className="settings-panel">
        <div className="settings-heading">
          <h2 id="settings-title">Settings</h2>
          <PaneCloseButton label="Close settings" onClose={close} />
        </div>
        <div className="settings-body">
          {slider('displayBrightness', 'Brightness', 80, 140)}
          {slider('soundVolume', 'Sound volume', 0, 100)}
          <label className="settings-motion">
            <span>Less motion</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.motion === 'less'}
              onChange={(e) =>
                onChange({
                  ...settings,
                  motion: e.target.checked ? 'less' : 'system',
                })
              }
            />
          </label>
          <button
            type="button"
            className="ui-action settings-reset"
            data-glass-lens="button"
            onClick={() => {
              // Sliders reconcile in layout effects before another input/RAF.
              setCancelEpoch((epoch) => epoch + 1)
              onChange(resetVisibleSettings(settings))
            }}
          >
            Reset settings
          </button>
          {storageUnavailable && (
            <p className="settings-storage" role="status">
              Preferences apply here but could not be saved.
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
