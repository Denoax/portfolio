// Layout-effect cleanup can run before React removes the background's inert
// attribute. Restore after that commit, without scrolling or synthesizing input.
export function restoreFocus(trigger: HTMLElement | null, fallback: string) {
  queueMicrotask(() => {
    const target =
      trigger?.isConnected && trigger.getClientRects().length
        ? trigger
        : document.querySelector<HTMLElement>(fallback)
    target?.focus({ preventScroll: true })
  })
}
