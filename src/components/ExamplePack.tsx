import { useRef, useState } from 'react'

const base = '/examples/ten-blends/'
const filename = 'tin-to-cellar-ten-blends.cellarpack.zip'
const blends = [
  ['gl-pease-westminster', 'Westminster'],
  ['ac-petersen-escudo-navy-de-luxe', 'Escudo Navy De Luxe'],
  ['gl-pease-quiet-nights', 'Quiet Nights'],
  ['cornell-diehl-midnight-drive', 'Midnight Drive'],
  ['orlik-golden-sliced', 'Golden Sliced'],
  ['cornell-diehl-pirate-kake', 'Pirate Kake'],
  ['gl-pease-embarcadero', 'Embarcadero'],
  ['peterson-early-morning-pipe', 'Early Morning Pipe'],
  ['cornell-diehl-autumn-evening', 'Autumn Evening'],
  ['cornell-diehl-briar-fox', 'Briar Fox'],
]

export function ExamplePack({ busy, onFile, variant = 'print' }: { busy: boolean; onFile: (file: File) => Promise<void>; variant?: 'print' | 'landing' }) {
  const [action, setAction] = useState<'import' | 'download' | null>(null)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const run = async (next: 'import' | 'download') => {
    if (busy || pending.current) return
    pending.current = true
    setAction(next)
    setError('')
    try {
      // Split the preview ZIP to keep each static asset below the host's 25 MiB limit.
      const parts = await Promise.all(['pack-aa', 'pack-ab'].map(async (part) => {
        const response = await fetch(base + part)
        if (!response.ok) throw new Error('Example download failed')
        return response.arrayBuffer()
      }))
      const file = new File(parts, filename, { type: 'application/zip' })
      if (next === 'import') await onFile(file)
      else {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch {
      setError('The example pack could not load. Try again.')
    } finally {
      pending.current = false
      setAction(null)
    }
  }
  const disabled = busy || action !== null
  if (variant === 'landing') return <section className="landing-specs" aria-labelledby="landing-pack-title">
    <div className="landing-print-note">
      <h2 id="landing-pack-title">Try a set of cellar labels.</h2>
      <p>Explore ten finished designs. Set a quantity for the ones you want and preview your print sheets.</p>
      <p className="field-hint">AI-generated examples for personal cellaring. Not official brand artwork or a license to reuse the original designs.</p>
      <button className="button secondary" type="button" disabled={disabled} onClick={() => void run('import')}>{action === 'import' ? 'Loading example pack…' : 'Try the example pack'}</button>
      {action && <p role="status">Opening ten labels…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="landing-label-previews">
      {['cornell-diehl-briar-fox', 'orlik-golden-sliced', 'cornell-diehl-autumn-evening'].map((id) => <img key={id} src={`${base}${id}.jpg`} alt={blends.find(([blendId]) => blendId === id)?.[1] ?? ''} width={320} height={320} loading="lazy" />)}
    </div>
  </section>
  return <section className="panel example-pack" aria-labelledby="example-pack-title">
    <h2 id="example-pack-title">Try the example pack</h2>
    <p className="field-hint">AI-generated examples for personal cellaring. Not official brand artwork or a license to reuse the original designs.</p>
    <p>Import these ten labels, choose how many of each to print, and preview your sheets.</p>
    <button className="example-pack-gallery" type="button" disabled={disabled} onClick={() => void run('import')} aria-label="Import example pack with ten labels">
      {blends.map(([id, name]) => <span className="example-pack-label" key={id}><img src={`${base}${id}.jpg`} alt={name} width={320} height={320} loading="lazy" /></span>)}
      <span className="example-pack-caption">{action === 'import' ? 'Loading example pack…' : 'Import all 10 labels'}</span>
    </button>
    <button className="button secondary" type="button" disabled={disabled} onClick={() => void run('download')}>{action === 'download' ? 'Preparing download…' : 'Download example ZIP'}</button>
    <p className="field-hint">26 MB. You can also download the ZIP and choose it from your device.</p>
    {action && <p role="status" className="field-hint">{action === 'import' ? 'Loading the example pack…' : 'Preparing the ZIP download…'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
