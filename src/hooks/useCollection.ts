import { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionError, createCollection, createCollectionStore, type Collection } from '../lib/collection'

/** Serialize this tab's changes; the database compares revisions across tabs. */
export function useCollection() {
  const [collection, setCollection] = useState<Collection>(createCollection)
  const current = useRef(collection)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const store = useRef<ReturnType<typeof createCollectionStore> | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const readyRef = useRef(false)
  const mounted = useRef(true)
  const accept = useCallback((next: Collection) => {
    current.current = next
    if (mounted.current) setCollection(next)
  }, [])

  const refresh = useCallback(async () => {
    const saved = await store.current?.load()
    if (saved && (saved.id !== current.current.id || saved.revision > current.current.revision)) accept(saved)
  }, [accept])
  useEffect(() => {
    mounted.current = true
    const database = createCollectionStore()
    store.current = database
    let active = true
    void database.load().then(saved => {
      if (!active) return
      if (saved) accept(saved)
      readyRef.current = true
      setReady(true)
    }).catch(() => { if (active) setError('Your saved labels could not be opened. Reload to try again. No saved work has been changed.') })
    const reread = () => { void queue.current.then(refresh).catch(() => { if (active) setError('Saved labels could not be refreshed. Reload before making more changes.') }) }
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('tin-to-cellar-collection')
      channel.current.onmessage = reread
    }
    window.addEventListener('focus', reread)
    return () => {
      active = false
      mounted.current = false
      readyRef.current = false
      window.removeEventListener('focus', reread)
      channel.current?.close()
      database.close()
    }
  }, [accept, refresh])

  const commit = useCallback((change: (current: Collection) => Collection): Promise<Collection> => {
    const operation = queue.current.catch(() => undefined).then(async () => {
      if (!readyRef.current || !store.current) throw new CollectionError('unavailable', 'Wait for your saved labels to open before making changes.')
      if (mounted.current) { setSaving(true); setError('') }
      try {
        const previous = current.current
        const next = change(previous)
        const saved = await store.current.save(previous.revision, next)
        accept(saved)
        channel.current?.postMessage({ revision: saved.revision })
        return saved
      } catch (failure) {
        if (failure instanceof CollectionError && failure.code === 'conflict') await refresh()
        const message = failure instanceof Error ? failure.message : 'The change could not be saved. Your previous labels are still available.'
        if (mounted.current) setError(message)
        throw failure
      } finally { if (mounted.current) setSaving(false) }
    })
    queue.current = operation
    return operation
  }, [accept, refresh])
  return { collection, ready, saving, error, commit, refresh }
}
