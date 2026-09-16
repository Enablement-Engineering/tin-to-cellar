import { useEffect, useState } from 'react'
import { appRecovery } from '../lib/app-recovery'

export function usePromptModule(enabled: boolean) {
  const [module, setModule] = useState<typeof import('../lib/prompt') | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled || module) return
    let active = true
    void import('../lib/prompt').then(loaded => {
      if (active) { setModule(loaded); setFailed(false) }
    }).catch(error => { if (active) { setFailed(true); appRecovery.report(error) } })
    return () => { active = false }
  }, [enabled, module])
  return { module, failed }
}
