import { pathToFileURL } from 'node:url'

// This command reads aggregate allowance state only, never diagnostic exports.
export async function fetchBudget({ token, base = 'https://tintocellar.com', fetcher = fetch }) {
  if (!token) throw new Error('Set DIAGNOSTICS_READ_TOKEN in the local environment.')
  const url = new URL('/api/labels/diagnostics/budget', base)
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use HTTPS for remote budget checks.')
  }
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Budget check failed (${response.status}). Deployment or access may need attention.`)
  const text = await response.text()
  if (text.length > 16384) throw new Error('Invalid budget response.')
  const data = JSON.parse(text)
  if (data.version !== 1 || typeof data.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.day)
    || !Number.isSafeInteger(data.used) || data.used < 0 || !Number.isSafeInteger(data.limit) || data.limit < 1
    || typeof data.paused !== 'boolean' || typeof data.resetAt !== 'string' || !Number.isFinite(Date.parse(data.resetAt))
    || (data.lastPausedAt != null && (typeof data.lastPausedAt !== 'string' || !Number.isFinite(Date.parse(data.lastPausedAt))))) {
    throw new Error('Invalid budget response.')
  }
  return { version: 1, day: data.day, used: data.used, limit: data.limit, paused: data.paused,
    resetAt: new Date(data.resetAt).toISOString(), lastPausedAt: data.lastPausedAt == null ? null : new Date(data.lastPausedAt).toISOString() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await fetchBudget({ token: process.env.DIAGNOSTICS_READ_TOKEN, base: process.env.DIAGNOSTICS_BASE_URL }), null, 2))
  } catch (error) {
    // Never print request headers or response bodies.
    console.error(error instanceof Error && /^(Set DIAGNOSTICS|Use HTTPS|Budget check failed|Invalid budget response)/.test(error.message)
      ? error.message : 'Budget check could not complete. Check connectivity and configuration.')
    process.exitCode = 1
  }
}
