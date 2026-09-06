import { useEffect, useState } from 'react'
import type { SourceObservation } from '../contributions'
import { loadSavedSources } from './saved-sources'

const empty: SourceObservation[] = []
export function useSavedSources(tobaccos: string, enabled: boolean) {
  const [result, setResult] = useState({ tobaccos: '', sources: empty })
  useEffect(() => {
    if (!enabled || !tobaccos) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    void loadSavedSources(tobaccos, controller.signal).then(sources => {
      if (!controller.signal.aborted) setResult({ tobaccos, sources })
    }).finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [tobaccos, enabled])
  return enabled && result.tobaccos === tobaccos ? result.sources : empty
}
