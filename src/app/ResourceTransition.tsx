import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { Project } from '../content/projects'
import { useRouteFade } from '../hooks/useRouteFade'

export interface ResourceRequest {
  token: number
  project: Project
}

export function ResourceTransition({
  request,
  surface,
  ready,
  reduced,
  slow,
  onComplete,
  onCancel,
}: {
  request: ResourceRequest | null
  surface: RefObject<HTMLDivElement | null>
  ready: boolean
  reduced: boolean
  slow: boolean
  onComplete: (token: number) => void
  onCancel: () => void
}) {
  useLayoutEffect(() => {
    const node = surface.current
    return () => {
      node?.style.removeProperty('opacity')
    }
  }, [request?.token, surface])
  useRouteFade({
    token: request?.token ?? null,
    ready,
    reduced,
    onProgress: (p) => {
      if (surface.current) surface.current.style.opacity = String(1 - p)
    },
    onComplete: () => {
      if (request) onComplete(request.token)
    },
    onCancel,
  })
  if (!request || ready) return null
  return (
    <div className="route-preparation" role="status">
      {slow
        ? 'Graphics are taking longer than expected.'
        : 'Preparing graphics.'}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
