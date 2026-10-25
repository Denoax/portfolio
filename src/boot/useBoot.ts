import {useSyncExternalStore} from 'react'
import {boot} from './runtime'
export const useBoot = () => useSyncExternalStore(boot.subscribe, boot.getSnapshot)
