// Only prompt preparation needs archived bodies. Ordinary validation imports
// lightweight metadata from index.ts and never loads this module.
import registry from './releases.json'
import { PROTOCOL_REVISION, type ProtocolRelease } from './index'

export const protocolReleases = registry.releases as Record<string, ProtocolRelease>
export function protocolInstructions(): string {
  return protocolReleases[String(PROTOCOL_REVISION)]?.files['instructions.md'] ?? ''
}
