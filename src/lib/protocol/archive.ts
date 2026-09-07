// Only prompt preparation needs archived bodies. Ordinary validation imports
// lightweight metadata from index.ts and never loads this module.
import instructions from './instructions.json'
import { PROTOCOL_REVISION } from './index'

// The full immutable release registry is build-time evidence. Prompts only need
// its exact instruction bodies, which already include the applicable schemas.
export function protocolInstructions(revision: number | string = PROTOCOL_REVISION): string {
  const key = String(revision)
  return Object.hasOwn(instructions, key) ? instructions[key as keyof typeof instructions] : ''
}
