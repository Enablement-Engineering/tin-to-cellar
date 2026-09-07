/** Decode archive JSON as untrusted data; schema and semantic checks still follow. */
export function parseArchiveJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const value: unknown = JSON.parse(text)
  if (jsonDepth(value) > 32) throw new TypeError('JSON depth exceeds limit')

  // JSON.parse checks syntax, but discards duplicate keys. Inspect string and
  // container tokens before returning its value, including escaped key aliases.
  const containers: Array<Set<string> | null> = []
  for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}[\]]/g)) {
    const token = match[0]
    if (token === '{') containers.push(new Set())
    else if (token === '[') containers.push(null)
    else if (token === '}' || token === ']') containers.pop()
    else if (/^\s*:/.test(text.slice(match.index + token.length))) {
      const keys = containers.at(-1)
      const key: string = JSON.parse(token)
      if (keys?.has(key)) throw new TypeError('Duplicate JSON object key')
      keys?.add(key)
    }
  }
  return value
}

function jsonDepth(value: unknown, depth = 0): number {
  if (!value || typeof value !== 'object') return depth
  if (depth > 32) return depth
  const values = Array.isArray(value) ? value : Object.values(value)
  return values.reduce((maximum, child) => Math.max(maximum, jsonDepth(child, depth + 1)), depth)
}
