import { validateCurrent, validateLegacy } from './validators.generated.js'
import type { DiagnosticReport } from './index'

export function parseDiagnosticReport(value: unknown): DiagnosticReport | null {
  if (!validateCurrent(value) && !validateLegacy(value)) return null
  // Copy only schema-validated JSON. Never merge manifest metadata into feedback.
  return JSON.parse(JSON.stringify(value)) as DiagnosticReport
}
