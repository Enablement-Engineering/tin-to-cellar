import type { ValidationIssue } from './types'

export function hasFatal(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'fatal')
}

export function isBlocking(issue: ValidationIssue): boolean {
  return issue.severity === 'fatal' || issue.severity === 'error'
}

export function deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = [issue.severity, issue.code, issue.path, issue.labelId, issue.message].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
