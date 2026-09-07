export { parseDiagnosticReport } from './validation'
import { isKnownProtocolRevision } from '../protocol'

export const FEEDBACK_KEY = 'tin-to-cellar:feedback'
/** Kept exclusively for the original, immutable feedback contract. */
export const PROMPT_VERSION = '2026-09-06.1'
export const FEEDBACK_SCHEMA_VERSION = '0.2.0'
type LegacyStage = 'research' | 'generation' | 'visual-review' | 'proof' | 'packaging' | 'validation'
type LegacyIssueCode = 'reference-unavailable' | 'variant-ambiguous' | 'image-handoff-unavailable' | 'generation-unavailable' | 'generation-failed' | 'artwork-fidelity' | 'text-legibility' | 'write-area' | 'geometry' | 'proof-unavailable' | 'schema' | 'archive' | 'instructions-unclear' | 'instructions-conflicting' | 'other'
type ReportBody<Stage extends string, IssueCode extends string> = {
  format: 'tin-to-cellar/feedback'
  request: { labelCount: number; shape: 'circle' | 'oval' | 'square' | 'rectangle' | 'rounded-rectangle' | 'custom' | 'unknown' }
  outcome: 'complete' | 'partial' | 'failed' | 'research-only'
  steps: Array<{ stage: Stage; status: 'passed' | 'failed' | 'skipped' | 'unavailable'; attempts: number }>
  issues: Array<{ code: IssueCode; stage: Stage; resolved: boolean }>
}
export type LegacyDiagnosticReport = ReportBody<LegacyStage, LegacyIssueCode> & {
  schemaVersion: '1.0.0'
  promptVersion: typeof PROMPT_VERSION
}
export type ProtocolDiagnosticReport = ReportBody<LegacyStage | 'protocol-retrieval', LegacyIssueCode | 'protocol-unavailable' | 'protocol-incomplete'> & {
  schemaVersion: typeof FEEDBACK_SCHEMA_VERSION
  protocolRevision: string
}
export type DiagnosticReport = LegacyDiagnosticReport | ProtocolDiagnosticReport
export function reportRevisionLabel(report: DiagnosticReport): string {
  if (report.schemaVersion === '1.0.0') return `Legacy prompt ${report.promptVersion}`
  return `Protocol ${report.protocolRevision}${isKnownProtocolRevision(report.protocolRevision) ? '' : ' (unrecognized)'}`
}
