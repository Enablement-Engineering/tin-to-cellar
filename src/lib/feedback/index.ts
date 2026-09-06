import Ajv from 'ajv'
import schema from './schema.json'

export const FEEDBACK_KEY = 'tin-to-cellar:feedback'
export const PROMPT_VERSION = '2026-09-06.1'
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
export type DiagnosticReport = LegacyDiagnosticReport
const validate = new Ajv({ allErrors: false }).compile(schema)
export function parseDiagnosticReport(value: unknown): DiagnosticReport | null {
  if (!validate(value)) return null
  // Copy only schema-validated JSON. Never merge manifest metadata into feedback.
  return JSON.parse(JSON.stringify(value)) as DiagnosticReport
}
export function summarizeReports(reports: DiagnosticReport[]) {
  return {
    reports: reports.length,
    outcomes: Object.fromEntries(['complete', 'partial', 'failed', 'research-only'].map((outcome) => [outcome, reports.filter((report) => report.outcome === outcome).length])),
    issues: Object.fromEntries([...new Set(reports.flatMap((report) => report.issues.map((issue) => issue.code)))].sort().map((code) => [code, reports.filter((report) => report.issues.some((issue) => issue.code === code)).length])),
  }
}
