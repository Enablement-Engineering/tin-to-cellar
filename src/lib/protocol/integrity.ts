import metadata from './metadata.json'

type FileIntegrity = { sha256: string; bytes: number }
type IntegrityMetadata = {
  algorithm: 'SHA-256'
  releases: Record<string, { files: Record<string, FileIntegrity> }>
  currentComponents: Record<string, FileIntegrity>
}

const integrity = metadata.integrity as IntegrityMetadata
const encoder = new TextEncoder()

function expectedInstructions(revision: number | string): FileIntegrity {
  const key = String(revision)
  const expected = Object.hasOwn(integrity.releases, key) ? integrity.releases[key].files['instructions.md'] : undefined
  if (!expected || !/^[0-9a-f]{64}$/.test(expected.sha256) || !Number.isSafeInteger(expected.bytes) || expected.bytes < 1) {
    throw new Error('The bundled instructions have no trusted release record. Reload the application before copying.')
  }
  return expected
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot verify the bundled instructions. Use a current browser before copying.')
  }
  const input = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(input).set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Verify exact UTF-8 release bytes against the build-generated, versioned trust record. */
export async function verifyProtocolInstructions(revision: number | string, instructions: string): Promise<void> {
  if (integrity.algorithm !== 'SHA-256') throw new Error('The bundled instruction verification method is unsupported.')
  const expected = expectedInstructions(revision)
  const bytes = encoder.encode(instructions)
  if (bytes.byteLength !== expected.bytes || await sha256(bytes) !== expected.sha256) {
    throw new Error('The bundled instructions failed their integrity check. Reload the application before copying.')
  }
}

export function currentComponentIntegrity(name: string): FileIntegrity | null {
  return Object.hasOwn(integrity.currentComponents, name) ? integrity.currentComponents[name] : null
}
