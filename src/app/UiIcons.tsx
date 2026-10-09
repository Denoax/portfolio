// Authored vectors; shared stroke geometry keeps controls consistent at native scale.
export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m6 6 12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
export function NavIcon({ kind }: { kind: 'projects' | 'about' | 'contact' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'projects' ? (
        <path d="M12 5v15m0-15C8 3 5 3 3 4v14c3-1 6-1 9 2 3-3 6-3 9-2V4c-2-1-5-1-9 1Z" />
      ) : kind === 'about' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 6 9 7 9-7" />
        </>
      )}
    </svg>
  )
}
