import { useEffect, useState } from 'react'

export function usePromptModule(enabled: boolean) {
  const [module, setModule] = useState<typeof import('../lib/prompt') | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled || module) return
    let active = true
    void import('../lib/prompt').then(loaded => {
      if (active) { setModule(loaded); setFailed(false) }
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [enabled, module])
  return { module, failed }
}
