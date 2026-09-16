import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { appRecovery } from '../lib/app-recovery'

export function useRecoveryBlocker(reason: string | null, owner = false) {
  const id = useRef(Symbol('app-recovery-guard'))
  useLayoutEffect(() => appRecovery.guard(id.current, reason, owner), [reason, owner])
}

export function useAppRecovery() {
  return useSyncExternalStore(appRecovery.subscribe, appRecovery.getSnapshot)
}
