import { CloseIcon } from './UiIcons'
import { useNonmodalDialog } from '../hooks/useNonmodalDialog'
import { useGlassDialogMotion } from '../hooks/useGlassDialogMotion'
import { useRef } from 'react'
import { contact } from '../content/portfolio'
export function InfoPanel({
  open,
  onClose,
  trigger,
  onReplay,
}: {
  open: boolean
  onClose: () => void
  trigger: React.RefObject<HTMLButtonElement | null>
  onReplay?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useGlassDialogMotion(dialog, open, onClose)
  useNonmodalDialog(dialog, open, close, trigger)
  return (
    <dialog
      id="info-panel"
      ref={dialog}
      className="hub-info experience-settings glass-window"
      data-glass-lens="window"
      aria-labelledby="info-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="settings-panel">
        <div className="settings-heading info-heading">
          <button
            type="button"
            className="settings-close"
            aria-label="Close info"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </div>
        <img
          className="about-avatar"
          src="/assets/profile/profile-v12-192.png"
          srcSet="/assets/profile/profile-v12-192.png 192w, /assets/profile/profile-v12-512.png 512w"
          sizes="160px"
          width="160"
          height="160"
          alt="User-selected luminous line character over a city"
        />
        <h2 id="info-title">
          Mani Marami
          <br />
          Milani.
        </h2>
        <p>
          I’m a dual major in Mathematics and Computer Science, and a developer
          for the Government of Canada.
        </p>
        <p className="info-source-credit">
          Navigation: <a href="https://www.rareui.com/">Rare UI</a> · Swami
          Malode, via Inspora.
        </p>
        <p className="info-source-credit">
          Audio:{' '}
          <a
            href="https://obsydianx.itch.io/interface-sfx-pack-1"
            target="_blank"
            rel="noreferrer"
          >
            ObsydianX
          </a>{' '}
          and{' '}
          <a
            href="https://opengameart.org/users/isaiah658"
            target="_blank"
            rel="noreferrer"
          >
            isaiah658
          </a>{' '}
          · CC0. SVG gait study:{' '}
          <a
            href="https://www.inspora.design/posts/1-29"
            target="_blank"
            rel="noreferrer"
          >
            Raul Dronca
          </a>
          .
        </p>
        <p className="info-location">Lethbridge, Canada</p>
        <div className="info-links">
          <a href={`mailto:${contact.email}`}>Email ↗</a>
          <a href={contact.github} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <a href="/credits">Credits ↗</a>
        </div>
        {onReplay && (
          <button type="button" className="hub-text" onClick={onReplay}>
            Replay identity intro
          </button>
        )}
      </div>
    </dialog>
  )
}
