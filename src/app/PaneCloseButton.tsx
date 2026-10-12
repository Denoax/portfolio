import { CloseIcon } from './UiIcons'

// The owned project-help button is the shared ordinary-pane Close treatment.
export function PaneCloseButton({
  label,
  onClose,
}: {
  label: string
  onClose: () => void
}) {
  return (
    <button
      type="button"
      className="settings-close pane-close"
      aria-label={label}
      onClick={onClose}
    >
      <CloseIcon />
    </button>
  )
}
